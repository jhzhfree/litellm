"""财务数据防外泄护栏（Financial Data Guardrail）。

目的：阻止用户在与大模型交互时，把财务数据（银行卡号、金额、财务报表数字等）
发送给外部模型提供商。请求在 pre_call 阶段被检查，命中规则时直接返回 400，
请求不会离开网关，从而保证敏感财务数据不出站。

配置示例（proxy_config.yaml）::

    guardrails:
      - guardrail_name: "financial-data-guard"
        litellm_params:
          guardrail: enterprise.financial_guardrail.FinancialDataGuardrail
          mode: "pre_call"
          default_on: true            # 默认对所有请求生效
          action: block               # block=拦截 / monitor=仅记录放行
          detect_bank_cards: true     # 银行卡号（含 Luhn 校验）
          detect_financial_amounts: true            # 金额模式（¥/$/元/万元...）
          detect_financial_keywords_with_numbers: true  # 财务关键词+数字组合

检测原理见 docs/guardrails-financial-data.md。
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import TYPE_CHECKING, Final, Literal, Optional

from fastapi import HTTPException
from typing_extensions import TypedDict, Unpack

from litellm.integrations.custom_guardrail import CustomGuardrail, log_guardrail_information
from litellm.types.guardrails import GuardrailEventHooks
from litellm.types.utils import GenericGuardrailAPIInputs, GuardrailStatus

if TYPE_CHECKING:
    from litellm.litellm_core_utils.litellm_logging import Logging as LiteLLMLoggingObj


class _CustomGuardrailOptions(TypedDict, total=False, extra_items=object):
    """Base-class constructor options this guardrail forwards untouched to CustomGuardrail."""


# ---------------------------------------------------------------------------
# 检测规则（与 UI/文档中的说明保持一致）
# ---------------------------------------------------------------------------

# 1. 银行卡号：13-19 位数字（允许空格/连字符分隔），通过 Luhn 校验才算命中，
#    避免把普通长数字（订单号、手机号等）误判为银行卡。
#    注意：不能用 \b 词边界——Python 的 \w 包含中文，"卡号4111...查余额" 中
#    数字与汉字相邻处没有词边界会导致漏检；改用数字环视（前后不能还是数字）。
_BANK_CARD_RE: Final[re.Pattern[str]] = re.compile(r"(?<![0-9])(?:\d[ -]?){13,19}\d(?![0-9])")

# 2. 金额模式：货币符号/单位 + 数字，或 数字 + 货币单位。
#    覆盖：¥1,234.56 / ￥12,345 / $1,000 / 5000 元 / 3.2 万元 / RMB 800 / 1.2 亿
_AMOUNT_RE: Final[re.Pattern[str]] = re.compile(
    r"(?:[¥￥$€£]|USD|CNY|RMB|EUR|GBP)\s*[\d,]+(?:\.\d+)?"
    r"|[\d,]+(?:\.\d+)?\s*(?:万?元|万元|亿元|亿美元|美元|人民币|块钱)"
    r"|[\d.]+\s*(?:万|亿)(?:元)?"
)

# 3. 财务关键词：出现下列词 + 文本中同时存在具体数字（≥3 位或带小数/千分位）时命中。
#    纯概念性讨论（如"什么是复式记账法"）不含数字，不会误伤。
_FINANCIAL_KEYWORDS: Final[tuple[str, ...]] = (
    "工资", "薪资", "薪酬", "待遇", "财报", "财务报表", "营收", "营业额",
    "利润", "毛利", "净利", "预算", "成本", "报价", "标底", "发票",
    "税率", "税额", "报销", "汇款", "转账", "对公账户", "回款",
    "应收", "应付", "资产负债", "审计", "决算", "花销", "支出",
)

_NUMBER_RE: Final[re.Pattern[str]] = re.compile(r"\d[\d,]{2,}(?:\.\d+)?|\d+\.\d+")


def _luhn_ok(candidate: str) -> bool:
    """对去分隔符后的数字串做 Luhn 校验。"""
    digits = re.sub(r"[ -]", "", candidate)
    if not digits.isdigit() or len(digits) < 13 or len(digits) > 19:
        return False
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


class FinancialDetection(TypedDict):
    rule: str
    matched: str


class FinancialDataGuardrail(CustomGuardrail):
    """拦截包含财务数据的请求（pre_call），保证财务数据不发送给外部模型。"""

    def __init__(
        self,
        guardrail_name: str | None = None,
        action: Literal["block", "monitor"] = "block",
        detect_bank_cards: bool = True,
        detect_financial_amounts: bool = True,
        detect_financial_keywords_with_numbers: bool = True,
        block_message: str = "请求中包含财务数据（银行卡号/金额/财务报表信息），已被网关拦截，禁止发送给外部模型。",
        event_hook: Literal["pre_call", "post_call", "during_call"] | list[str] | None = None,
        default_on: bool = False,
        **kwargs: Unpack[_CustomGuardrailOptions],
    ) -> None:
        _event_hook: GuardrailEventHooks | list[GuardrailEventHooks] | None = None
        if event_hook is not None:
            if isinstance(event_hook, list):
                _event_hook = [GuardrailEventHooks(h) if isinstance(h, str) else h for h in event_hook]
            else:
                _event_hook = GuardrailEventHooks(event_hook)
        self.action = action
        self.detect_bank_cards = detect_bank_cards
        self.detect_financial_amounts = detect_financial_amounts
        self.detect_financial_keywords_with_numbers = detect_financial_keywords_with_numbers
        self.block_message = block_message
        super().__init__(
            guardrail_name=guardrail_name or "financial-data-guard",
            supported_event_hooks=[GuardrailEventHooks.pre_call, GuardrailEventHooks.post_call],
            event_hook=_event_hook or GuardrailEventHooks.pre_call,
            default_on=default_on,
            **kwargs,
        )

    # ------------------------------------------------------------------
    # 检测逻辑
    # ------------------------------------------------------------------
    def _scan_text(self, text: str) -> list[FinancialDetection]:
        detections: list[FinancialDetection] = []
        if self.detect_bank_cards:
            for m in _BANK_CARD_RE.finditer(text):
                if _luhn_ok(m.group(0)):
                    detections.append({"rule": "bank_card", "matched": m.group(0)})
                    break
        if self.detect_financial_amounts:
            m = _AMOUNT_RE.search(text)
            if m:
                detections.append({"rule": "financial_amount", "matched": m.group(0)})
        if self.detect_financial_keywords_with_numbers:
            if _NUMBER_RE.search(text) and any(kw in text for kw in _FINANCIAL_KEYWORDS):
                detections.append({"rule": "financial_keyword_with_number", "matched": ""})
        return detections

    def _raise_block_error(self, detections: list[FinancialDetection]) -> None:
        rules = "、".join(sorted({d["rule"] for d in detections}))
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "message": self.block_message,
                    "type": "financial_data_guard",
                    "param": None,
                    "code": "400",
                    "litellm_guardrail_name": self.guardrail_name,
                    "litellm_guardrail_rules": rules,
                }
            },
        )

    # ------------------------------------------------------------------
    # 统一护栏入口（基类在 pre_call/post_call 自动调用）
    # ------------------------------------------------------------------
    @log_guardrail_information
    async def apply_guardrail(
        self,
        inputs: GenericGuardrailAPIInputs,
        request_data: dict[str, object],
        input_type: Literal["request", "response"],
        logging_obj: Optional["LiteLLMLoggingObj"] = None,
    ) -> GenericGuardrailAPIInputs:
        start_time: Final = datetime.now()
        status: GuardrailStatus = "success"
        try:
            texts: Final = inputs.get("texts", [])
            if not texts:
                return inputs

            all_detections: list[FinancialDetection] = []
            for text in texts:
                if not isinstance(text, str) or not text:
                    continue
                all_detections.extend(self._scan_text(text))

            if all_detections and self.action == "block" and input_type == "request":
                self._raise_block_error(all_detections)

            return inputs
        except HTTPException:
            status = "guardrail_intervened"
            raise
        except Exception:
            status = "guardrail_failed_to_respond"
            raise
        finally:
            _ = start_time, status
