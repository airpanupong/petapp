# Verifies real web push delivery from both APIs: a local endpoint captures the push request, decrypts
# it with the subscriber keys (RFC 8291 aes128gcm) and checks the VAPID JWT signature (RFC 8292).
# Both APIs must run with the same VAPID keypair.
#
#   backend/.venv/bin/python test/push_check.py http://127.0.0.1:8001 http://127.0.0.1:8787
import base64
import json
import os
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import http_ece
import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

CAPTURE = ("127.0.0.1", int(os.environ.get("CAPTURE_PORT", "9999")))
captured: dict[str, tuple[dict[str, str], bytes]] = {}


class Capture(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        captured[self.path] = ({k.lower(): v for k, v in self.headers.items()}, body)
        self.send_response(201)
        self.end_headers()

    def log_message(self, *args):
        pass


def b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def b64e(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def vapid(headers: dict[str, str]) -> tuple[str, str, str]:
    auth = headers.get("authorization", "")
    if auth.lower().startswith("vapid "):
        parts = dict(p.strip().split("=", 1) for p in auth[6:].split(","))
        return "vapid", parts["t"], parts["k"]
    key = headers.get("crypto-key", "").split("p256ecdsa=")[-1].split(";")[0]
    return "webpush", auth.split(" ", 1)[1], key


def check(kind: str, base: str) -> dict:
    api = f"{base}/api/v1"
    reg = httpx.post(
        f"{api}/auth/register",
        json={
            "email": f"push-{kind}-{uuid.uuid4().hex[:8]}@example.org",
            "password": "password123",
            "display_name": "push",
            "accept_privacy": True,
            "accept_data_access": True,
        },
    ).json()
    auth_header = {"Authorization": f"Bearer {reg['data']['access_token']}"}
    key = ec.generate_private_key(ec.SECP256R1())
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    secret = os.urandom(16)
    path = f"/push/{kind}"
    placeholder = f"https://push.invalid/{uuid.uuid4().hex}"
    sub = httpx.post(
        f"{api}/push/web/subscriptions",
        headers=auth_header,
        json={"endpoint": placeholder, "keys": {"p256dh": b64e(public), "auth": b64e(secret)}},
    )
    if sub.status_code >= 400:
        raise SystemExit(f"{kind}: subscribe failed {sub.status_code} {sub.text}")
    # The API only accepts https endpoints; point the stored one at the local capture server.
    redirect = f"UPDATE web_push_subscriptions SET endpoint='http://{CAPTURE[0]}:{CAPTURE[1]}{path}' WHERE endpoint='{placeholder}'"
    if kind == "py":
        subprocess.run(["sqlite3", os.environ.get("PY_SQLITE", "/tmp/petapp-diff.db"), redirect], check=True)
    else:
        persist = ["--persist-to", os.environ["CF_PERSIST"]] if os.environ.get("CF_PERSIST") else []
        subprocess.run(["npx", "wrangler", "d1", "execute", "DB", "--local", *persist, "--command", redirect], check=True, capture_output=True)
    result = httpx.post(f"{api}/push/web/test", headers=auth_header).json()
    for _ in range(100):
        if path in captured:
            break
        time.sleep(0.1)
    if path not in captured:
        raise SystemExit(f"{kind}: no push received ({result})")
    headers, body = captured[path]

    payload = json.loads(http_ece.decrypt(body, private_key=key, auth_secret=secret, version="aes128gcm"))
    scheme, token, vapid_key = vapid(headers)
    head64, claims64, sig64 = token.split(".")
    signature = b64d(sig64)
    verifier = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), b64d(vapid_key))
    verifier.verify(
        encode_dss_signature(int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")),
        f"{head64}.{claims64}".encode(),
        ec.ECDSA(hashes.SHA256()),
    )
    claims = json.loads(b64d(claims64))
    return {
        "api_result": result.get("data"),
        "payload": payload,
        "vapid_scheme": scheme,
        "vapid_key": vapid_key,
        "aud": claims["aud"],
        "sub": claims["sub"],
        "exp_in_hours": round((claims["exp"] - time.time()) / 3600),
        "jwt_header": json.loads(b64d(head64)),
        "ttl": headers.get("ttl"),
        "content_encoding": headers.get("content-encoding"),
    }


def main():
    server = ThreadingHTTPServer(CAPTURE, Capture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    py_base, cf_base = sys.argv[1:3]
    results = {"python": check("py", py_base), "worker": check("cf", cf_base)}
    for name, res in results.items():
        print(f"{name}: decrypted + VAPID signature valid")
        print("   ", json.dumps(res, ensure_ascii=False))
    keys = sorted(set(results["python"]) | set(results["worker"]))
    diffs = [k for k in keys if results["python"].get(k) != results["worker"].get(k)]
    print("differences:", diffs or "none")


main()
