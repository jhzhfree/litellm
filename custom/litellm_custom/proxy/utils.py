
from litellm.secret_managers.main import str_to_bool


def _should_block_robots() -> bool:
    """
    Returns True if robots.txt should block web crawlers, controlled by:

    ```yaml
    general_settings:
      block_robots: true
    ```
    """
    from litellm.proxy.proxy_server import CommonProxyErrors, general_settings, premium_user

    raw_block_robots: bool | str = general_settings.get("block_robots", False)
    if isinstance(raw_block_robots, bool):
        block_robots: bool | None = raw_block_robots
    elif isinstance(raw_block_robots, str):
        block_robots = str_to_bool(raw_block_robots)
    else:
        block_robots = None

    if block_robots is True:
        if premium_user is not True:
            raise ValueError(
                f"Blocking web crawlers is an enterprise feature. {CommonProxyErrors.not_premium_user.value}"
            )
        return True
    return False


should_block_robots = _should_block_robots
