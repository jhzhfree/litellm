"""Detects Twilio API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class TwilioApiKeyDetector(RegexBasedDetector):
    """Scans for Twilio API keys (SK prefixed)."""

    @property
    def secret_type(self) -> str:
        return "Twilio API Key"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"(?i)\bSK[0-9a-f]{32}\b")]
