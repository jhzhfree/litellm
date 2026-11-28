"""Detects Mailgun API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class MailgunDetector(RegexBasedDetector):
    """Scans for Mailgun API keys."""

    @property
    def secret_type(self) -> str:
        return "Mailgun API Key"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bkey-[0-9a-zA-Z]{32}\b")]
