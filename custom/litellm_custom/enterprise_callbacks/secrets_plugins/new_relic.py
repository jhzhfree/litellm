"""Detects New Relic API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class NewRelicDetector(RegexBasedDetector):
    """Scans for New Relic user keys and license keys."""

    @property
    def secret_type(self) -> str:
        return "New Relic API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bNRAK-[A-Z0-9]{27}\b"),
            re.compile(r"\b[a-f0-9]{32}t[a-z0-9]{16}\b"),
        ]
