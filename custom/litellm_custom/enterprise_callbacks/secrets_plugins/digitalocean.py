"""Detects DigitalOcean tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class DigitalOceanTokenDetector(RegexBasedDetector):
    """Scans for DigitalOcean personal access and OAuth tokens."""

    @property
    def secret_type(self) -> str:
        return "DigitalOcean Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\b(?:doo_v1_|dop_v1_|dor_v1_)[a-f0-9]{64}\b")]
