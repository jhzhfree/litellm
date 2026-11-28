"""Detects Doppler API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class DopplerApiTokenDetector(RegexBasedDetector):
    """Scans for Doppler service tokens."""

    @property
    def secret_type(self) -> str:
        return "Doppler API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bdp\.pt\.[a-zA-Z0-9]{43}\b")]
