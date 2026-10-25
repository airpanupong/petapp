"""Clear all pets, posts, chats, notifications and uploads before launch. Accounts and ads stay.

Run inside the API container: python -m app.wipe_content --yes
"""

from __future__ import annotations

import sys

import app.models  # noqa: F401  (register all mappers)
from app.core.database import SessionLocal
from app.services.account_service import wipe_content

if __name__ == "__main__":
    if "--yes" not in sys.argv:
        sys.exit("Refusing to wipe without --yes")
    with SessionLocal() as db:
        for table, count in wipe_content(db).items():
            print(f"{table}: {count}")
