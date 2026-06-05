"""Path helpers for operator-only abc-express scripts."""
from __future__ import annotations

import re
from pathlib import Path

TABLE_NAME = re.compile(r"^[a-z][a-z0-9_]*$")


def safe_table_name(name: str) -> str:
    if not TABLE_NAME.match(name):
        raise ValueError(f"invalid table name: {name}")
    return name


def resolve_under(base: Path, user_path: str) -> Path:
    base = base.resolve()
    candidate = Path(user_path)
    resolved = candidate.resolve() if candidate.is_absolute() else (base / candidate).resolve()
    if resolved != base and not str(resolved).startswith(str(base) + "/"):
        raise ValueError(f"path escapes allowed directory: {user_path}")
    return resolved
