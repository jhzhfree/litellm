"""Detects Slack tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class SlackTokenDetector(RegexBasedDetector):
    """Scans for Slack bot, user and app-level tokens (xox...)."""

    @property
    def secret_type(self) -> str:
        return "Slack Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")]
