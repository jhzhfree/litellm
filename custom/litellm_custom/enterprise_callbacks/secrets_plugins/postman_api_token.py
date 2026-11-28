"""Detects Postman API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class PostmanApiTokenDetector(RegexBasedDetector):
    """Scans for Postman API tokens."""

    @property
    def secret_type(self) -> str:
        return "Postman API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bPMA?[Tt][a-zA-Z0-9]{21,40}\b")]
