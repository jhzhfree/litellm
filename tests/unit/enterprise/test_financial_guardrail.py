"""
FinancialDataGuardrail 回归测试。

核心保证: 护栏只检测用户侧消息内容, 系统提示词(网关固定文案, 含"预算/支出"等词
及日期/计数数字)不参与检测——否则小恒等内置智能体发任何请求都会被误拦。
"""
import asyncio

import pytest

from enterprise.financial_guardrail import FinancialDataGuardrail


@pytest.fixture
def guardrail() -> FinancialDataGuardrail:
    return FinancialDataGuardrail(guardrail_name="financial-data-guard", action="block")


def _run(guardrail, messages):
    texts = [" ".join(str(m.get("content", "")) for m in messages)]
    return asyncio.run(
        guardrail.apply_guardrail({"texts": texts}, {"messages": messages}, "request")
    )


def test_system_prompt_with_keywords_and_numbers_does_not_block(guardrail):
    """系统提示词含财务词+数字, 用户只发"你好" → 必须放行。"""
    messages = [
        {
            "role": "system",
            "content": (
                "你是小恒, AI治理网关的智能助手。资源花费是运行中的配额计数器。"
                "当前 UTC 日期: 2026-11-20。"
            ),
        },
        {"role": "user", "content": "你好"},
    ]
    _run(guardrail, messages)


def test_user_bank_card_blocks(guardrail):
    messages = [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "查询银行卡 4111 1111 1111 1111 余额"},
    ]
    with pytest.raises(Exception):
        _run(guardrail, messages)


def test_user_keyword_with_number_blocks(guardrail):
    messages = [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "本月支出合计 1234 元"},
    ]
    with pytest.raises(Exception):
        _run(guardrail, messages)


def test_user_amount_blocks(guardrail):
    messages = [{"role": "user", "content": "转账 ¥50,000 给供应商"}]
    with pytest.raises(Exception):
        _run(guardrail, messages)


def test_invalid_bank_card_passes(guardrail):
    """非 Luhn 合法号码不拦截(防误拦设计)。"""
    messages = [{"role": "user", "content": "查询银行卡 6222 0212 3456 7890 余额"}]
    _run(guardrail, messages)


def test_content_parts_format(guardrail):
    messages = [
        {"role": "system", "content": "预算 2026 年报"},
        {"role": "user", "content": [{"type": "text", "text": "你好"}]},
    ]
    _run(guardrail, messages)


def test_fallback_to_texts_without_messages(guardrail):
    """/guardrail/apply 直传 texts 场景保留原逻辑。"""
    with pytest.raises(Exception):
        asyncio.run(guardrail.apply_guardrail({"texts": ["报销 1000 元"]}, {}, "request"))
