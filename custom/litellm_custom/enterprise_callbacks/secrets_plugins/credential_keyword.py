"""Detects credential values assigned to password/secret/key style names."""

import re
from collections.abc import Generator, Mapping
from string import punctuation

from detect_secrets.plugins.keyword import QUOTES_REQUIRED_DENYLIST_REGEX_TO_GROUP, KeywordDetector

_CREDENTIAL_VALUE = re.compile(r"[^\s()\[\]]+")
_ENVIRONMENT_REFERENCE = re.compile(r"os\.environ/\w+", re.IGNORECASE)
_ENVIRONMENT_VARIABLE_NAME = re.compile(r"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+")
_LOWERCASE_WORD_SEQUENCE = re.compile(r"[a-z]+(?:[-._/][a-z]+)+")
_ISO_8601_TIMESTAMP = re.compile(
    r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?"
)
_URL_WITHOUT_USERINFO_OR_QUERY = re.compile(r"[A-Za-z][A-Za-z0-9+.-]*://[^\s@?]*")
_BENIGN_VALUES = (
    _ENVIRONMENT_REFERENCE,
    _ENVIRONMENT_VARIABLE_NAME,
    _LOWERCASE_WORD_SEQUENCE,
    _ISO_8601_TIMESTAMP,
    _URL_WITHOUT_USERINFO_OR_QUERY,
)


class CredentialKeywordDetector(KeywordDetector):
    """Flags quoted values under credential-sounding keys when they look like a real credential."""

    secret_type = "Credential Keyword"

    def __init__(self, minimum_length: int = 12, keyword_exclude: str | None = None) -> None:
        if not isinstance(minimum_length, int) or minimum_length < 1:
            raise ValueError(f"minimum_length must be a positive integer, got {minimum_length!r}")
        super().__init__(keyword_exclude=keyword_exclude)
        self.minimum_length = minimum_length

    def _is_credential(self, value: str) -> bool:
        core = value.strip(punctuation)
        return (
            len(value) >= self.minimum_length
            and _CREDENTIAL_VALUE.fullmatch(value) is not None
            and all(benign.fullmatch(core) is None for benign in _BENIGN_VALUES)
        )

    def analyze_string(
        self,
        string: str,
        denylist_regex_to_group: Mapping[re.Pattern[str], int] | None = None,
    ) -> Generator[str, None, None]:
        if self.keyword_exclude is not None and self.keyword_exclude.search(string):
            return
        regex_to_group = (
            QUOTES_REQUIRED_DENYLIST_REGEX_TO_GROUP if denylist_regex_to_group is None else denylist_regex_to_group
        )
        yield from (
            match.group(group)
            for regex, group in regex_to_group.items()
            for match in regex.finditer(string)
            if self._is_credential(match.group(group))
        )
