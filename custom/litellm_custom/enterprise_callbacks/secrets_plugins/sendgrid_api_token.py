"""Detects SendGrid API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class SendGridApiTokenDetector(RegexBasedDetector):
    """Scans for SendGrid API keys (SG.xxx.yyy)."""

    @property
    def secret_type(self) -> str:
        return "SendGrid API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b")]
