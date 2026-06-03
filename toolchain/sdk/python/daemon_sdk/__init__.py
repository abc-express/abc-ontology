"""Daemon platform Python SDK — HTTP client for gateway APIs."""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class DaemonClient:
    base_url: str

    def health(self) -> dict[str, Any]:
        with urllib.request.urlopen(f"{self.base_url.rstrip('/')}/health") as res:
            return json.loads(res.read().decode())

    def check_policy(self, action: str, resource: str) -> dict[str, Any]:
        payload = json.dumps({"action": action, "resource": resource}).encode()
        req = urllib.request.Request(
            f"{self.base_url.rstrip('/')}/v1/policy/check",
            data=payload,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
