# LiteLLM 产品功能发布清单

## 1 说明

本清单盘点了代码快照 v1.110.0 中已落地的功能，面向产品、销售与使用方，回答"这个版本有哪些能力"。功能状态基于代码中是否存在实现判断，而非发布计划。企业功能的状态以其是否位于 `enterprise/` 包并受 premium 门控为准。

功能状态定义如下。

| 状态 | 含义 |
|---|---|
| GA | 主干已实现，开源部署可直接用 |
| Enterprise | 位于企业包，需 premium license |
| Beta | 主干已实现但接口或行为可能仍在演进 |

## 2 版本信息

| 项 | 值 |
|---|---|
| 产品 | LiteLLM SDK + AI Gateway |
| 版本 | 1.110.0 |
| 运行形态 | Python SDK、FastAPI 网关、Next.js 管理后台 |
| Python 支持 | 3.10 至 3.15，推荐 3.12 |
| 构建 | maturin + Rust core |

## 3 功能总览

| 模块 | 功能数 | 状态 |
|---|---|---|
| 统一模型接入 | 多 provider、OpenAI 兼容归一化 | GA |
| API 兼容 | 多类 OpenAI 与厂商兼容端点 | GA |
| 路由与负载均衡 | 多种策略、fallback、冷却 | GA |
| 鉴权与访问控制 | Virtual Key、JWT、OAuth2、SSO | GA / Enterprise |
| 预算与限流 | 多主体预算、并发与速率限制 | GA |
| 成本追踪与归因 | 计算、预算扣减、批量落库 | GA |
| 缓存 | 响应缓存、多级缓存 | GA |
| 可观测性与审计 | 日志、指标、OTEL、审计导出 | GA / Enterprise |
| 流式响应 | SSE 归一化 | GA |
| 管理 API | key、team、user、org 等 CRUD | GA |
| 管理控制台 | Next.js UI | GA |
| 企业能力 | 高级鉴权、审计、secret 检测、通知 | Enterprise |

## 4 功能详情

### 4.1 统一模型接入

系统把任意厂商的 LLM API 归一化为 OpenAI 格式，SDK 与网关共享同一套请求与转换逻辑。入口为 `completion` 与 `acompletion`（`litellm/main.py:5508`、`:645`），响应统一为 `ModelResponse`（`types/utils.py:2402`）。provider 识别由 `get_llm_provider_logic.py:187` 的有序判定链完成，支持 model 前缀、显式 provider、api_base 端点与自定义 provider 注册。状态为 GA。

### 4.2 API 兼容端点

Gateway 暴露 OpenAI 兼容的 Chat Completions、Completions、Embeddings、Models 端点（`proxy_server.py:13194`、`:13347`、`:13552`、`:12766`）。另有厂商专属端点，Anthropic Messages（`proxy/anthropic_endpoints/`）、OpenAI Responses（`proxy/response_api_endpoints/`）、图像生成、批处理、文件、微调、rerank、向量存储与 passthrough 透传。完整目录映射见 `ARCHITECTURE.md:132`。状态为 GA。

### 4.3 路由与负载均衡

`Router`（`litellm/router.py:367`）支持 simple shuffle、least busy、lowest cost、lowest latency、lowest tpm/rpm、tag based routing 与 budget limiter 等策略（`router_strategy/`），默认 simple-shuffle。提供 fallback、重试与部署冷却，跨 key 与 team 的部署过滤由 `router_api.py:185` 与 `auth/model_checks.py:183` 完成。热点选择下沉到 Rust core（`router_api.py:1569`）。状态为 GA。

### 4.4 鉴权与访问控制

Virtual Key 鉴权，支持预算、模型权限与允许路由校验（`auth/user_api_key_auth.py:4407`、`auth/route_checks.py:148`），状态 GA。JWT 鉴权由 `auth/handle_jwt.py` 提供，状态 GA。OAuth2 由 `auth/oauth2_check.py` 提供，状态 GA。UI 登录与 SSO 端点在 `management_endpoints/ui_sso.py`，自定义 SSO handler 位于企业包，启用需 premium license，状态 Enterprise。

### 4.5 预算与限流

系统提供按 key、team、user 的预算控制，配合限流 hook 与 Redis 计数实现并发与速率限制（`proxy/hooks/parallel_request_limiter_v3.py`）。预算重置由后台任务定期执行，预留释放在中间件中完成（`proxy_server.py:3022`）。状态为 GA。

### 4.6 成本追踪与归因

成本由 `cost_calculator.py:1783` 计算，优先读取 provider 上报价格，否则按 token 乘价格。结果写入响应头 `x-litellm-response-cost`，经回调代扣预算并由 `DBSpendUpdateWriter`（`db_spend_update_writer.py:675`）批量落库。provider 专属 usage 字段以 Pydantic extras 搭载，遵循 ADR 001。状态为 GA。

### 4.7 缓存

提供 SDK 级 LLM 响应缓存（`caching/caching_handler.py`）与网关级 key、限流缓存。双层缓存 `DualCache` 组合本地内存与 Redis，支持响应缓存、TPM/RPM 跟踪与部署冷却。状态为 GA。

### 4.8 可观测性与审计

标准日志、Prometheus 指标（受鉴权保护，`proxy_server.py:2976`）、OTEL 追踪（`:1796`）、异步回调日志与周期花费告警均为 GA。审计日志的查询与导出端点位于企业包（`enterprise/litellm_enterprise/proxy/audit_logging_endpoints.py`），状态 Enterprise。

### 4.9 流式响应

SSE 流由 `CustomStreamWrapper`（`streaming_handler.py:409`）统一包装，逐块归一化并在结束时聚合为完整响应与成本。流式与非流式对上层呈现一致模型。状态为 GA。

### 4.10 管理 API

提供 key、team、organization、user、project、caching、analytics 等管理端点，集中挂载于 `proxy_server.py:22490` 到 `:22556`。状态为 GA，部分高级管理端点在企业包。

### 4.11 管理控制台 UI

Next.js 管理后台 `ui/litellm-dashboard/`，通过同源转发调用网关，提供可视化管理与监控界面。状态为 GA。另有代理托管的静态 UI 位于 `litellm/proxy/_experimental/out`。

### 4.12 企业能力

位于 `enterprise/` 包并通过 try import 可选挂载，缺失时降级为空路由（`proxy_server.py:1186` 到 `:1207`）。能力包括自定义 SSO、审计导出、禁用指定 LLM 或管理路由、secret detection、邮件与 PagerDuty 通知、managed files 与 vector stores 等。均由 premium license 门控，状态 Enterprise。

## 5 状态说明

GA 能力在开源主干中可直接启用，无需额外授权。Enterprise 能力需部署 `litellm-enterprise` 包并配置有效 license，缺失时相关路由为空，不影响开源功能。Beta 能力主干已实现，但接口或行为可能随版本演进，集成时应关注版本变化。

## 6 Provider 支持清单

支持的 provider 由 `LlmProviders` 枚举（`litellm/types/utils.py:4617`）与 `litellm.provider_list`（`__init__.py:2427`）定义，定价与别名由价格表维护。主要类别如下，具体名单以代码中的枚举为准。

| 类别 | 代表 provider |
|---|---|
| 直接 LLM API | OpenAI、Anthropic、Cohere、Gemini、Groq、Mistral、xAI 等 |
| 云托管 | AWS Bedrock、Azure OpenAI、Google Vertex AI、Azure AI 等 |
| 聚合网关 | OpenRouter 等 |
| 自托管与兼容 | OpenAI 兼容接口、Ollama、自定义 provider 等 |
| 能力型端点 | 图像、embedding、rerank、批处理、文件、微调等专用 provider |

OpenAI 兼容 provider 多数可通过 JSON 定义接入，无需新增代码。新增 provider 的步骤见 `DEVELOPER_TRAINING.md` 第 6.1 节。

## 7 已知限制

以下限制来自当前实现，使用前应知悉。

第一，reload 模式只运行单个 worker，启动时打印忽略 workers 标志的提示。需要多 worker 并发验证时必须关闭 reload 并配置共享 Redis。

第二，成本计算依赖价格表。provider 未上报成本且价格表无对应条目时，成本可能为零或不准确，需维护 `model_prices_and_context_window.json` 及备份。

第三，provider 专属 usage 字段必须以 extras 搭载。在流式聚合或端点桥接处重建 usage 时若未复制 extras，会导致部分 provider 成本算错，这是 ADR 001 明确约束的行为。

第四，企业能力在无 license 时不可用，相关管理端点为空路由。需要 SSO、审计导出、secret 检测等能力时必须部署企业包。

第五，数据库迁移只改 schema，任何数据回填需单独流程并显式标注，不在网关启动迁移中完成。
