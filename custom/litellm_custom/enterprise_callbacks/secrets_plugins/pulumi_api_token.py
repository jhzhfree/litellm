"""Detects Pulumi API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class PulumiApiTokenDetector(RegexBasedDetector):
    """Scans for Pulumi access tokens."""

    @property
    def secret_type(self) -> str:
        return "Pulumi API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bpul-[a-f0-9]{40}\b")]
