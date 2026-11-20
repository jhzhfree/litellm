# 财务数据防外泄护栏配置说明

> 产品：AI治理网关（AI-GovernanceGw）
> 功能：用户使用大模型时，禁止将财务数据发送给外部模型。
> 实现方式：AI治理网关 自定义护栏（Custom Guardrail），`pre_call` 阶段拦截。

---

## 1. 原理

### 1.1 请求处理链路

```
客户端请求
    |
    v
+-------------------------------------------------------------+
|  AI治理网关（litellm proxy）                                 |
|                                                             |
|  (1) 鉴权（API Key / 会话）                                  |
|  (2) pre_call 护栏钩子  <-- 财务数据检测在这里执行            |
|        |- 命中规则 -> 返回 400，请求终止（不出站）            |
|        |- 未命中   -> 继续往下                               |
|  (3) 路由到外部模型提供商（DeepSeek/OpenAI/...）             |
+-------------------------------------------------------------+
```

**关键点**：护栏工作在 `pre_call`（请求发往外部模型**之前**）阶段。命中规则的
请求直接在网关被拒绝（HTTP 400），**原始内容不会出现在任何出站请求里**——这是
"财务数据不发送给外部模型"的根本保证。与之相对的 `post_call` 只能处理模型响应，
`during_call` 是流式并行检查，均无法保证数据不出站。

### 1.2 检测规则（三层，可独立开关）

| 规则 | 触发条件 | 示例 | 误报控制 |
|---|---|---|---|
| `bank_card` | 13-19 位数字（允许空格/连字符分隔），且通过 **Luhn 校验** | `4111 1111 1111 1111` | Luhn 算法过滤订单号、手机号等普通长数字 |
| `financial_amount` | 货币符号/单位与数字组合 | `¥12,345.67`、`月薪 25,000 元`、`营收 1.2 亿` | 必须伴随货币符号或货币单位 |
| `financial_keyword_with_number` | 财务关键词 + 同文本中存在具体数字（≥3 位或带小数） | `工资 8500`、`Q4 成本 35000` | 纯概念讨论不含数字，不误伤 |

财务关键词表（内置，可在 `enterprise/financial_guardrail.py` 的
`_FINANCIAL_KEYWORDS` 中扩展）：工资、薪资、薪酬、待遇、财报、财务报表、营收、
营业额、利润、毛利、净利、预算、成本、报价、标底、发票、税率、税额、报销、
汇款、转账、对公账户、回款、应收、应付、资产负债、审计、决算、花销、支出。

### 1.3 执行时机与对象

- **扫描范围**：请求的全部 `messages`（含 system/user/assistant 历史），覆盖
  `/chat/completions`、`/completions` 等文本入口。
- **动作**（`action` 参数）：
  - `block`（默认）：命中即拒绝，返回 400；
  - `monitor`：只记录日志放行，用于灰度观察误报率后再切 block。
- 如需同时扫描模型响应（防止把模型生成的财务汇总再外发），可将 `mode` 改为
  `["pre_call", "post_call"]`；本配置默认只开 `pre_call`。

---

## 2. 配置方法

### 2.1 护栏代码

文件：`enterprise/financial_guardrail.py`（随镜像分发，容器内路径
`/app/enterprise/financial_guardrail.py`）。

类：`FinancialDataGuardrail`，基于 AI治理网关 `CustomGuardrail` 基类的统一
`apply_guardrail` 接口。

### 2.2 配置文件写法（proxy_config.yaml）

```yaml
guardrails:
  - guardrail_name: "financial-data-guard"
    litellm_params:
      # 自定义护栏：拦截含财务数据的请求，保证财务数据不发送给外部模型
      guardrail: enterprise.financial_guardrail.FinancialDataGuardrail
      mode: "pre_call"          # 请求发往外部模型前拦截
      default_on: true          # 默认对所有模型请求生效
      action: block             # block=拦截(400) / monitor=仅记录放行
      detect_bank_cards: true                 # 银行卡号（Luhn 校验）
      detect_financial_amounts: true          # 金额模式（¥/$/元/万元/亿）
      detect_financial_keywords_with_numbers: true  # 财务关键词+数字组合
```

参数说明：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `guardrail_name` | `financial-data-guard` | 护栏名称，日志与错误信息中展示 |
| `guardrail` | 必填 | 加载路径 `<模块路径>.<类名>`，网关到 `enterprise/` 目录加载 |
| `mode` | 必填 | `pre_call`（请求前，推荐）/ `post_call` / `during_call` |
| `default_on` | `false` | **必须设 true** 才对所有请求生效；false 时仅请求体带 `guardrails: ["financial-data-guard"]` 才触发 |
| `action` | `block` | `block` 拦截 / `monitor` 只记录 |
| `detect_bank_cards` | `true` | 银行卡号检测（Luhn 校验） |
| `detect_financial_amounts` | `true` | 金额模式检测 |
| `detect_financial_keywords_with_numbers` | `true` | 财务关键词+数字检测 |
| `block_message` | 见代码 | 拦截时返回给用户的提示语 |

**灰度上线建议**：先 `action: monitor` 观察几天日志（`docker logs ai-tokengw-core | grep financial-data-guard`），确认无误报后切换 `action: block` 并重启。

### 2.3 生效方式

- 修改 `proxy_config.yaml` 后重启网关容器：`docker compose restart ai-tokengw-core`
  （本地开发环境 `--reload` 自动生效）。
- 护栏对**所有调用方**生效（虚拟密钥、UI Playground、直连 API），无需逐 Key 配置。

---

## 3. 测试用例与验证结果

验证环境：本地网关（`--port 4001 --reload`），真实请求 `POST /chat/completions`。

### 3.1 应拦截用例

| # | 输入内容 | 命中规则 | 结果 |
|---|---|---|---|
| T1 | `帮我核对这张卡的账单 4111 1111 1111 1111 有没有异常` | `bank_card` | **400 拦截** |
| T2 | `把这个月工资单发给供应商：员工张三 月薪 25,000 元` | `financial_amount` | **400 拦截** |
| T3 | `请分析：公司 Q4 营收 ¥12,345,678.90，利润下滑` | `financial_amount` | **400 拦截** |

拦截响应体（T1 实测，关键部分）：

```json
{
  "error": {
    "message": "请求中包含财务数据（银行卡号/金额/财务报表信息），已被网关拦截，禁止发送给外部模型。",
    "code": "400",
    "provider_specific_fields": {
      "error": {
        "litellm_guardrail_name": "financial-data-guard",
        "litellm_guardrail_rules": "bank_card"
      }
    }
  }
}
```

前端可根据 `provider_specific_fields.error.litellm_guardrail_name` 识别"被护栏拦截"，
向用户展示友好提示。

### 3.2 应放行用例

| # | 输入内容 | 结果 | 说明 |
|---|---|---|---|
| T4 | `什么是复式记账法？` | 通过护栏 | 纯概念问题，无数字 |
| T5 | `我们公司的财务部门有多少人？` | 通过护栏 | 财务词但无具体数值 |

放行用例实测返回 500，原因是本地验证环境上游模型（deepseek-flash）不可达，
**请求已通过护栏到达模型路由层**——证明护栏未误拦。生产环境模型可达时将正常返回。

### 3.3 复验命令（部署后可直接执行）

```bash
MK=<你的master key 或虚拟密钥>
BASE=http://<网关地址>:4000

# 应拦截（期望 400）
curl -s -o /dev/null -w "%{http_code}\n" $BASE/chat/completions \
  -H "Authorization: Bearer $MK" -H "Content-Type: application/json" \
  -d '{"model":"<模型名>","messages":[{"role":"user","content":"核对这张卡 4111 1111 1111 1111 的账单"}]}'

# 应放行（期望非 400）
curl -s -o /dev/null -w "%{http_code}\n" --max-time 30 $BASE/chat/completions \
  -H "Authorization: Bearer $MK" -H "Content-Type: application/json" \
  -d '{"model":"<模型名>","messages":[{"role":"user","content":"什么是复式记账法？"}]}'
```

---

## 4. 运维要点

- **日志**：拦截事件在网关日志中以 `financial-data-guard` / `guardrail_intervened`
  出现；`monitor` 模式下所有命中都记录但不拦截。
- **误报处理**：若某类正常业务文本被误拦，优先用 `monitor` 模式收集样本，然后：
  - 收窄 `_FINANCIAL_KEYWORDS`（去掉误报关键词）；或
  - 调整 `_NUMBER_RE`（要求更严格的数字形态）。
- **漏报处理**：新增财务词直接加进 `_FINANCIAL_KEYWORDS`；新增模式（如社保号、
  合同编号）在 `_scan_text` 中加正则。
- **升级护栏代码**：修改 `enterprise/financial_guardrail.py` 后需重新构建镜像并
  升级 22.6（文件打包在镜像内，不是挂载卷）。
- **注意**：`default_on: false` 时护栏不生效（除非请求显式指定），请勿随意关闭。
