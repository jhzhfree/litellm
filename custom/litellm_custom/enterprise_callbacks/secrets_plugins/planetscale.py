"""Detects PlanetScale tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class PlanetScaleTokenDetector(RegexBasedDetector):
    """Scans for PlanetScale service, OAuth and database password tokens."""

    @property
    def secret_type(self) -> str:
        return "PlanetScale API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bpscale_tkn_[a-zA-Z0-9_\.\-]{43}\b"),
            re.compile(r"\bpscale_oauth_[a-zA-Z0-9_\.\-]{32}\b"),
            re.compile(r"\bpscale_pw_[a-zA-Z0-9_\.\-]{32}\b"),
        ]
