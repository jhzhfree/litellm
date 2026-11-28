"""Detects database connection strings carrying credentials."""

import re

from typing import Final

from detect_secrets.plugins.base import RegexBasedDetector

_DB_URL: Final = re.compile(
    r"\b(?:postgresql|postgres|mysql|mariadb|redis|rediss|mongodb(?:\+srv)?|mssql|amqps?)://"
    r"[^\s@:/]*:[^\s@]+@[^\s\"']+",
    re.IGNORECASE,
)


class DatabaseConnectionStringDetector(RegexBasedDetector):
    """Scans for database URLs whose authority holds a password."""

    @property
    def secret_type(self) -> str:
        return "Database Connection String"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [_DB_URL]
