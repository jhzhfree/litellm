"""Detects Netlify access tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class NetlifyAccessTokenDetector(RegexBasedDetector):
    """Scans for Netlify personal access tokens."""

    @property
    def secret_type(self) -> str:
        return "Netlify Access Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bnfp_[A-Za-z0-9]{40}\b")]
