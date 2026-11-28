"""Detects HubSpot API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class HubSpotApiTokenDetector(RegexBasedDetector):
    """Scans for HubSpot private app tokens."""

    @property
    def secret_type(self) -> str:
        return "HubSpot API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bpat-(?:na1|eu1)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")]
