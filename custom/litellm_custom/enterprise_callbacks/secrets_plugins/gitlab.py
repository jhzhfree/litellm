"""Detects GitLab personal access tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class GitLabDetector(RegexBasedDetector):
    """Scans for GitLab personal access and runner tokens."""

    @property
    def secret_type(self) -> str:
        return "GitLab Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bglpat-[0-9a-zA-Z_-]{20,}\b")]
