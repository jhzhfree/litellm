"""
Endpoints for managing email alerts on litellm
"""

import json
from typing import Final

from fastapi import APIRouter, Depends, HTTPException
from pydantic import TypeAdapter

from litellm._logging import verbose_proxy_logger
from litellm.proxy._types import UserAPIKeyAuth
from litellm.proxy.auth.user_api_key_auth import user_api_key_auth
from litellm.proxy.db.db_span import db_span
from litellm_custom.types.enterprise_callbacks.send_emails import (
    DefaultEmailSettings,
    EmailEvent,
    EmailEventSettings,
    EmailEventSettingsResponse,
    EmailEventSettingsUpdateRequest,
)

router = APIRouter()

_GENERAL_SETTINGS_ADAPTER: Final = TypeAdapter(dict[str, object])
_EMAIL_SETTINGS_ADAPTER: Final = TypeAdapter(dict[str, bool])


def _parse_general_settings(param_value: object) -> dict[str, object]:
    if isinstance(param_value, str):
        return _GENERAL_SETTINGS_ADAPTER.validate_json(param_value)
    return _GENERAL_SETTINGS_ADAPTER.validate_python(param_value)


async def _get_email_settings(prisma_client) -> dict[str, bool]:  # mutable-ok: [LIT001] settings payload
    """Helper function to get email settings from general_settings in db"""
    try:
        general_settings_entry = await prisma_client.db.litellm_config.find_unique(
            where={"param_name": "general_settings"}
        )

        settings: Final = dict(DefaultEmailSettings.get_defaults())

        if general_settings_entry is not None and general_settings_entry.param_value is not None:
            general_settings: Final = _parse_general_settings(general_settings_entry.param_value)

            if general_settings and "email_settings" in general_settings:
                email_settings: Final = _EMAIL_SETTINGS_ADAPTER.validate_python(general_settings["email_settings"])
                for event_name, enabled in email_settings.items():
                    settings[event_name] = enabled

        return settings
    except Exception as e:
        verbose_proxy_logger.error(f"Error getting email settings from general_settings: {e!s}")
        return DefaultEmailSettings.get_defaults()


async def _save_email_settings(prisma_client, settings: dict[str, bool]):  # mutable-ok: [LIT001] settings payload
    """Helper function to save email settings to general_settings in db"""
    from litellm.proxy.proxy_server import proxy_config

    proxy_config.reject_config_owned_writes(
        section_name="general_settings", changed_keys={"email_settings": settings}
    )
    try:
        verbose_proxy_logger.debug(f"Saving email settings to general_settings: {settings}")

        general_settings_entry = await prisma_client.db.litellm_config.find_unique(
            where={"param_name": "general_settings"}
        )

        general_settings: Final = (
            _parse_general_settings(general_settings_entry.param_value)
            if general_settings_entry is not None and general_settings_entry.param_value is not None
            else {}
        )
        general_settings["email_settings"] = dict(settings)

        json_settings = json.dumps(general_settings, default=str)

        async with db_span("save_email_settings", "LiteLLM_Config"):
            await prisma_client.db.litellm_config.upsert(
                where={"param_name": "general_settings"},
                data={
                    "create": {
                        "param_name": "general_settings",
                        "param_value": json_settings,
                    },
                    "update": {"param_value": json_settings},
                },
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving email settings to general_settings: {e!s}")


@router.get(
    "/email/event_settings",
    response_model=EmailEventSettingsResponse,
    tags=["email management"],
    dependencies=[Depends(user_api_key_auth)],
)
async def get_email_event_settings(
    user_api_key_dict: UserAPIKeyAuth = Depends(user_api_key_auth),
):
    """
    Get all email event settings
    """
    from litellm.proxy.proxy_server import prisma_client

    if prisma_client is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        settings_dict = await _get_email_settings(prisma_client)

        response_settings: Final = [
            EmailEventSettings(event=event, enabled=settings_dict.get(event.value, False)) for event in EmailEvent
        ]

        return EmailEventSettingsResponse(settings=response_settings)
    except Exception as e:
        verbose_proxy_logger.exception(f"Error getting email settings: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/email/event_settings",
    tags=["email management"],
    dependencies=[Depends(user_api_key_auth)],
)
async def update_event_settings(
    request: EmailEventSettingsUpdateRequest,
    user_api_key_dict: UserAPIKeyAuth = Depends(user_api_key_auth),
):
    """
    Update the settings for email events
    """
    from litellm.proxy.proxy_server import prisma_client

    if prisma_client is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        settings_dict = await _get_email_settings(prisma_client)

        for setting in request.settings:
            settings_dict[setting.event.value] = setting.enabled

        await _save_email_settings(prisma_client, settings_dict)

        return {"message": "Email event settings updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        verbose_proxy_logger.exception(f"Error updating email settings: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/email/event_settings/reset",
    tags=["email management"],
    dependencies=[Depends(user_api_key_auth)],
)
async def reset_event_settings(
    user_api_key_dict: UserAPIKeyAuth = Depends(user_api_key_auth),
):
    """
    Reset all email event settings to default (new user invitations on, virtual key creation off)
    """
    from litellm.proxy.proxy_server import prisma_client

    if prisma_client is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        default_settings = DefaultEmailSettings.get_defaults()

        await _save_email_settings(prisma_client, default_settings)

        return {"message": "Email event settings reset to defaults"}
    except HTTPException:
        raise
    except Exception as e:
        verbose_proxy_logger.exception(f"Error resetting email settings: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))
