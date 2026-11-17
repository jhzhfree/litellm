# LiteLLM 开发者培训手册

这份手册面向刚接触本仓库的开发者，目标是让你在最短时间内建立正确的整体认知，理解请求在系统中的真实流转，并能独立完成后四类常见工作，加 provider、加端点、加持久化实体、修 bug。

阅读顺序建议按章节来。第一章建立心智模型，第二章把环境跑起来，第三章和第四章分别拆开 SDK 与网关两条主链，第五章补上数据层和架构约束，第六章是可直接照做的操作手册，第七章是让代码能进主干的质量规则，第八章做速查。

本手册不替代权威文档。`ARCHITECTURE.md` 是分层与请求流的权威说明，`CONTRIBUTING.md` 是贡献流程，`LOCAL_DEV.md` 是本机联调，`docs/adrs/` 记录了那些"为什么这样设计"的决策。遇到本手册与这些文档冲突时，以权威文档和源码为准，并顺手修正本手册。

## 第一章 心智模型，先看清整体

### 1.1 这是一个什么项目

LiteLLM 不是一个单一程序，而是一个多语言单体仓库，由四块拼成，理解每块的边界是读懂一切的前提。

| 层 | 位置 | 职责 |
|---|---|---|
| SDK | `litellm/` | 把不同厂商的 LLM API 统一成 OpenAI 格式，负责请求变换、HTTP 调用、响应归一化和流式处理 |
| AI Gateway | `litellm/proxy/` | 一个 FastAPI 服务，在 SDK 之上叠加鉴权、限流、预算、路由和管理端点 |
| Rust core | `litellm-rust/` | 路由与部分性能敏感逻辑的 Rust 实现，经 maturin 编成 `litellm.rust_bridge._native` |
| 管理后台 | `ui/litellm-dashboard/` | Next.js 管理界面，通过同源转发调用网关 |

网关自己不实现 LLM 调用，它内部用的就是 SDK。所以你会看到同一个请求先经过 `proxy/`，再进入 `litellm/`，最后才到厂商 API。这条链是本仓库一切讨论的骨架。

```
客户端 -> AI Gateway(proxy/) -> SDK(litellm/) -> LLM Provider
       鉴权/限流/预算/路由       变换/调用/归一化     厂商真实 API
```

### 1.2 一次请求的完整旅程

记住这条链，后面每个章节都是在放大其中的一段。以 `POST /v1/chat/completions` 为例。

1. FastAPI 的中间件链先跑，处理 CORS、指标、预算预留、限流计数等，注册点在 `litellm/proxy/proxy_server.py:2961`。
2. `chat_completion` 端点接收请求，函数定义在 `litellm/proxy/proxy_server.py:13194`，通过 `Depends(user_api_key_auth)` 注入鉴权。
3. `user_api_key_auth` 校验 Virtual Key 或 JWT，查缓存和数据库，写入 key、team、org 上下文，定义在 `litellm/proxy/auth/user_api_key_auth.py:4407`。
4. 请求进入公共处理类 `ProxyBaseLLMRequestProcessing`，做 pre-call 处理，如别名、预算、guardrail，再调用 `route_request`，见 `litellm/proxy/common_request_processing.py:3251`。
5. `route_request` 交给 Router 选一个可用部署，见 `litellm/proxy/route_llm_request.py:755` 和 `litellm/router.py:367`。
6. Router 调用 `litellm.acompletion`，进入 SDK。
7. SDK 解析 provider，经 HTTP 编排器调用 `BaseConfig.transform_request`，发出请求，再用 `transform_response` 把厂商格式转回 `ModelResponse`。
8. 响应回到 `@client` 装饰器，计算成本并写入 `response._hidden_params["response_cost"]`。
9. 网关从隐藏参数取出成本放进响应头 `x-litellm-response-cost`，同时触发异步成功回调，把花费排队写进 Redis，再由后台任务每 60 秒批量刷进 Postgres。

这条链上有两个关键的"收口点"。一个是 SDK 侧的 `@client` 装饰器，另一个是网关侧的 `ProxyLogging` 加回调。大部分横切逻辑，日志、成本、预算、缓存，都聚在这两处，而不是散落在 provider 代码里。

### 1.3 代码地图

根目录下一级目录的职责，先混个脸熟。

| 目录 | 职责 |
|---|---|
| `litellm/` | SDK 与网关的全部源码，核心中的核心 |
| `litellm/proxy/` | FastAPI 网关，主文件是 `proxy_server.py` 和 `proxy_cli.py` |
| `litellm/llms/` | 每个 provider 一个子目录，放请求与响应的转换层 |
| `litellm/models/` `litellm/repositories/` | 持久化实体的 Pydantic 定义与数据访问层 |
| `litellm-rust/` | Rust 核心与 Python bridge |
| `enterprise/` | 商业许可代码，独立 workspace 包 `litellm-enterprise` |
| `litellm-proxy-extras/` | 独立 workspace 包，承载数据库迁移等 |
| `tests/` | 测试套件，`unit` 镜像源码路径，`e2e` 是真实网关加真实 provider |
| `ui/` | Next.js 管理后台 |
| `docs/adrs/` | 架构决策记录 |
| `scripts/` | 构建、linter 门禁、prisma 生成等工程脚本 |
| `pyproject.toml` `uv.lock` `Makefile` | 依赖、锁文件、开发命令入口 |
| `schema.prisma` | 数据库 schema 的唯一来源，另有两份副本必须同步 |

### 1.4 依赖方向

一个重要的设计原则是 SDK 不依赖网关。`litellm/models/` 和 `litellm/repositories/` 放在 `litellm/` 根目录而不是 `proxy/` 下，就是为了让网关和 SDK 都能用它们，而不需要 import 网关内部实现。`proxy/_types.py` 只是把 models 再导出一次以保持旧 import 可用，见 `ARCHITECTURE.md:250`。

企业代码走另一条路。它在独立的 `enterprise/` 包里，网关通过可选 import 加 `except ImportError` 的方式挂载，没装企业包时挂一个空路由，服务照常降级运行。这个模式在第五章细讲。

## 第二章 开发环境，从零到能跑

### 2.1 工具链

先确认本机具备这些条件。Python 版本约束写在 `pyproject.toml:6`，是 `>=3.10,<3.16`，但 CI 和日常开发统一用 3.12，建议你也用 3.12 以免遇到分片差异。包管理用 uv，锁文件是 `uv.lock`，虚拟环境默认 `.venv`。数据库迁移用 prisma，前端用 Node 24.14 以上。

### 2.2 一键配置

新克隆仓库后，在根目录执行 `make bootstrap`。这个 target 定义在 `Makefile:91`，一次性完成 `uv sync`，安装 proxy 与 e2e 依赖组，运行 prisma generate，以及前端 npm install，并复用已有的 `.env`。如果你只想装 Python 开发依赖，用 `make install-dev`。

### 2.3 启动后端

根目录执行下面这条命令即可启动开发网关。

```bash
python litellm/proxy/proxy_cli.py --config litellm/proxy/dev_config.yaml --port 4000 --detailed_debug --reload
```

`dev_config.yaml` 已配好模型列表，API key 走环境变量。启动时 prisma 迁移会同步应用。单 worker 足够日常联调。多 worker 需要 `--num_workers 2` 并把 `router_settings` 和 `general_settings.coordination_redis` 指向同一个专用 Redis，否则多个进程之间不共享路由状态和预算计数。

QA 场景请用带共享 Redis 的双 worker 配置，完整命令和注意事项见 `AGENTS.md` 的 QA 章节。

### 2.4 启动前端

```bash
cd ui/litellm-dashboard
LENS_DEV_PROXY_URL=http://127.0.0.1:4000 npm run dev -- -H 0.0.0.0 -p 3000
```

`LENS_DEV_PROXY_URL` 必须设置。设置后 `next.config.mjs` 才会启用 rewrites，把带 `Accept: application/json` 的请求转发到 4000 端口，并切到 server 模式。不设置则走纯静态导出，无法联调。前端 `.env.development` 里的 `NEXT_PUBLIC_BASE_URL` 留空，让 API 全走同源转发。打开 `http://localhost:3000` 即可。注意代理托管的 UI 是 `litellm/proxy/_experimental/out` 下的旧静态产物，和 3000 端口的 dev server 是两套。

### 2.5 命令速查

| 你想做的事 | 命令 |
|---|---|
| 装依赖 | `make bootstrap` 或 `make install-dev` |
| 跑全部单元测试 | `make test-unit`，展开是 `uv run --no-sync pytest tests/unit -x -vv -n 4` |
| 跑单个测试 | `uv run --no-sync pytest tests/unit/<path>/test_x.py -vv` |
| 精确跑一个用例 | 在路径后加 `::test_name` |
| 跑 linter | `make lint` |
| 跑完整预提交检查 | `make check`，`make pre-commit` 是等价旧别名 |
| 格式化 | `make format` |

`make check` 会把完整日志写到 `.git/pre_commit_lint.log` 并在首末两行打印路径。检查失败时直接读这个日志，不要盲目重跑整套。多个会话同时跑门禁时会争抢机器级槽位，默认只有 2 个，此时命令会打印排队信息后静默等待，给它足够长的超时，别杀进程，也别改槽位数量。

## 第三章 SDK 内核，逐层拆解

这一章把第一章第 7 步放大。SDK 的职责是把任意厂商的 API 变成统一的 OpenAI 格式，核心难点在于变换和归一化。

### 3.1 入口，completion 与 acompletion 的真实关系

两个入口都在 `litellm/main.py`。`acompletion` 定义在 `main.py:645`，`completion` 定义在 `main.py:5508`。

一个容易搞反的事实是，`completion` 才是主分发实现，`acompletion` 是异步门面。异步版本在 `main.py:932` 到 `:944` 用 `partial` 加 `run_in_executor` 把同步 `completion` 丢进线程池，再 await 结果。所以你在 `completion` 里加的逻辑，同步和异步两条路都会走到。

`completion` 内部先做请求校验和 kwargs 快照，然后解析 provider，在 `main.py:6413` 起进入一长串按 provider 分发的 `if/elif`，每个分支调用一个 `_complete_<provider>` 函数。这些分支的公共尾部是 `@client` 装饰器，定义在 `litellm/utils.py:2059`，它统一处理 call id、预算、缓存、success 和 failure handler，以及 metadata 收尾。

### 3.2 provider 解析

`get_llm_provider` 定义在 `litellm/litellm_core_utils/get_llm_provider_logic.py:187`，返回四元组 `(model, provider, dynamic_api_key, api_base)`。它的推断顺序值得记住，因为加新 provider 时要决定插在哪一步。

它先看 Azure 特例，再规范化 cohere 和 anthropic 路由，接着合并显式传入的 `custom_llm_provider` 与 model 前缀，然后依次尝试 openrouter、JSON provider registry、`provider_list` 前缀拆分、已注册的自定义 provider、根据 `api_base` 匹配端点、已知模型名列表，最后用 `match_routing_generalization` 兜底。全部落空才抛 `BadRequestError`。模型别名由 `litellm.model_alias_map` 在 `completion` 里提前改写，`main.py:5841`。"最新模型"别名则由 `model_latest_aliases.py:56` 基于成本表改写。

一个实用判断，如果新 provider 完全兼容 OpenAI 协议，多数情况下只需注册成 JSON provider 或加一条前缀规则，不必写新的分发函数和转换类。

### 3.3 HTTP 编排器

编排器是 `litellm/llms/custom_httpx/llm_http_handler.py:710` 的 `BaseLLMHTTPHandler`，单例在 `main.py:388`。关键方法有 `completion`、`async_completion` 和流式相关的 `acompletion_stream_function`。

它统一做了这些事，`validate_environment` 校验环境变量， `get_complete_url` 拼 URL，调用转换层的 `transform_request`，`sign_request` 签名，写 `logging_obj.pre_call`，用 httpx 发请求并带上超时和 stream，再用 `transform_response` 归一化结果，最后触发 agentic hooks。内层还处理 422 错误的重试和请求变形，外层重试由 `@client` 负责。错误统一经 `_handle_error` 用 provider config 的 `get_error_class` 转成 litellm 异常。

这里有一条重要的工程约定，`ARCHITECTURE.md:371` 明确写着，编排器统一调用转换层的方法，你通常不需要修改编排器本身。加 provider 的改动应落在转换层。

### 3.4 转换层

每个 provider 有一个 `Config` 类，继承 `litellm/llms/base_llm/chat/transformation.py:91` 的 `BaseConfig`。基类定义了一组抽象方法，`transform_request`、`transform_response`、`get_error_class`，以及可选的 `validate_environment`、`sign_request`、`get_complete_url` 和若干流式钩子。

两个具体例子。OpenAI 的实现在 `llms/openai/openai.py:132` 的 `OpenAIConfig`，`transform_response` 会调用 `convert_to_model_response_object` 把字典转成统一响应对象。Anthropic 的实现在 `llms/anthropic/chat/transformation.py:593` 的 `AnthropicConfig`。

这些 Config 通过 `litellm/utils.py:9852` 的 `ProviderConfigManager` 注册，查找入口是 `get_provider_chat_config`，优先用 Python 类，找不到时回退到 JSON provider 定义。

转换层的设计目标是可独立单测，不需要真的发 API 请求。你直接构造 `Config` 实例，喂给它消息和参数，断言变换结果即可。

### 3.5 响应模型与流式

统一响应模型都在 `litellm/types/utils.py`，`Choices` 在 `:1795`，`Usage` 在 `:2035`，`ModelResponse` 在 `:2402`。`ModelResponse` 的构造函数会把 choices 和 usage 归一化成统一类型。

流式响应的路径稍长。provider 的 chunk 由各自的 iterator 解析，基类分发在 `base_llm/chat/transformation.py:442`，然后统一包进 `litellm/litellm_core_utils/streaming_handler.py:409` 的 `CustomStreamWrapper`。它负责逐块归一化、抽取 usage、写日志、跑规则钩子。流结束时由 `streaming_chunk_builder_utils.py:1803` 的 `stream_chunk_builder` 聚合成完整的 `ModelResponse`，成本也在这一步打回隐藏参数。

### 3.6 成本归因

成本计算在 `litellm/cost_calculator.py`，核心函数是 `completion_cost` 在 `:1783`，`response_cost_calculator` 在 `:2502`。后者优先采用 provider 自己上报的成本，取不到时再按 token 数乘价格计算。

价格数据来自远端 JSON，加载为 `litellm.model_cost`，离线时回退到仓库里的 `litellm/model_prices_and_context_window_backup.json`。根目录的 `model_prices_and_context_window.json` 是相关的数据来源之一。

写入链路是这样的。`@client` 调用 `response_metadata.py:275` 的 `update_response_metadata`，后者在 `:175` 触发 `logging_obj.response_cost_calculator`，结果写进 `result._hidden_params["response_cost"]`。网关侧再从隐藏参数取出，进入第四章的落库流程。

## 第四章 Proxy 网关，逐层拆解

这一章把第一章第 1 到第 6 步以及第 8、9 步放大。

### 4.1 启动流程

CLI 入口是 `litellm/proxy/proxy_cli.py:892` 的 click command，实际函数是 `run_server`，签名在 `:1229`。常用参数有 `--host`、`--port`、`--num_workers`、`--config`、`--reload`、`--detailed_debug`、`--validate_config`，以及 gunicorn、hypercorn、granian 的开关。

`run_server` 会读取 `CONFIG_FILE_PATH` 并调用 `ProxyConfig().get_config(...)`，把配置拆成 `litellm_settings` 和 `general_settings` 等部分，见 `:1415` 到 `:1452`。它最终用 `from litellm.proxy.proxy_server import app` 拿到 ASGI app，在 `:1829` 调用 `uvicorn.run` 启动。`--reload` 走 `configure_dev_reload`，多 worker 或未启用 reload 的分支在 `:1804` 到 `:1828` 处理。

需要留意一个真实约束，本版本的 uvicorn reload 只跑一个 worker，启动时会打印 `"workers" flag is ignored when reloading is enabled`。所以带 `--reload` 时不要指望双 worker，做并发验证时要去掉 reload。

### 4.2 app、配置与路由组织

本版本没有 `proxy_app.py` 或 `proxy_config.py`，app 和 `ProxyConfig` 都集中在 `litellm/proxy/proxy_server.py`。app 创建在 `:2131`，`lifespan` 指向 `proxy_startup_event`。主 `APIRouter` 在 `:2601`，最后通过 `app.include_router(router)` 在 `:22489` 挂上，紧接着集中挂载几十个功能模块 router，见 `:22490` 到 `:22556`。

配置类 `ProxyConfig` 在 `:5921`。YAML 读取走 `_get_config_from_file` 在 `:6014`，用 `yaml.safe_load`，支持 `include` 合并，总入口 `get_config` 在 `:6561`，支持本地文件、GCS 和 S3 等 bucket、数据库 overlay 以及 `os.environ/` 解析。配置分三段。`model_list` 是模型部署清单，最终构造 Router。`router_settings` 管路由策略、fallback、重试、超时。`general_settings` 管 master key、数据库 URL、callback、批量写和鉴权行为。配置模型用 Pydantic 校验，定义在 `litellm/proxy/_types.py`，`ConfigYAML` 在 `:3191`，`ConfigGeneralSettings` 在 `:2504`。

OpenAI 兼容端点直接定义在 `proxy_server.py`。chat completions 的多个兼容路径在 `:13173` 到 `:13194`，embeddings 在 `:13528`，models 在 `:12766`。另外有一批 LLM 专属端点分散在各子目录，比如 Anthropic Messages 在 `proxy/anthropic_endpoints/`，Responses API 在 `proxy/response_api_endpoints/`，完整清单见 `ARCHITECTURE.md:132` 的表格。路由匹配有优先级要求，例如 `/chat/completions` 必须先于 `/completions`，见 `litellm/proxy/route_priority.py:17`。

### 4.3 路由与负载均衡

对外暴露的 `Router` 在 `litellm/router.py:367`，大量方法通过 `__getattribute__` 委托给 core。策略实现在 `litellm/router_strategy/`，包括 simple shuffle、least busy、lowest cost、lowest latency、lowest tpm/rpm、tag based routing 和 budget limiter，默认策略是 simple-shuffle。

proxy 侧调用入口是 `route_request`，定义在 `litellm/proxy/route_llm_request.py:755`。它会读取 team 信息、检查模型封禁、处理逗号分隔的多模型批量请求，并在请求自带 api key 或 api base 时绕过 Router 直连。跨 key 和 team 的可用部署过滤分别在 `router_api.py:185` 和 `auth/model_checks.py:183`，key 的允许路由校验在 `auth/route_checks.py:148`。

### 4.4 鉴权

核心依赖是 `litellm/proxy/auth/user_api_key_auth.py:4407` 的 `user_api_key_auth`。主流程是读取请求体、取出 route、建 auth span、走 `user_api_key_auth_builder`、授权、最后把身份和 team、key 上下文写进请求。Virtual Key 的数据库查询、缓存、预算和模型权限检查分散在 `user_api_key_auth.py` 和 `auth/auth_checks.py`。JWT 相关逻辑在 `auth/handle_jwt.py`，OAuth2 在 `auth/oauth2_check.py`。

UI 登录和 SSO 是另一套。router 在 `proxy/management_endpoints/ui_sso.py`，登录校验在 `auth/login_utils.py:228`，启用 SSO 需要 premium license，自定义 SSO handler 位于企业包。

### 4.5 生命周期与中间件

lifespan 从 `proxy_server.py:1586` 的 `proxy_startup_event` 开始。启动时依次初始化 Prisma、应用数据库迁移、做若干数据迁移、连接 coordination Redis 和事务缓冲 Redis、初始化日志与 OTEL，然后注册一堆后台调度任务，包括模型信息刷新、tracing、telemetry、每 60 秒的 spend 刷盘、预算重置等。关闭时停调度、排空在途请求、关闭 aiohttp session、flush spend，见 `:1993` 到 `:2035`。

中间件集中注册在 `:2961` 到 `:3027`，包括 CORS、Prometheus 鉴权、billable metrics、telemetry、预算预留释放、Redis 批量处理、in-flight 计数、安全头和 gzip。

### 4.6 成本如何落库

这是第一章第 9 步的展开。响应回到网关后，公共处理类抽取隐藏参数里的成本，success hook 触发 `proxy/hooks/proxy_track_cost_callback.py:417` 的 `async_log_success_event`，它从标准 logging payload 里取 `response_cost`，扣减 key、team、user 的预算并更新缓存，见 `:819` 到 `:903`。

真正的数据库写入由 `litellm/proxy/db/db_spend_update_writer.py:675` 的 `DBSpendUpdateWriter` 完成。它的模式是先写内存或 Redis 增量，再批量提交 Postgres。单请求入口是 `update_database` 在 `:704`，批量聚合在 `:1287`，flush 与 daily spend 提交在 `:2039` 以后。后台任务 `update_spend` 每 60 秒刷一次。这个设计的原因很直接，spend log 数据量巨大，逐条写库会把数据库压垮。

## 第五章 数据层、企业包与架构决策

### 5.1 模型与仓储

持久化实体的 Pydantic 定义放在 `litellm/models/`，比如 user 在 `models/user.py:19`，token 在 `models/verification_token.py:16`，team 在 `models/team.py:86`，spend log 在 `models/spend_logs.py:16`。它们大多继承 `litellm/types/llms/base.py:9` 的 `LiteLLMPydanticObjectBase`。按仓库约定，新模型应声明为 frozen。

数据访问层在 `litellm/repositories/`。`litellm/repositories/base_repository.py:42` 的 `BaseRepository(ABC, Generic[T])` 提供泛型 CRUD，`find_by_id`、`find_many`、`find_many_in`、`create`、`update`、`delete`、`count`、`exists`。具体实体仓储继承它并加领域方法，`team_repository.py` 是个好参考。

仓储层有两处约定要特别记住。第一，Prisma 的 Json 列以字符串返回，仓储自己维护需要序列化的字段集合，写时 `json.dumps`，读时 `json.loads`，见 `team_repository.py:123` 和 `:210`。第二，删除采用归档后删除。以 team 为例，`team_repository.py:302` 先补齐 `deleted_*` 字段，再在 `async with self._db.tx()` 事务里同时写归档行并删主表行。这样做是为了保留计费、审计和操作者信息，且两个动作必须原子化。数组字段的追加要用 Prisma 的原子 `push` 避免竞态，删除元素才退回读改写。

### 5.2 Prisma 与迁移铁律

`schema.prisma` 在根目录，是唯一来源。另有两份副本必须与它同步，`litellm/proxy/schema.prisma` 和 `litellm-proxy-extras/litellm_proxy_extras/schema.prisma`。

生成迁移用 `ci_cd/run_migration.py`，命令形如 `uv run --with testing.postgresql python ci_cd/run_migration.py "your_migration_name"`。脚本会起临时数据库，跑 `prisma migrate deploy` 和 `prisma migrate diff`，再写出 `migration.sql`，并检查分支是否新鲜、拒绝破坏性 DDL。网关启动时由 `proxy_cli.py:1666` 调用 `PrismaManager.setup_database` 同步应用迁移，实现在 `litellm/proxy/db/prisma_client.py:1060`。

迁移有一条铁律，只能改 schema，不能改写数据行。`UPDATE`、`DELETE`、`MERGE`、`INSERT ... SELECT` 都被禁止，因为迁移在服务对外提供服务之前同步执行，在 spend log 这种量级的表上做这些操作会造成分钟级停机和翻倍堆内存。确有边界清晰的回填时，才允许在 SQL 里标注 `-- data-migration-ok: <理由>`。检查逻辑在 `tests/code_coverage_tests/check_migrations_no_data_rewrites.py`。索引也一律由迁移后的作业构建，不在迁移里建。

### 5.3 企业包如何降级挂载

企业代码在独立的 `enterprise/` workspace 包里。网关在 `proxy_server.py:1186` 到 `:1207` 用 try import 的方式探测企业包，导入失败就把 `enterprise_proxy_config` 设为 `None`，而 `:22552` 依旧会 `app.include_router(enterprise_router)`，只是此时它是空路由。这样开源部署完全不需要企业包也能正常启动。

企业功能通过 license 里的 `premium_user` 门控。SSO 的启用检查、自定义 SSO handler、审计导出与查询、禁用某些 LLM 或管理路由、secret detection、邮件与 PagerDuty 等都在企业包。如果你要做的功能属于企业级，代码应放在 `enterprise/litellm_enterprise/proxy/` 下，并按这个模式接入，而不是塞进主干再靠开关隐藏。

### 5.4 ADR 001 与 usage extras

`docs/adrs/` 目前只有一条决策记录，但它约束了一类很容易踩坑的改动。`adr_001_provider_usage_fields_ride_as_usage_extras.md` 讲的是 provider 专属 usage 字段的处理规则。

背景是不同厂商会在 usage 里塞自己的字段，比如 xAI 的 `web_search_calls` 或 Anthropic 的 `inference_geo`，成本追踪必须读到它们才能正确计费，而同一个响应会跨多个端点和流式路径。决策是把这些字段作为 Pydantic extras 留在 usage 对象上，由成本计算器或共享 gate 读取，共享的重建路径要统一复制 extras，禁止在共享代码里按 provider 分支去改名、删除或重塑字段，也不走旁路。

对开发者的实际影响是，当你在流式聚合或端点桥接处重建 usage 时，务必把 extras 带上，否则某些 provider 的成本会算错。涉及端点之间数据流的新决策，请先读 ADR，必要时在同一个 PR 里新增 ADR。

## 第六章 动手，四类典型任务的操作手册

这一章把前面所有知识变成可照做的步骤。

### 6.1 加一个新 provider

按这个顺序改。

1. 在 `litellm/types/utils.py:4617` 的 `LlmProviders` 枚举加值，并在 `litellm/__init__.py` 的 `provider_list` 附近加前缀，同时导出新的 Config 类。
2. 在 `get_llm_provider_logic.py` 里加模型名列表、`model.startswith("xxx/")` 前缀识别，或 `api_base` 端点识别。如果只是 OpenAI 兼容协议，注册成 JSON provider 或 provider map 即可，可以跳过后面的分发和转换。
3. 在 `main.py` 加一个 `_complete_<provider>` 函数，参考 `:1473` 起的写法，并在 `:6413` 起的分发链加分支。纯 HTTP 路径直接调 `base_llm_http_handler.completion(...)`，参考 `_complete_opencode_go` 在 `:2333`。
4. 新建 `litellm/llms/<provider>/chat/transformation.py`，继承 `BaseConfig`，实现 `transform_request`、`transform_response`、`get_error_class`。需要流式就加 chunk iterator，必要时覆写 `get_async_custom_stream_wrapper`。若走厂商 SDK 则另加 `handler.py`。
5. 在 `litellm/utils.py:9859` 的 `ProviderConfigManager._build_provider_config_map()` 注册新 Config。
6. 在 `model_prices_and_context_window.json` 加定价与别名条目，否则成本算不出来。
7. 补测试和文档。测试放 `tests/` 下对应 provider 位置，测试命名跟随所在目录惯例，provider 目录常用 `test_<provider>_chat_transformation.py` 这类较长的名字。

### 6.2 加一个新的 API 端点

先判断它是管理端点还是新的 LLM 推理端点。

管理端点可以直接在 `proxy_server.py` 的 router 上加 `@router.post` 或 `@router.get`，也可以新建模块放到 `management_endpoints/` 等目录，再仿照 `:22489` 到 `:22556` 加 `app.include_router`。然后处理三件事。在 `auth/route_checks.py` 和 `_types.py` 的 `LiteLLMRoutes` 枚举里登记鉴权与路由权限，见 `:148` 到 `:256`。引入新配置项时改 `_types.py` 的 `ConfigYAML` 或 `ConfigGeneralSettings`，以及 `ProxyConfig.load_config`。需要新后台任务或中间件时改 lifespan 或 middleware 注册区。

新的 LLM 推理端点更复杂，要动 `route_llm_request.py` 的 route_type 映射和分派、`common_request_processing.py` 的公共处理、`litellm_pre_call_utils.py` 的 pre-call 与别名逻辑。

有两个硬性要求。第一，新 POST 端点必须带 OpenAPI 文档，让 `app.openapi()` 里的每个 POST 都有 request body schema、description 和 200 response schema，否则 OA 门禁会拦下。第二，如果属于企业功能，代码放企业包并接好 premium 门控。

### 6.3 加一个需要持久化的实体

1. 在 `litellm/models/<entity>.py` 定义 Pydantic 实体，继承 `LiteLLMPydanticObjectBase` 并声明 frozen。若旧代码从 `proxy/_types.py` import，就在那里再导出一次。
2. 在根目录 `schema.prisma` 加表和字段，然后同步到另外两份副本。
3. 用 `ci_cd/run_migration.py` 生成只改 schema 的迁移，绝不在迁移里改写数据行。如果实体可删除且需要留痕，增加对应的 `LiteLLM_Deleted*` 表。
4. 新建 `litellm/repositories/<entity>_repository.py`，继承 `BaseRepository[T]`，实现 `table` 和 `model_class`，显式处理 JSON 列的 dumps 与 loads，按需注册到 `repositories/__init__.py` 或 `table_repositories.py`。
5. 接业务入口。若实体参与计费，把成本接进 `LiteLLM_SpendLogs` 并更新 `spend_log_insert.py` 的列白名单。
6. 补持久化用例和迁移 DML 检查，测试镜像放在 `tests/unit/repositories/`。

### 6.4 修一个 bug

修 bug 的关键不是改动本身，而是补一个能锁死这个 bug 的回归测试。要求这个测试在修复前失败、修复后通过，且能杀死针对该修复的变异，目标变异杀死率高于 90%。

流程是先在 `tests/unit/` 下找到与出问题的源文件对应的映射测试文件，扩展它，而不是新建一个。bug 修复一律扩展已有测试文件，只有全新功能才建新测试文件。然后写只验证行为的测试，不要测结构或实现细节，也不要把我们无法掌控的外部事实写成断言，比如厂商价格或第三方字段。最后改代码。

如果改的是真实网关行为，单元测试不够，还要补 `tests/e2e/` 覆盖并提供 live proxy 的前后证明，详见第七章。

## 第七章 质量体系，让代码能进主干

本仓库的质量要求比较严格，新手最容易在这里卡住。理解规则背后的逻辑比死记更重要。

### 7.1 测试分层与放置

`tests/unit/` 镜像 `litellm/` 的路径结构，改哪个源文件就按路径找对应测试，不需要映射表。`tests/e2e/` 是真实运行中的 proxy 加真实 provider API，需要 provider key、Postgres、Redis 等凭据，新增 e2e 目录必须在 `tests/e2e/AGENTS.md` 的 Suite folders 里登记。

`tests/unit/AGENTS.md` 有几条实用约定。测试进程内运行，不访问网络或起子进程。不要依赖当前时间和执行速度，用固定时间戳和受控时钟。Unix socket 用 `socket_dir` 和 `socket_path` fixture，不要用 `tmp_path`，因为 macOS 的 AF_UNIX 路径有 104 字节限制。判断同一性用 `is`，多组输入用 parametrize。不要 mock 自己的代码，优先依赖注入，只有调用次数本身就是被测行为时才例外。

CI 用 matrix 分片，共约 41 个 shard，几乎都用 Python 3.12 和 4 个 workers。分片名如 core-utils、enterprise-routing、integrations、router、db-and-spend、proxy-auth 等。注意 `proxy-a-o` 和 `proxy-p-z` 不是 CI shard，而是本地 Makefile 目标。新增测试目录时，必须在 `.github/workflows/test-unit.yml` 的某个 shard 的 test-path 里显式列出，否则 CI 覆盖检查会失败。push 前跑一次 `uv run --no-sync pytest tests/unit/test_assert_ci_coverage.py` 确认。

### 7.2 五个门禁

`make check` 会跑五个门禁脚本，它们的共同逻辑是，比较本分支上每条规则的全仓库违规数与和默认分支 merge-base 处的计数，任何规则都不许增长。没有预算文件可以改，失败时只能修掉本分支引入的违规，或在别处消除同等数量。

| 门禁 | 检查内容 |
|---|---|
| `scripts/ruff_strict_gate.py` | ruff strict 规则在 `litellm/` 的违规数 |
| `scripts/type_discipline_gate.py` | LIT001 到 LIT015，含可变集合注解、抑制写法、cast、TypeGuard 等 |
| `scripts/type_check_gate.py` | basedpyright strict 的逐 rule 计数，只算 error |
| `scripts/test_quality_gate.py` | TQ001 到 TQ009，无断言、mock 回声、改全局、子进程解释器等 |
| `scripts/openapi_docs_gate.py` | OA001 到 OA003，POST 端点的 OpenAPI 文档完整性 |

有一个例外要记住。`reportAny` 和 `reportExplicitAny` 共享 `scripts/type_check_gate.py:96` 里的固定上限 `ANY_CAPS`，分别是 6150 和 1440。这两条按全仓总量卡，不按 merge-base 增长卡，总数不超过上限即可。上限只允许在指向默认分支的独立 PR 里下调，绝不能在功能分支上调高。

### 7.3 代码风格硬约束

行宽是 120，不是 88。类型检查用 basedpyright strict，`pyrightconfig.json` 里 `enableTypeIgnoreComments` 为 false，所以 `# type: ignore` 完全无效且被禁。

禁用 `Any`、`List`、`Dict`、`Set`、`cast`，由 `ruff-strict.toml` 的 TID251 banned-api 拦截，另由 LIT006 和 LIT007 逐处把关。替代方案是用 frozen dataclass、NamedTuple、ReadOnly TypedDict、`tuple`、`Sequence`、`frozenset`、`MappingProxyType`，并在边界用 Pydantic 校验成类型化对象后再往里传。遇到 untyped 数据时，正确做法是在调用方用 `TypeAdapter` 校验，而不是加 `Any` 把违规往上限推。

LIT001 禁止任何注解里出现可变集合类型，优先用推导式加 `tuple()`、`frozenset()`、`MappingProxyType()` 一次性构造，`# mutable-ok` 只作最后手段。

所有抑制都必须写明确的规则名和理由，比如 `# pyright: ignore[reportArgumentType]  # stubs lack async overload` 或 `# noqa: TID251  # <reason>`。无理由的抑制、抑制了并不存在的违规，都会被门禁报错。

### 7.4 PR 前清单

提交前按这个顺序自检。

1. 读改动目录的 `AGENTS.md`，包括根目录、`tests/unit/`、`tests/e2e/` 等，测试按镜像路径放置。
2. 跑相关单测和 `make test-unit`。新增了测试目录就跑 CI 覆盖检查。
3. 跑 `make check`，失败时读 `.git/pre_commit_lint.log` 定位。
4. 确认五个门禁不增长，`reportAny` 与 `reportExplicitAny` 不超过上限且没有上调 cap。
5. 核对风格，行宽 120、strict typing、无 `# type: ignore`、无裸 `Any` 或可变集合注解、抑制均带规则名和理由、新 POST 端点有 OpenAPI 文档。
6. 若涉及真实网关行为，补 `tests/e2e/` 并准备 live proxy 的前后证明。简单机械的改动可申请 E2E 例外，但要在 PR 里记录例外所处的 commit SHA、范围和理由。
7. 遵循仓库的提交与 PR 规范，内部 PR 从默认分支切出，分支名用 `litellm_` 前缀且不含斜杠，提交信息不要加任何 Claude 署名，PR 目标分支用 `python3 scripts/default_branch.py --branch` 确认。

## 第八章 参考索引

### 8.1 关键文件速查

| 想找什么 | 去哪里 |
|---|---|
| SDK 入口与分发 | `litellm/main.py`，`completion` 在 5508 行，`acompletion` 在 645 行 |
| provider 解析 | `litellm/litellm_core_utils/get_llm_provider_logic.py:187` |
| HTTP 编排 | `litellm/llms/custom_httpx/llm_http_handler.py:710` |
| 转换基类与注册 | `litellm/llms/base_llm/chat/transformation.py:91`，`litellm/utils.py:9852` |
| 统一响应模型 | `litellm/types/utils.py:1795` 起 |
| 流式包装 | `litellm/litellm_core_utils/streaming_handler.py:409` |
| 成本计算 | `litellm/cost_calculator.py:1783` 与 `:2502` |
| 网关 app 与配置 | `litellm/proxy/proxy_server.py:2131` 与 `:5921` |
| 网关 CLI | `litellm/proxy/proxy_cli.py:892` 与 `:1229` |
| 鉴权 | `litellm/proxy/auth/user_api_key_auth.py:4407` |
| 路由 | `litellm/router.py:367`，`litellm/proxy/route_llm_request.py:755` |
| 花费落库 | `litellm/proxy/db/db_spend_update_writer.py:675` |
| 数据模型与仓储 | `litellm/models/`，`litellm/repositories/base_repository.py:42` |
| 数据库 schema | 根目录 `schema.prisma` 及两份副本 |

### 8.2 权威文档

| 文档 | 用途 |
|---|---|
| `ARCHITECTURE.md` | 分层与请求流的权威说明，含各子目录和后台任务清单 |
| `CONTRIBUTING.md` | 贡献流程与开发约定 |
| `LOCAL_DEV.md` | 本机联调细节 |
| `docs/adrs/` | 架构决策，涉及数据流改动前必读 |
| `tests/unit/AGENTS.md` | 单元测试约定 |
| `tests/e2e/AGENTS.md` | 端到端测试与 suite 登记 |
| 根目录 `AGENTS.md` | 全局工程规则，风格、门禁、QA、PR 等 |

### 8.3 术语表

| 术语 | 含义 |
|---|---|
| Provider | LLM 厂商或其兼容接口，如 OpenAI、Anthropic、Bedrock |
| 转换层 | 把 OpenAI 格式与厂商格式互相转换的代码，即 `BaseConfig` 子类 |
| Router | 在多个模型部署间做选择、fallback 和重试的组件 |
| Virtual Key | 网关签发的 API key，承载预算、模型和路由权限 |
| hidden params | 响应对象上的内部字段，成本和 provider 上报数据放这里 |
| extras | Pydantic 模型上未显式声明但保留的字段，provider 专属 usage 字段走这里 |
| spend log | 记录每次调用花费的 `LiteLLM_SpendLogs` 行 |
| 归档后删除 | 删除实体时先写 `LiteLLM_Deleted*` 表再删主表，保证审计可追溯 |
| 门禁 | 比较分支与 merge-base 违规数、不许增长的自动化检查 |
| shard | CI matrix 里的一个测试分片，按路径切分测试 |
