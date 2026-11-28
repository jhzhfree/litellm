"""Detects MapBox API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class MapBoxApiTokenDetector(RegexBasedDetector):
    """Scans for MapBox secret and public tokens."""

    @property
    def secret_type(self) -> str:
        return "MapBox API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bsk\.[a-zA-Z0-9]{31}\.[a-zA-Z0-9]{44}\b"),
            re.compile(r"\bpk\.eyJ[a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z0-9_-]+\b"),
        ]
