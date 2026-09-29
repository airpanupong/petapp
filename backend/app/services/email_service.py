from __future__ import annotations

import logging
import smtplib

import httpx
import ssl
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr

from app.core.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)

# Messages "sent" while SMTP is not configured outside production (used by tests).
outbox: list[EmailMessage] = []


def email_configured() -> bool:
    return bool(settings.resend_api_key) or bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


def _send_via_resend(to: str, subject: str, text: str, html: str | None) -> None:
    try:
        res = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.smtp_from,
                "to": [to],
                "reply_to": parseaddr(settings.smtp_from)[1] or None,
                "subject": subject,
                "text": text,
                **({"html": html} if html else {}),
            },
            timeout=15,
        )
    except httpx.HTTPError as exc:
        logger.error("Resend request for %s failed: %s", to, exc)
        raise AppError(503, "EMAIL_SEND_FAILED", "Could not send email") from exc
    if res.status_code >= 300:
        logger.error("Resend rejected email to %s: %s %s", to, res.status_code, res.text[:300])
        raise AppError(503, "EMAIL_SEND_FAILED", "Could not send email")


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain="pethaii.com")
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    if not email_configured():
        if settings.app_env == "production":
            raise AppError(503, "EMAIL_NOT_CONFIGURED", "Email service is not configured")
        logger.info("Email (not sent, SMTP not configured) to %s: %s\n%s", to, subject, text)
        outbox.append(msg)
        return

    if settings.resend_api_key:
        _send_via_resend(to, subject, text, html)
        return

    try:
        context = ssl.create_default_context()
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=15) as smtp:
                smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls(context=context)
                smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("SMTP send to %s failed: %s", to, exc)
        raise AppError(503, "EMAIL_SEND_FAILED", "Could not send email") from exc
