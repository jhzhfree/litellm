"""Detects Google Cloud Platform API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class GCPApiKeyDetector(RegexBasedDetector):
    """Scans for GCP API keys (AIza...)."""

    @property
    def secret_type(self) -> str:
        return "GCP API Key"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")]
