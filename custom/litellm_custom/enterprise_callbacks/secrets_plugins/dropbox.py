"""Detects Dropbox tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class DropboxTokenDetector(RegexBasedDetector):
    """Scans for Dropbox short-lived and refresh tokens."""

    @property
    def secret_type(self) -> str:
        return "Dropbox Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bsl\.[a-zA-Z0-9_-]{130,140}\b"),
            re.compile(r"\b[a-zA-Z0-9]{64}\b"),
        ]
