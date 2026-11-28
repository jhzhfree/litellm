"""Detects Linear API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class LinearApiKeyDetector(RegexBasedDetector):
    """Scans for Linear API keys and OAuth client secrets."""

    @property
    def secret_type(self) -> str:
        return "Linear Secret"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\blin_api_[a-zA-Z0-9]{40}\b"),
            re.compile(r"\b[0-9a-f]{64}\b"),
        ]
