"""Detects Shopify access tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class ShopifyDetector(RegexBasedDetector):
    """Scans for Shopify access tokens (shpat, shpss, shpca, shppa)."""

    @property
    def secret_type(self) -> str:
        return "Shopify Access Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bshpat_[a-fA-F0-9]{32}\b"),
            re.compile(r"\bshpss_[a-fA-F0-9]{32}\b"),
            re.compile(r"\bshpca_[a-fA-F0-9]{32}\b"),
            re.compile(r"\bshppa_[a-fA-F0-9]{32}\b"),
        ]
