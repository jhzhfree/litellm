"""Detects GitHub tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class GitHubTokenCustomDetector(RegexBasedDetector):
    """Scans for GitHub App, personal access, OAuth, refresh and fine-grained tokens."""

    @property
    def secret_type(self) -> str:
        return "GitHub Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b"),
            re.compile(r"\bgithub_pat_[0-9a-zA-Z_]{82}\b"),
        ]
