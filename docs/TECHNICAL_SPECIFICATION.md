# LiteLLM 技术规格说明书

## 1 范围

本说明书规定 LiteLLM 的技术要求、对外接口契约、数据格式、非功能要求与工程约束，面向技术评审、集成方与质量保证。凡本文使用"必须"、"不得"、"应当"、"可以"，分别对应强制要求、禁止要求、推荐要求与可选要求。

本文描述的对象是代码快照 v1.110.0 的两种使用形态，作为 SDK 的 Python 库与作为 AI Gateway 的 FastAPI 服务。实现层面的设计理由见 `DETAILED_DESIGN.md`，上手步骤见 `DEVELOPER_TRAINING.md`。

## 2 规范性引用

| 引用 | 用途 |
|---|---|
| `pyproject.toml` | 依赖、Python 版本、入口点、构建后端的权威定义 |
| `schema.prisma` 及两份副本 | 数据库 schema 的唯一来源 |
| `docs/adrs/` | 架构决策，含 usage 字段处理规则 |
| 根目录 `AGENTS.md` | 工程硬约束，风格、门禁、迁移、PR 规范 |
| `ruff.toml`、`ruff-strict.toml`、`pyrightconfig.json` | lint 与类型检查规则 |
| `.github/workflows/test-unit.yml` | CI 分片与测试要求的权威定义 |

## 3 术语与约定

| 术语 | 定义 |
|---|---|
| SDK | `litellm` Python 包，提供统一的 LLM 调用 API |
| Gateway 或 Proxy | 基于 FastAPI 的独立服务，在 SDK 之上提供治理能力 |
| Provider | LLM 厂商或其兼容接口 |
| Deployment | `model_list` 中的一个具体模型部署条目 |
| Virtual Key | 网关签发的、携带预算与权限的 API key |
| hidden params | 响应对象 `_hidden_params` 中搭载的内部字段 |
| extras | Pydantic 模型上未显式声明但保留的字段 |

要求级别词汇按 RFC 2119 语义使用。本报告所有路径为仓库相对路径，行号基于 v1.110.0。

## 4 系统要求

### 4.1 运行环境

Python 版本必须满足 `>=3.10,<3.16`（`pyproject.toml:6`）。CI 与开发统一使用 3.12，唯一例外是 `lens-python-310` 分片用 3.10。前端 Node 版本必须不低于 24.14.1。

### 4.2 依赖与构建

包管理必须使用 uv，锁文件为 `uv.lock`，`required-version` 不低于 0.10.9。Workspace 成员包括 `enterprise`、`litellm-proxy-extras`、`packaging/litellm-proxy`。构建后端是 maturin，把 Rust bridge 编成 `litellm.rust_bridge._native`（`pyproject.toml:327`）。

数据库迁移依赖 prisma，通过 `make bootstrap` 或 `make install-test-deps` 一次性安装并 generate。SDK 形态仅需核心依赖，Gateway 形态需 `proxy` extra 及数据库、Redis 等外部服务。

### 4.3 外部依赖

Gateway 形态必须提供 PostgreSQL 保存 key、team、user、spend log。多 worker 部署必须提供共享 Redis 承担限流计数、key 缓存、spend 队列、TPM/RPM、部署冷却与响应缓存。单 worker 开发可用 dev_config.yaml 配合环境变量启动，不强制 Redis。

## 5 接口规范

### 5.1 OpenAI 兼容 API

Gateway 必须暴露 OpenAI 兼容端点，路径与处理函数如下（`proxy_server.py`）。

| 端点 | 路径 | 处理函数位置 |
|---|---|---|
| Chat Completions | `/v1/chat/completions`、`/chat/completions`、Azure 与 Engines 兼容路径 | `:13194` |
| Completions | `/v1/completions` 等 | `:13347` |
| Embeddings | `/v1/embeddings`、`/embeddings` 等 | `:13552` |
| Models | `/v1/models`、`/models` | `:12766` |

此外必须支持一组 LLM 专属端点，其目录映射见 `ARCHITECTURE.md:132`，包括 `/v1/messages`（`proxy/anthropic_endpoints/`）、`/v1/responses`（`proxy/response_api_endpoints/`）、`/v1/images/*`、`/v1/batches`、`/v1/files`、`/v1/fine_tuning`、`/v1/rerank`、`/v1/vector_stores` 以及 passthrough 端点。

路由匹配必须遵守优先级约束，例如 `/chat/completions` 必须先于 `/completions` 匹配，定义见 `litellm/proxy/route_priority.py:17`。

### 5.2 管理 API

Gateway 必须提供 key、team、organization、user 等管理端点，集中通过 `app.include_router` 挂载（`proxy_server.py:22490` 到 `:22556`）。管理端点必须纳入鉴权与路由权限控制，定义见 `auth/route_checks.py` 与 `_types.py` 的 `LiteLLMRoutes` 枚举。

所有新增 POST 端点必须在 `app.openapi()` 中具备 request body schema、description 与 200 response schema，由 OA 门禁强制检查。

### 5.3 SDK 公共 API

SDK 必须通过 `litellm/__init__.py` 的 `from .main import *`（`:1414`）导出 `completion`、`acompletion`、`embedding` 等 API。`Router` 必须可从 `litellm` 直接导入。`completion` 是主分发实现（`main.py:5508`），`acompletion`（`:645`）为其异步门面，二者行为必须一致。

响应必须符合统一模型 `ModelResponse`（`litellm/types/utils.py:2402`），其 choices 与 usage 必须归一化为 `Choices`（`:1795`）与 `Usage`（`:2035`）。流式响应必须包装为 `CustomStreamWrapper`（`streaming_handler.py:409`）。

### 5.4 错误响应格式

厂商错误必须经编排器 `_handle_error`（`llm_http_handler.py:6691`）用 provider config 的 `get_error_class` 归一化为 litellm 异常类型。解析失败且无法推断 provider 时必须抛 `BadRequestError`（`get_llm_provider_logic.py:577`）。上层调用方不得依赖厂商原始错误类型。

## 6 配置规范

### 6.1 配置文件结构

配置必须是 YAML，由 `ProxyConfig.get_config`（`proxy_server.py:6561`）加载，支持本地文件、GCS、S3、数据库 overlay 与 `os.environ/` 解析，并支持 `include` 合并。

配置必须包含三个主要段，各自职责如下。`model_list` 是模型部署清单，每项含 model_name、litellm_params、model_info，最终构造 Router。`router_settings` 定义 routing strategy、fallback、retry、超时。`general_settings` 定义 master key、数据库 URL、callback、批量写与鉴权行为。

### 6.2 字段约束

配置必须通过 Pydantic 校验，模型为 `_types.py:3191` 的 `ConfigYAML`、`ConfigGeneralSettings`（`:2504`）及 router 设置模型（`:1921`）。CLI 必须支持 `--validate_config` 在启动时校验（`proxy_cli.py:1315`）。general settings 的加载时校验见 `proxy_server.py:7208`。

### 6.3 启动参数

`proxy_cli.py:892` 的 `run_server` 必须支持 `--host`、`--port`、`--num_workers`、`--config`、`--reload`、`--detailed_debug`、`--validate_config`，以及 gunicorn、hypercorn、granian 运行时开关。`--detailed_debug` 生效于 `:1727`，调用 `litellm.turn_on_debug()`。

当启用 reload 时，系统只运行单个 worker 并打印忽略 workers 标志的提示，此行为需在部署文档中说明。多 worker 必须配合共享 Redis。

## 7 数据规范

### 7.1 实体定义

持久化实体的权威 Pydantic 定义必须位于 `litellm/models/`，包括 user、verification token、team、spend log、error log、budget、organization、end user、project 等。`proxy/_types.py` 可再导出以保持兼容。新实体必须继承 `LiteLLMPydanticObjectBase`（`types/llms/base.py:9`）并声明为 frozen。

### 7.2 数据库 schema

权威 schema 是根目录 `schema.prisma`，`litellm/proxy/schema.prisma` 与 `litellm-proxy-extras/litellm_proxy_extras/schema.prisma` 两份副本必须与之完全一致。任何 schema 改动必须同步三处。

### 7.3 序列化规范

Prisma Json 列以字符串返回，仓储必须在写时 `json.dumps`、读时 `json.loads`，并显式维护需序列化的字段集合（`repositories/team_repository.py:123`、`:210`）。字段名与列名不一致时由仓储双向翻译。

### 7.4 删除与审计规范

可删除实体必须采用归档后删除，在同一事务内写 `LiteLLM_Deleted*` 归档表并删主表（`repositories/team_repository.py:302`）。归档记录必须包含 `deleted_at`、`deleted_by`、`deleted_by_api_key`、`litellm_changed_by`。

### 7.5 Spend log 规范

每次 LLM 调用必须产生一条花费记录，字段包括 spend、模型、token 用量、key、team、user 等。成本值由 `response_cost_calculator`（`cost_calculator.py:2502`）计算，写入 `response._hidden_params["response_cost"]`，经回调与 payload 构造（`spend_tracking_utils.py:944`）最终由 `spend_log_insert.py:68` 批量插入 `LiteLLM_SpendLogs`。

## 8 性能规格

系统必须采用批量写降低数据库压力。spend 增量先写内存或 Redis，`DBSpendUpdateWriter`（`db_spend_update_writer.py:675`）按周期批量提交 Postgres，后台任务 `update_spend` 每 60 秒刷盘一次。关键路径的批量聚合在 `:1287`，flush 在 `:2039`。

系统必须使用多级缓存降低延迟。`DualCache` 组合本地内存与 Redis，Router 缓存 TPM/RPM 与部署冷却，网关 `InternalUsageCache` 缓存 key 与限流计数。

路由热点选择由 Rust core 实现（`router_core.py:27`、`router_api.py:1569` 的 `select`），Python 侧通过包装类委托，以降低选择开销。

## 9 可靠性与可用性规格

系统必须提供三层容错。请求内 422 错误经请求变形后重试，瞬时失败由 `num_retries` 与 `max_retries` 重试，持续故障由 Router 的 fallback 与部署冷却做策略性切换。默认路由策略为 simple-shuffle（`router.py:105`）。

启动流程必须同步应用数据库迁移后再对外服务（`proxy_cli.py:1666`、`prisma_client.py:1060`）。关闭时必须排空在途请求并 flush spend（`proxy_server.py:1993`）。

## 10 安全规格

推理与管理端点必须默认鉴权，通过 `Depends(user_api_key_auth)` 注入（`user_api_key_auth.py:4407`）。Virtual Key 必须校验预算、模型权限与允许路由（`auth/route_checks.py:148`、`auth/model_checks.py:183`）。JWT 与 SSO 为可选增强，自定义 SSO handler 与企业功能需 premium license 门控（`management_endpoints/ui_sso.py:5124`）。

密钥必须通过环境变量提供并由 `validate_environment` 管理，不得写入日志或版本库。报错不得泄露厂商原始凭据信息。响应 schema 不得为追踪目的被改名或重塑，这是 ADR 001 的安全相关约束。

## 11 可观测性规格

系统必须在请求生命周期写入标准 logging payload，记录模型、token、成本、延迟与状态。日志与 OTEL 在启动时初始化（`proxy_server.py:1796`）。异步回调通过 `ProxyLogging`（`proxy/utils.py:1942`）触发，成本回调为 `proxy_track_cost_callback.py:417` 的 `async_log_success_event`。

响应必须携带成本头 `x-litellm-response-cost`。系统必须暴露 Prometheus 指标端点并受鉴权保护（`proxy_server.py:2976`）。后台任务与定时报告如每周、每月花费告警由 APScheduler 管理，清单见 `ARCHITECTURE.md:221`。

## 12 兼容性规格

### 12.1 协议兼容

Gateway 必须兼容 OpenAI Chat Completions、Completions、Embeddings、Models API，并提供 Anthropic Messages、OpenAI Responses 等兼容端点。厂商差异由转换层吸收，上层看到统一格式。

### 12.2 Provider 兼容

Provider 支持矩阵由 `litellm.provider_list`（`__init__.py:2427`）与 `LlmProviders` 枚举（`types/utils.py:4617`）定义，定价与别名由价格表维护。新增 provider 通过 `BaseConfig` 子类或 JSON provider 定义接入。完整的 provider 清单见 `RELEASE_FEATURES.md` 第 6 节。

### 12.3 Python 与运行时兼容

SDK 必须支持 Python 3.10 至 3.15。网关运行时支持 uvicorn、gunicorn、hypercorn、granian，由 CLI 开关选择。

## 13 工程约束

### 13.1 代码风格

Python 行宽必须为 120（`ruff.toml:29`）。类型检查必须为 basedpyright strict（`pyrightconfig.json:12`），且 `enableTypeIgnoreComments` 为 false，禁止使用 `# type: ignore`。任何抑制必须写明规则名与理由，例如 `# pyright: ignore[reportArgumentType]  # <reason>`。

禁止使用 `Any`、`List`、`Dict`、`Set`、`cast`、`TypeGuard`、`TypeIs`，由 `ruff-strict.toml:48` 的 TID251 与 LIT 系列规则拦截。注解中禁止可变集合类型（LIT001），应使用 `tuple`、`frozenset`、`MappingProxyType` 等不可变构造。非类型化数据必须在调用方用 Pydantic 或 `TypeAdapter` 校验成类型化对象后再传递。

### 13.2 迁移约束

数据库迁移只允许改 schema，禁止数据行改写语句，见第 7.2 节与 `DETAILED_DESIGN.md` 第 5.4 节。检查由 `tests/code_coverage_tests/check_migrations_no_data_rewrites.py` 强制。

### 13.3 文档约束

涉及端点之间数据流的新决策必须先读 `docs/adrs/` 并在同 PR 新增 ADR。新增 POST 端点必须带 OpenAPI 文档，见第 5.2 节。

## 14 质量门禁

`make check` 必须执行五个门禁，共同规则是比较分支与 merge-base 的违规计数，任何规则不得增长。

| 门禁脚本 | 约束 |
|---|---|
| `scripts/ruff_strict_gate.py` | ruff strict 违规不增长 |
| `scripts/type_discipline_gate.py` | LIT001 至 LIT015 不增长 |
| `scripts/type_check_gate.py` | basedpyright 逐 rule error 不增长 |
| `scripts/test_quality_gate.py` | TQ001 至 TQ009 不增长 |
| `scripts/openapi_docs_gate.py` | OA001 至 OA003 满足 |

`reportAny` 与 `reportExplicitAny` 为特例，共享 `scripts/type_check_gate.py:96` 的固定上限 `ANY_CAPS`，分别为 6150 与 1440，按全仓总量卡，只允许在指向默认分支的独立 PR 下调低，禁止功能分支调高。

门禁持有机器级槽位，默认 2 个，等待时应保持长超时而非终止进程，槽位数量不得修改。完整日志写入 `.git/pre_commit_lint.log`。

## 15 测试与验收标准

单元测试必须位于 `tests/unit/` 并镜像 `litellm/` 路径，进程内运行，不访问网络，不依赖当前时间与执行速度，使用依赖注入而非 mock 自身代码。多输入用 parametrize，同一性判断用 `is`。新增测试目录必须在 `.github/workflows/test-unit.yml` 的某分片 test-path 中显式列出，并通过 `tests/unit/test_assert_ci_coverage.py` 的覆盖检查。

端到端测试必须位于 `tests/e2e/`，使用真实 proxy 与真实 provider，新增目录须在 `tests/e2e/AGENTS.md` 登记。

新功能与 bug 修复必须配备能杀死对应变异的回归测试，目标变异杀死率高于 90%。涉及真实网关行为的改动必须提供 live proxy 前后证明，简单机械改动可申请 E2E 例外并记录 commit SHA 与范围。

一项功能满足以下全部条件方可视为完成，行为测试通过且能锁死回归、五个门禁不增长、新目录被 CI 分片认领、POST 端点有 OpenAPI 文档、必要时有 live e2e 证明。
