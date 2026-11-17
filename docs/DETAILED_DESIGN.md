# LiteLLM 详细设计文档

## 1 文档说明

本文描述 LiteLLM 的详细技术设计，面向需要理解或修改系统内部实现的架构师与开发者。它回答系统由哪些子系统构成、每个子系统内部如何组织、关键流程如何流转、核心数据结构与接口如何定义、并发与容错如何处理。

本文与配套文档的分工如下。`ARCHITECTURE.md` 给出分层与请求流的高层视图，`DEVELOPER_TRAINING.md` 是上手培训，`TECHNICAL_SPECIFICATION.md` 定义对外契约与非功能要求，`RELEASE_FEATURES.md` 和 `PRODUCT_MANUAL.md` 面向产品与使用。本文聚焦实现层面的设计细节。

文中路径与行号基于代码快照 v1.110.0。设计决策的"为什么"记录在 `docs/adrs/`，本文只引用不重复。

## 2 系统上下文与总体设计

### 2.1 系统定位

LiteLLM 是一个统一的 LLM 接入层，提供两种使用形态。作为 SDK 时，它把任意厂商的 LLM API 归一化为 OpenAI 格式，供应用直接调用。作为 AI Gateway 时，它是一个独立部署的 FastAPI 服务，在 SDK 之上叠加鉴权、路由、限流、预算、成本追踪和管理能力。网关内部调用的就是 SDK，因此两种形态共享同一套请求与转换逻辑。

### 2.2 分层架构

系统自外向内分为四层。

| 层 | 主要位置 | 职责 |
|---|---|---|
| 接入层 | `litellm/proxy/` 的端点与中间件 | 暴露 OpenAI 兼容与管理 API，完成鉴权、限流、请求预处理 |
| 编排层 | `litellm/router.py`、`litellm/main.py`、`litellm/llms/custom_httpx/` | 模型选择、请求分发、HTTP 调用编排、错误归一化 |
| 转换层 | `litellm/llms/{provider}/chat/transformation.py` | 厂商格式与 OpenAI 格式的双向变换 |
| 数据层 | `litellm/models/`、`litellm/repositories/`、`schema.prisma` | 持久化实体定义、数据访问、数据库 schema |

Rust core 位于编排层之下，承担路由选择等性能敏感逻辑，经 maturin 编成 Python 扩展。企业能力作为可选包挂载在接入层。

### 2.3 部署视图

SDK 形态下，应用进程直接 import `litellm` 并调用 `completion`，无独立服务，无数据库依赖。网关形态下，需要部署 FastAPI 服务、PostgreSQL 与 Redis。PostgreSQL 保存 key、team、user、spend log 等实体，Redis 承担限流计数、key 缓存、spend 增量队列、TPM/RPM 跟踪、部署冷却与响应缓存。多 worker 部署时必须让所有 worker 指向同一个 Redis 与数据库，否则状态不一致。

### 2.4 关键设计原则

有几条原则贯穿整个设计，理解它们能解释大部分代码组织方式。

SDK 不依赖网关。数据层的 `models` 与 `repositories` 放在 `litellm/` 根目录而非 `proxy/` 下，网关和 SDK 都能使用。`proxy/_types.py` 只是再导出以保持旧 import 兼容（见 `ARCHITECTURE.md:250`）。

转换逻辑按 provider 隔离。每个 provider 的变换独立成文件，便于单独测试与修改。编排器统一调用转换层方法，开发者通常不需要改编排器（`ARCHITECTURE.md:371`）。

横切逻辑集中在两个收口点。SDK 侧是 `@client` 装饰器（`litellm/utils.py:2059`），网关侧是 `ProxyLogging` 加回调。日志、成本、预算、缓存在此汇聚，而不是散落在 provider 代码里。

企业能力可选挂载。企业包通过 try import 探测，缺失时挂空路由降级运行，开源部署无需企业包也能启动。

## 3 SDK 子系统设计

### 3.1 模块组成

SDK 由入口、解析、编排、转换、流式、成本六个模块组成，分别落在 `main.py`、`get_llm_provider_logic.py`、`llm_http_handler.py`、`llms/{provider}/chat/transformation.py`、`streaming_handler.py` 和 `cost_calculator.py`。

### 3.2 请求分发设计

公共入口是 `completion`（`main.py:5508`）与 `acompletion`（`main.py:645`）。一个关键设计点是同步 `completion` 才是主分发实现，异步 `acompletion` 是门面。异步版本在 `main.py:932` 到 `:944` 通过 `partial` 与 `run_in_executor` 把同步实现放进线程池，再 await 结果。这个选择让所有路由只需维护一份分发逻辑，同步与异步调用都会经过它。

`completion` 内部先校验请求并快照 kwargs，解析 provider 与别名，取 provider config，然后进入 `main.py:6413` 起的长分发链。每个分支是一个 `_complete_<provider>` 函数，负责组装该 provider 所需的参数并调用编排器或厂商 SDK。纯 HTTP 路径的 provider 直接调用 `base_llm_http_handler.completion(...)`。

分发链的公共尾部是 `@client` 装饰器。它处理 call id、预算检查、缓存、success 与 failure handler、metadata 收尾。任何 provider 的响应都会经过它，这保证了成本计算与日志的统一的入口。

### 3.3 Provider 解析设计

`get_llm_provider` 系列逻辑位于 `litellm_core_utils/get_llm_provider_logic.py:187`，返回四元组 `(model, provider, dynamic_api_key, api_base)`。解析是一个有序的判定链，顺序本身构成设计。

判定依次为 Azure 特例、cohere 与 anthropic 路由规范化、显式 `custom_llm_provider` 与 model 前缀合并、openrouter、JSON provider registry、`provider_list` 前缀拆分、已注册自定义 provider、按 `api_base` 匹配端点、已知模型名列表、`match_routing_generalization` 兜底。全部落空抛 `BadRequestError`。

模型别名在 `completion` 里通过 `litellm.model_alias_map` 提前改写（`main.py:5841`）。"最新模型"别名由 `model_latest_aliases.py:56` 基于成本表改写，这样模型升级时无需改调用方代码。扩展新 provider 时，应在判定链中选择合适位置插入识别规则，OpenAI 兼容的 provider 多数只需注册 JSON 定义。

### 3.4 HTTP 编排设计

编排器 `BaseLLMHTTPHandler` 位于 `llms/custom_httpx/llm_http_handler.py:710`，单例创建于 `main.py:388`。它封装了一次 LLM HTTP 调用的完整生命周期。`validate_environment` 校验环境变量，`get_complete_url` 拼 URL，调用转换层的 `transform_request`，`sign_request` 签名，写 `logging_obj.pre_call`，用 httpx 发请求并带超时与 stream 参数，再用 `transform_response` 归一化结果，最后触发 agentic hooks。

重试分两层。内层处理 422 错误，通过 `max_retry_on_unprocessable_entity_error` 与请求变形钩子调整请求后重试。外层由 `@client` 结合 `num_retries` 与 `max_retries` 承担。错误经 `_handle_error`（`:6691`）用 provider config 的 `get_error_class` 归一化为 litellm 异常，使上层无需感知厂商错误类型。

编排器被设计为不应被 provider 开发者修改。所有 provider 差异都通过 `BaseConfig` 的方法注入，这是"开闭原则"的直接体现。

### 3.5 转换层设计

转换层基类 `BaseConfig` 位于 `llms/base_llm/chat/transformation.py:91`。它定义一组抽象方法，构成 provider 适配的统一契约。

| 方法 | 职责 | 位置 |
|---|---|---|
| `transform_request` | 把 OpenAI 格式请求转为厂商格式 | `:371` |
| `transform_response` | 把厂商响应转为 `ModelResponse` | `:403` |
| `get_error_class` | 提供该 provider 的错误类型映射 | `:431` |
| `validate_environment` | 校验并注入 API key、base url 等环境配置 | `:304` |
| `get_complete_url` | 计算完整请求 URL | `:350` |
| `sign_request` | 对请求做厂商特定签名 | `:325` |
| `get_model_response_iterator` | 提供流式 chunk 解析器 | `:434` |
| `get_async_custom_stream_wrapper` | 自定义流式包装器钩子 | `:475` |

具体实现如 `OpenAIConfig`（`llms/openai/openai.py:132`）与 `AnthropicConfig`（`llms/anthropic/chat/transformation.py:593`）。注册通过 `litellm/utils.py:9852` 的 `ProviderConfigManager` 完成，查找入口 `get_provider_chat_config` 优先用 Python 类，找不到时回退到 JSON provider 定义。这种双轨设计让简单兼容 provider 可用配置声明接入，复杂 provider 用代码实现。

转换层被刻意设计为可独立单测，无需真实 API 调用，测试直接构造 Config 实例断言变换结果。

### 3.6 响应模型设计

统一响应模型定义在 `litellm/types/utils.py`，`Choices` 在 `:1795`，`Usage` 在 `:2035`，`StreamingChoices` 在 `:2198`，`ModelResponseBase` 在 `:2264`，`ModelResponse` 在 `:2402`。`ModelResponse` 构造函数会把 choices 归一化成 `Choices`、把 usage 归一化成 `Usage`（`:2423` 到 `:2452`），从而对上层屏蔽厂商差异。

`ModelResponseBase` 暴露 `hidden_params` 属性（`:2286`），这是成本与 provider 上报数据的搭载位置。这个约定被 ADR 001 约束，provider 专属的 usage 字段走 Pydantic extras 而非隐藏参数旁路。

### 3.7 流式设计

流式路径由三段组成。原始字节流由 `llms/custom_httpx/sse_lines.py:68` 的 `aiter_sse_lines` 切分，provider 的 chunk parser 把每段解析成 `ModelResponseStream`，基类分发在 `base_llm/chat/transformation.py:442`。这些 chunk 统一包进 `litellm_core_utils/streaming_handler.py:409` 的 `CustomStreamWrapper`，它实现 `__iter__` 与 `__aiter__`（`:544`、`:547`），在 `chunk_creator`（`:1798`）里逐块归一化、抽取 usage、写日志、跑规则钩子。流结束时由 `streaming_chunk_builder_utils.py:1803` 的 `stream_chunk_builder` 聚合成完整 `ModelResponse`，并把成本打回隐藏参数（`:1471`）。

这个设计让流式与非流式对上层呈现一致的响应模型，区别只在交付方式。

### 3.8 成本计算设计

成本计算在 `litellm/cost_calculator.py`。`cost_per_token`（`:490`）计算单位 token 成本，`completion_cost`（`:1783`）是主入口，`response_cost_calculator`（`:2502`）负责从响应中取成本。后者优先采用 provider 自己上报的成本（`:2582` 到 `:2611`），取不到时按 token 数乘价格计算（`:2613` 到 `:2634`）。

价格数据加载为 `litellm.model_cost`，远端源加本地备份 `model_prices_and_context_window_backup.json`。成本写入隐藏参数由 `response_metadata.py:275` 的 `update_response_metadata` 触发（`:175` 调 `logging_obj.response_cost_calculator`，`:189` 写 `_hidden_params["response_cost"]`）。ADR 001 要求成本计算器从 usage extras 读取 provider 专属计费字段，禁止在共享代码里按 provider 分支改名或重塑 usage。

## 4 网关子系统设计

### 4.1 模块组成

网关的事实总装文件是 `litellm/proxy/proxy_server.py`，约 947 KB。它集中了全局状态、app、中间件、生命周期、鉴权依赖、核心推理端点与管理端点。CLI 在 `proxy_cli.py`。鉴权在 `auth/`，公共请求处理在 `common_request_processing.py`，路由在 `route_llm_request.py`，花费落库在 `db/db_spend_update_writer.py`。这种"大文件总装"的组织方式意味着新增端点要先判断是加到总装文件还是独立模块再挂载。

### 4.2 App 与配置设计

FastAPI app 创建于 `proxy_server.py:2131`，`lifespan` 指向 `proxy_startup_event`。主 `APIRouter` 在 `:2601`，通过 `app.include_router(router)`（`:22489`）挂载，随后集中挂载几十个功能模块 router（`:22490` 到 `:22556`）。路由匹配有优先级要求，例如 `/chat/completions` 必须先于 `/completions`，由 `route_priority.py:17` 定义。

配置类 `ProxyConfig` 在 `:5921`。`get_config`（`:6561`）支持本地 YAML、GCS 与 S3 bucket、数据库 overlay 和 `os.environ/` 解析。配置分三段，各有明确职责。`model_list` 是部署清单，最终构造 Router（`:8087`）。`router_settings` 管策略、fallback、重试、超时，存于 `SettingsStore("router_settings")`（`:5952`）。`general_settings` 管 master key、数据库、callback、批量写和鉴权行为，存于 `SettingsStore("general_settings")`（`:5949`）。配置用 Pydantic 校验，模型定义在 `_types.py`，`ConfigYAML` 在 `:3191`，`ConfigGeneralSettings` 在 `:2504`，加载时校验见 `proxy_server.py:7208`。

### 4.3 路由与负载均衡设计

`Router` 对外类位于 `litellm/router.py:367`，大量方法通过 `__getattribute__` 委托给 core 接口（`router_core.py:27`），而 core 由 Rust 实现（`router_api.py:1215` 的 `RouterSettings`、`:1530` 的 `RoutingContext`、`:1569` 的 `select`）。这个包装设计让 Python 侧保持兼容 API，同时把热点选择逻辑下沉到 Rust。

路由策略实现在 `litellm/router_strategy/`，抽象基类在 `base_routing_strategy.py:18`，具体有 simple shuffle、least busy、lowest cost、lowest latency、lowest tpm/rpm、tag based routing 和 budget limiter，默认 simple-shuffle（`router.py:105`）。

proxy 侧入口是 `route_llm_request.py:755` 的 `route_request`，单次尝试在 `:801`。它读取 team 上下文、检查模型封禁、支持逗号分隔的多模型批量请求（`:839`），并在请求自带 api key 或 api base 时绕过 Router 直连（`:833`）。跨 key 与 team 的部署过滤在 `router_api.py:185` 与 `auth/model_checks.py:183`，team alias 在 `auth/team_grants.py:170`，key 的允许路由校验在 `auth/route_checks.py:148`。

### 4.4 鉴权设计

核心依赖是 `auth/user_api_key_auth.py:4407` 的 `user_api_key_auth`。流程为读取请求体、取 route、建 auth span、走 `user_api_key_auth_builder`（`:2239`）、调用 `_authorize_authenticated_request`（`:4470`）、把身份与 team、key 上下文写入请求（`:4484`）。端点通过 `Depends(user_api_key_auth)` 注入，例如 chat completions 在 `proxy_server.py:13175`。

鉴权方式分三类。Virtual Key 走数据库查询与缓存，带预算与模型权限检查，逻辑分散在 `user_api_key_auth.py` 与 `auth/auth_checks.py`。JWT 由 `auth/handle_jwt.py:233` 的 `JWTHandler` 与 `:1421` 的 `JWTAuthManager` 处理。UI 登录与 SSO 走 `auth/login_utils.py:228` 的 `authenticate_user`，端点在 `management_endpoints/ui_sso.py`，启用需 premium license，自定义 handler 在企业包。

### 4.5 生命周期与中间件设计

`proxy_startup_event`（`proxy_server.py:1586`）内的 `_proxy_lifespan`（`:1593`）定义启动顺序，这个顺序本身是设计约束。依次初始化 Prisma（`:1715`）、应用数据库迁移（`:1727`）、数据迁移（密码 scrypt `:1738`、agent grant `:1747`）、连 coordination Redis（`:1781`）与事务缓冲 Redis（`:1788`）、初始化日志与 OTEL（`:1796`）、注册后台调度（模型信息刷新 `:1937`、tracing `:1953`、telemetry `:1965`）。关闭时停调度、排空在途请求、关闭 aiohttp session、flush spend（`:1993` 到 `:2035`）。

中间件集中注册在 `:2961` 到 `:3027`，顺序为 CORS、Prometheus 鉴权、billable metrics、telemetry、预算预留释放、Redis batch、in-flight 计数、安全头、gzip。后台任务由 APScheduler 管理，包括每 60 秒 spend 刷盘、约 10 分钟预算重置、模型部署同步等，清单见 `ARCHITECTURE.md:221`。

### 4.6 请求处理流水线设计

一次推理请求的网关处理由 `common_request_processing.py:2343` 的 `ProxyBaseLLMRequestProcessing` 负责，入口 `base_process_llm_request`（`:3126`），主逻辑 `_process_llm_request`（`:3251`）。它先做 pre-call 处理（别名、预算、guardrail，`:3294`），再并行发起 during-call hook 审核与路由（`:3320` 到 `:3349`），调 `route_request` 进入 Router 与 SDK。响应返回后执行成功 hook（`:3602`）或失败 hook（`:3630`、`:4148`）。

这个设计把推理路径上的横切步骤收敛到一个类，新增 pre-call 或 post-call 行为时改这里，而不是改每个端点。

### 4.7 成本落库设计

成本从响应到数据库经历五步。公共处理类从隐藏参数取出成本并写进响应头 `x-litellm-response-cost`。success hook 触发 `proxy/hooks/proxy_track_cost_callback.py:417` 的 `async_log_success_event`，从标准 logging payload 取 `response_cost`（`:819`），扣减 key、team、user 预算并更新缓存（`:867`）。payload 构造把成本写成 `spend`（`spend_tracking_utils.py:944`）。`DBSpendUpdateWriter`（`db/db_spend_update_writer.py:675`）把增量写进 Redis 队列，`update_database`（`:704`）是单请求入口，`_batch_database_updates`（`:1287`）做聚合。后台任务每 60 秒 flush 到 Postgres（`:2039` 起）。

批量写是这个子系统的核心决策。spend log 量级巨大，逐条同步写会压垮数据库并拖慢请求，因此采用内存或 Redis 增量加批量提交的模式。

## 5 数据访问子系统设计

### 5.1 模型层

持久化实体的 Pydantic 定义位于 `litellm/models/`，包括 user（`user.py:19`）、token（`verification_token.py:16`）、team（`team.py:86`）、spend log（`spend_logs.py:16`）、budget、organization、end user、project 等。它们大多继承 `litellm/types/llms/base.py:9` 的 `LiteLLMPydanticObjectBase`，再向上是 `base_model.py:12` 的 `LiteLLMBaseModel`。按约定新模型应声明为 frozen。`proxy/_types.py` 再导出这些模型以保持旧 import 兼容。

### 5.2 仓储层设计

`BaseRepository(ABC, Generic[T])` 位于 `litellm/repositories/base_repository.py:42`，`T` 绑定 Pydantic `BaseModel`。抽象属性 `table`（`:59`）与 `model_class`（`:65`）由子类实现。`record_to_dict`（`:31`）统一 Prisma record、dict 与 model 的投影，`_to_model`（`:69`）做反向转换。

泛型 CRUD 提供 `find_by_id`（`:79`）、`find_many`（`:84`）、`find_many_in`（`:100`，分块规避 bind parameter 上限）、`create`（`:104`）、`update`（`:111`）、`delete`（`:116`）、`count`（`:121`）、`exists`（`:125`），以及唯一冲突判断 `is_unique_violation`（`:131`）。具体仓储如 `team_repository.py` 在此基础上加领域方法。

### 5.3 JSON 列与归档删除设计

Prisma 的 Json 列以字符串返回，仓储显式维护需序列化的字段集合，写时 `json.dumps`、读时 `json.loads`，见 `team_repository.py:123` 与 `:210`。列名与字段名不一致时由仓储双向翻译，不依赖 Pydantic 猜测。

删除采用归档后删除。`team_repository.py:302` 先补齐 `deleted_*` 字段，再在 `async with self._db.tx()` 事务内写归档行并删主表行。归档表携带 `deleted_at`、`deleted_by`、`deleted_by_api_key`、`litellm_changed_by`，保证计费与审计可追溯，事务保证原子性。数组字段追加用 Prisma 原子 `push` 避免读改写竞态，删除元素才退回读改写。

### 5.4 Prisma 与迁移设计

`schema.prisma` 在根目录是唯一来源，另有 `litellm/proxy/schema.prisma` 与 `litellm-proxy-extras/litellm_proxy_extras/schema.prisma` 两份副本必须同步。迁移由 `ci_cd/run_migration.py` 生成，临时数据库跑 migrate deploy 与 migrate diff 后写出 SQL。启动时 `proxy_cli.py:1666` 调 `PrismaManager.setup_database` 同步应用，实现在 `db/prisma_client.py:1060`。

迁移有一条硬约束，只允许改 schema，禁止 UPDATE、DELETE、MERGE、INSERT SELECT 等数据改写，因为迁移在对外服务前同步执行，大表上的数据操作会造成分钟级停机与翻倍堆内存。确需回填时用 `-- data-migration-ok: <理由>` 标注，检查逻辑在 `tests/code_coverage_tests/check_migrations_no_data_rewrites.py`。索引由迁移后作业构建。

## 6 缓存与状态设计

### 6.1 多级缓存

系统使用内存加 Redis 的双层缓存。`caching/dual_cache.py` 的 `DualCache` 把本地内存与 Redis 组合，命中本地则跳过网络。SDK 侧 `Router.cache` 是 `DualCache`，保存 TPM/RPM 跟踪、部署冷却、客户端缓存。网关侧 `proxy/utils.py` 的 `InternalUsageCache` 缓存 key 信息与限流计数。

### 6.2 Redis 的角色

Redis 承担六类状态。限流计数器、API key 缓存、spend 增量队列、TPM/RPM 跟踪、部署冷却、LLM 响应缓存，见 `ARCHITECTURE.md:178`。多 worker 部署时 Redis 是共享状态的唯一依据，必须所有 worker 指向同一实例。

### 6.3 PostgreSQL 的角色

PostgreSQL 保存需要持久化与审计的实体，key、team、user、spend log。它与 Redis 的分工是，Redis 放高频读写且可丢失的中间状态，Postgres 放最终一致的权威数据，spend 通过后台批量写从前者落到后者。

## 7 关键数据结构与接口定义

### 7.1 BaseConfig 契约

provider 适配必须实现 `transform_request`、`transform_response`、`get_error_class`，可选实现 `validate_environment`、`get_complete_url`、`sign_request`、`get_model_response_iterator`、`get_async_custom_stream_wrapper`。这组方法构成 SDK 与厂商之间的稳定边界，编排器只依赖它们。

### 7.2 BaseRepository 契约

仓储层通过泛型 `BaseRepository[T]` 提供统一 CRUD 形状，子类声明 `table` 与 `model_class` 即可获得基础能力。涉及 JSON 列、归档、加密、原子数组操作时覆写或新增领域方法。

### 7.3 hidden params 与 extras 契约

响应对象通过 `_hidden_params` 搭载成本与 provider 上报数据。provider 专属的 usage 字段作为 Pydantic extras 保留在 usage 对象上，不新建 typed 字段，不走旁路。所有重建 usage 的共享路径必须复制 extras。这是 ADR 001 的强制约束，目的是保证成本追踪在跨端点与流式场景下读数一致。

## 8 关键流程详述

### 8.1 推理请求端到端流程

请求进入网关中间件链，鉴权依赖校验 key 或 JWT 并写入身份上下文，公共处理类做 pre-call 与 hook 审核，`route_request` 经 Router 选部署，Router 调 `acompletion` 进入 SDK。SDK 解析 provider，编排器调用转换层发请求并归一化响应，`@client` 计算成本写入隐藏参数。响应回到网关，抽取成本写响应头，触发异步成功回调做预算扣减与 spend 排队，后台任务批量落库。完整时序见 `ARCHITECTURE.md:29`。

### 8.2 流式请求流程

SDK 侧 SSE 行切分后由 provider parser 生成 chunk，包进 `CustomStreamWrapper` 逐块归一化并写日志，结束时 `stream_chunk_builder` 聚合完整响应并回填成本。网关侧流式响应经同一条转换链，成本在流结束时确定。

### 8.3 成本归因流程

`response_cost_calculator` 优先读 provider 上报成本，否则按 token 乘价格。结果写入隐藏参数，网关回调读取后代扣预算并排队，60 秒周期批量写 Postgres。provider 专属计费字段经 usage extras 传递，由成本计算器或共享 gate 读取。

### 8.4 鉴权流程

`user_api_key_auth` 读取请求体与 route，构造 auth builder，查缓存或数据库拿到 key 信息，校验预算、模型权限与允许路由，写入 team 与 key 上下文后放行。JWT 与 SSO 走各自 handler，企业功能额外检查 premium 门控。

## 9 并发、线程与多进程模型

SDK 的异步 API 用线程池包装同步实现，因此线程安全依赖同步路径的无状态性，provider config 实例应尽量无可变状态。网关部署支持多 worker，每个 worker 是独立进程，共享状态全靠 Redis 与 Postgres。运维上必须保证 coordination Redis 与 router settings 指向同一实例，否则限流与预算计数会各自为政。

一个已知约束是 uvicorn reload 模式只跑一个 worker，启动时会打印忽略 workers 标志的提示。需要并发验证时必须去掉 reload 并用多 worker 加共享 Redis 的配置。

## 10 错误处理与容错设计

错误归一化由编排器的 `_handle_error`（`llm_http_handler.py:6691`）完成，用 provider config 的 `get_error_class` 把厂商异常转为 litellm 异常，上层只处理统一类型。容错手段分三层。请求内 422 变形重试处理格式问题，`num_retries` 与 `max_retries` 处理瞬时失败，Router 的 fallback 与部署冷却处理持续故障的策略性切换。

## 11 扩展点设计

系统提供四类扩展点。新 provider 通过 `BaseConfig` 子类加注册接入。新 hook 通过实现 `CustomLogger` 并注册到 `PROXY_HOOKS` 接入（`ARCHITECTURE.md:155`）。新 API 端点通过 router 挂载或独立模块挂载。企业功能通过企业包加 premium 门控接入，缺失时降级为空路由。

## 12 安全设计

鉴权是默认要求，推理端点通过依赖注入强制校验。密钥不落日志，环境变量由 `validate_environment` 管理。SSO 与 JWT 为可选增强，需 premium license 的自定义 handler 在企业包。路由权限由 `LiteLLMRoutes` 枚举与 `route_checks.py` 控制，key 只能访问允许的路由与模型。ADR 001 禁止为追踪目的篡改字段，也间接保护了响应 schema 不被旁路破坏。

## 13 设计决策与约束

设计决策记录在 `docs/adrs/`，目前 ADR 001 规定 provider 专属 usage 字段以 Pydantic extras 搭载，成本追踪从 extras 读取，禁止在共享代码里按 provider 分支改名或重塑 usage。涉及端点间数据流的新决策必须先读 ADR，必要时在同 PR 新增。迁移只改 schema 的约束见第 5.4 节。类型与风格约束见 `TECHNICAL_SPECIFICATION.md`。

## 14 质量保障设计

测试分 unit 与 e2e 两层，unit 镜像源码路径并在进程内运行，e2e 用真实 proxy 与真实 provider。新功能要求能杀死变异的回归测试，目标变异杀死率高于 90%。五个门禁比较分支与 merge-base 的违规计数，任何规则不许增长，详见 `TECHNICAL_SPECIFICATION.md` 与 `DEVELOPER_TRAINING.md` 第七章。
