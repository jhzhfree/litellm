"""
Guardrail violation message localization.

The messages returned to end users when a guardrail blocks a request are
localized via ``LITELLM_GUARDRAIL_VIOLATION_MESSAGE_LOCALE``:

- ``en`` (default): original English messages, byte-identical to previous
  releases so existing tests/integrations are unaffected.
- ``zh``: Chinese messages for end-user-facing deployments.

The environment variable can be set in ``deploy/.env`` (compose passes it to
the proxy container). Category-level Chinese display names come from the
category YAML ``display_name_zh`` field; the fallback is the category name.
"""

import os
from typing import Final

VIOLATION_MESSAGE_LOCALE_ENV: Final = "LITELLM_GUARDRAIL_VIOLATION_MESSAGE_LOCALE"

_ZH_LOCALE: Final = "zh"
_EN_LOCALE: Final = "en"


def get_violation_message_locale() -> str:
    """Return the configured violation-message locale (``en`` or ``zh``)."""
    return os.getenv(VIOLATION_MESSAGE_LOCALE_ENV, _EN_LOCALE).strip().lower() or _EN_LOCALE


def is_zh_violation_message() -> bool:
    return get_violation_message_locale() == _ZH_LOCALE


# ---------------------------------------------------------------------------
# Content filter messages
# ---------------------------------------------------------------------------


def content_filter_conditional_blocked(
    category_name: str,
    display_name_zh: str | None,
    matched_phrase: str,
    severity: str,
) -> str:
    """Message for a conditional (identifier + block word) category match."""
    if is_zh_violation_message():
        label = display_name_zh or category_name
        return f"内容已被安全护栏拦截：命中分类「{label}」，匹配「{matched_phrase}」（严重度：{severity}）"
    return f"Content blocked: {category_name} conditional match '{matched_phrase}' detected (severity: {severity})"


def content_filter_category_keyword_blocked(
    category_name: str,
    display_name_zh: str | None,
    keyword: str,
    severity: str,
) -> str:
    """Message for a category keyword (always-block or regular) match."""
    if is_zh_violation_message():
        label = display_name_zh or category_name
        return f"内容已被安全护栏拦截：命中分类「{label}」的关键词「{keyword}」（严重度：{severity}）"
    return f"Content blocked: {category_name} category keyword '{keyword}' detected (severity: {severity})"


def content_filter_pattern_blocked(pattern_name: str) -> str:
    """Message for a prebuilt/custom regex pattern match."""
    if is_zh_violation_message():
        return f"内容已被安全护栏拦截：命中敏感信息模式「{pattern_name}」"
    return f"Content blocked: {pattern_name} pattern detected"


def content_filter_keyword_blocked(keyword: str) -> str:
    """Message for a standalone (non-category) keyword match."""
    if is_zh_violation_message():
        return f"内容已被安全护栏拦截：命中关键词「{keyword}」"
    return f"Content blocked: keyword '{keyword}' detected"


def content_filter_image_blocked() -> str:
    if is_zh_violation_message():
        return "内容已被安全护栏拦截：图片描述包含违规内容"
    return "Content blocked: Image description detected"


def content_filter_competitor_blocked() -> str:
    if is_zh_violation_message():
        return "内容已被安全护栏拦截：检测到竞品对比或排名意图"
    return "Content blocked: competitor comparison or ranking intent detected."


def content_filter_masking_rule_blocked(context_label: str) -> str:
    if is_zh_violation_message():
        return f"内容已被安全护栏拦截：{context_label} 参数命中掩码规则（不可改写字段）"
    return f"Content blocked: {context_label} argument matched a masking rule on a non-rewritable field"


def content_filter_nesting_depth_blocked(context_label: str) -> str:
    if is_zh_violation_message():
        return f"内容已被安全护栏拦截：{context_label} 参数嵌套深度超限"
    return f"Content blocked: {context_label} arguments exceed the maximum nesting depth"


# ---------------------------------------------------------------------------
# Decision model messages
# ---------------------------------------------------------------------------


def decision_model_failed_to_respond() -> str:
    if is_zh_violation_message():
        return "决策模型护栏未能响应，请稍后重试"
    return "Decision model guardrail failed to respond"


def decision_model_policy_violated() -> str:
    if is_zh_violation_message():
        return "请求违反决策模型护栏策略，已被拦截"
    return "Violated decision model guardrail policy"
