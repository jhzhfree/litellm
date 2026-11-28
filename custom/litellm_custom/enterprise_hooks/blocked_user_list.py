from typing import Final

from fastapi import HTTPException
from pydantic import TypeAdapter

import litellm
from litellm._internal_context import with_service_target
from litellm._logging import verbose_proxy_logger
from litellm.caching.caching import DualCache
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy._types import LiteLLM_EndUserTable, UserAPIKeyAuth
from litellm.proxy.common_utils.user_api_key_cache import AUTH_OBJECTS_TARGET
from litellm.proxy.utils import PrismaClient
from litellm.repositories.table_repositories import EndUserRepository

_REQUEST_BODY_VALUE: Final = TypeAdapter(object)


class EnterpriseBlockedUserList(CustomLogger):
    """
    Rejects calls from blocked users. The block list comes from
    `litellm.blocked_user_list` (inline list or file path) and from the
    `blocked` flag on LiteLLM_EndUserTable rows.
    """

    enforces_request_content: bool = True

    def __init__(self, prisma_client: PrismaClient | None):
        self.prisma_client = prisma_client

        blocked_user_list = litellm.blocked_user_list
        if blocked_user_list is None:
            self.blocked_user_list = None
            return

        if isinstance(blocked_user_list, list):
            self.blocked_user_list = blocked_user_list

        if isinstance(blocked_user_list, str):  # assume it's a filepath
            try:
                with open(blocked_user_list, "r") as file:
                    self.blocked_user_list = file.read().split("\n")
            except FileNotFoundError:
                raise Exception(f"File not found. blocked_user_list={blocked_user_list}")
            except Exception as e:
                raise Exception(f"An error occurred: {e!s}, blocked_user_list={blocked_user_list}")

    @with_service_target(AUTH_OBJECTS_TARGET)
    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: DualCache,
        data: dict,
        call_type: str,
    ):
        try:
            verbose_proxy_logger.debug("Inside Blocked User List Pre-Call Hook")
            if "user_id" in data or "user" in data:
                user = data.get("user_id", data.get("user", ""))
                if self.blocked_user_list is not None and user in self.blocked_user_list:
                    raise HTTPException(
                        status_code=400,
                        detail={"error": f"User blocked from making LLM API Calls. User={user}"},
                    )

                cache_key = f"litellm:end_user_id:{user}"
                end_user_cache_obj: LiteLLM_EndUserTable | None = cache.get_cache(key=cache_key)
                if end_user_cache_obj is None and self.prisma_client is not None:
                    end_user_id: Final = _REQUEST_BODY_VALUE.validate_python(user)
                    end_user_obj = await EndUserRepository(self.prisma_client).table.find_unique(where={"user_id": end_user_id})
                    if end_user_obj is None:
                        end_user_obj = LiteLLM_EndUserTable(user_id=user, blocked=False)
                    cache.set_cache(key=cache_key, value=end_user_obj, ttl=60)
                    if end_user_obj.blocked is True:
                        raise HTTPException(
                            status_code=400,
                            detail={"error": f"User blocked from making LLM API Calls. User={user}"},
                        )
                elif end_user_cache_obj is not None and end_user_cache_obj.blocked is True:
                    raise HTTPException(
                        status_code=400,
                        detail={"error": f"User blocked from making LLM API Calls. User={user}"},
                    )

        except HTTPException:
            raise
        except Exception as e:
            verbose_proxy_logger.exception(
                f"litellm_custom.enterprise_hooks.blocked_user_list::async_pre_call_hook - Exception occurred - {e!s}"
            )


_ENTERPRISE_BlockedUserList = EnterpriseBlockedUserList
