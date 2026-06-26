"""Role-based access control.

Permissions are named by what a person controls, not how the system is built.
Each role is a set of permissions; the runtime checks the principal's role has
the permission a route requires.
"""
from __future__ import annotations


class Perm:
    STUDIO_READ = "studio.read"
    STUDIO_RUN = "studio.run"
    LEADS_READ = "leads.read"
    LEADS_WRITE = "leads.write"
    OUTREACH_APPROVE = "outreach.approve"
    MODELS_READ = "models.read"
    MODELS_WRITE = "models.write"
    USAGE_READ = "usage.read"
    ADMIN = "admin"


_ALL = {v for k, v in vars(Perm).items() if not k.startswith("_") and isinstance(v, str)}

ROLE_PERMS: dict[str, set[str]] = {
    "viewer": {Perm.STUDIO_READ, Perm.LEADS_READ, Perm.MODELS_READ, Perm.USAGE_READ},
    "creator": {Perm.STUDIO_READ, Perm.STUDIO_RUN, Perm.LEADS_READ, Perm.LEADS_WRITE,
                Perm.MODELS_READ, Perm.USAGE_READ},
    "operator": {Perm.STUDIO_READ, Perm.STUDIO_RUN, Perm.LEADS_READ, Perm.LEADS_WRITE,
                 Perm.OUTREACH_APPROVE, Perm.MODELS_READ, Perm.MODELS_WRITE, Perm.USAGE_READ},
    "admin": set(_ALL),
}

ROLES = tuple(ROLE_PERMS)


def permissions_for(role: str) -> set[str]:
    return ROLE_PERMS.get(role, set())


def role_can(role: str, perm: str) -> bool:
    return perm in permissions_for(role)
