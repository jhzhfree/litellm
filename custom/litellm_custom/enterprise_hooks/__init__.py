"""
Enterprise proxy hooks shipped with the litellm_custom package.

Imported at the bottom of litellm/proxy/hooks/__init__.py so the managed files
and managed vector stores hooks are registered in PROXY_HOOKS when the package
is installed. Modules here must not import litellm.proxy modules at the top
level beyond what the hook modules themselves already need, because this
package is imported while litellm.proxy is still initializing.
"""

from typing import TYPE_CHECKING, Final, Literal

from litellm_custom.proxy.hooks.managed_files import _PROXY_LiteLLMManagedFiles
from litellm_custom.proxy.hooks.managed_vector_stores import _PROXY_LiteLLMManagedVectorStores

if TYPE_CHECKING:
    from typing import TypeAlias

    EnterpriseProxyHookName: TypeAlias = Literal["managed_files", "managed_vector_stores"]
    EnterpriseProxyHook: TypeAlias = type

ENTERPRISE_PROXY_HOOKS: Final[dict[str, type]] = {
    "managed_files": _PROXY_LiteLLMManagedFiles,
    "managed_vector_stores": _PROXY_LiteLLMManagedVectorStores,
}


def get_enterprise_proxy_hook(hook_name: str) -> type:
    if hook_name not in ENTERPRISE_PROXY_HOOKS:
        raise ValueError(f"Invalid enterprise proxy hook name: {hook_name}")
    return ENTERPRISE_PROXY_HOOKS[hook_name]
