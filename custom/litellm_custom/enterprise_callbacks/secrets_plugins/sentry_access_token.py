"""Detects Sentry access tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class SentryAccessTokenDetector(RegexBasedDetector):
    """Scans for Sentry auth tokens."""

    @property
    def secret_type(self) -> str:
        return "Sentry Access Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bsntrys_[A-Za-z0-9_+/]{40,}\b")]
