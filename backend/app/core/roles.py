from __future__ import annotations

USER = "user"
ADMIN = "admin"
SUPER_ADMIN = "super_admin"

ROLES = (USER, ADMIN, SUPER_ADMIN)
STAFF_ROLES = (ADMIN, SUPER_ADMIN)

# Post statuses that only the owner and staff may see.
PRIVATE_POST_STATUSES = ("hidden", "removed")


def is_staff(role: str | None) -> bool:
    return role in STAFF_ROLES
