"""Response models for the /audit endpoints."""

from collections.abc import Mapping
from datetime import datetime

from pydantic import Field

from litellm.types.llms.base import LiteLLMBaseModel


class AuditLogResponse(LiteLLMBaseModel):
    """Response model for a single audit log entry"""

    id: str
    updated_at: datetime
    changed_by: str
    changed_by_api_key: str
    action: str
    table_name: str
    object_id: str
    before_value: Mapping[str, object] | None = None
    updated_values: Mapping[str, object] | None = None


class PaginatedAuditLogResponse(LiteLLMBaseModel):
    """Response model for paginated audit logs"""

    audit_logs: list[AuditLogResponse]
    total: int = Field(
        ...,
        description="Total number of audit logs matching the filters",
    )
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
