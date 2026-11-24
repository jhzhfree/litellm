"""Gateway accounts associated with a verified employee identity."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class EmployeeGatewayAccount:
    user_id: str
    enabled: bool


class EmployeeEnrollmentStore(Protocol):
    async def find_enrolled_account(self, binding: str) -> EmployeeGatewayAccount | None: ...

    async def ensure_employee_account(self, binding: str) -> EmployeeGatewayAccount | None: ...
