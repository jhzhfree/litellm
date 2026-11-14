# AI-TAgent 隔离联调网关（非生产）

本目录独立于 `deploy/docker-compose.prod.yml`、`proxy_config.yaml` 与 `prepare.sh`，不要合并 Compose 文件或复用生产 `.env`、数据库卷、管理密钥及模型密钥。JSON 是 YAML 的子集，Compose 和 LiteLLM 的 YAML 加载器可读取这两个 JSON 配置文件；同时标准库即可离线检查。

## 本轮边界

- 本轮只增加配置、生成器、静态检查和测试，**没有启动容器、数据库、模型请求或任何外部服务**。
- 固定发布 `127.0.0.1:4400`；数据库不发布端口。容器内 gateway 监听 `0.0.0.0:4000` 是供 Docker 发布访问，不是宿主机公网绑定。
- 独立项目名、独立数据库卷、`internal` 网络。没有生产数据库迁移、外部模型配置或监控采集器。不要把其他容器接入该网络，也不要添加 host networking。
- 只有 `dev-mock` 模型和固定模拟响应，不要求供应商 API key。模拟 token/费用不证明真实计费准确性。
- 配置显式关闭提示词支出日志、支出日志及消息日志，清空成功/失败回调；设置遥测 veto、离线模式和本地模型价格表。**不是声称所有应用/容器错误日志均已脱敏**；仅用合成素材，不输入企业内容、真实个人信息或生产凭据。
- 这是开发隔离基线，不是生产安全认证、SSO、企业内容审计系统或可上线交付。

## 离线验证（无需依赖、Docker 或网络）

从仓库根目录执行：

```sh
python deploy/dev-isolated/check.py
python -m unittest discover -s deploy/dev-isolated -p 'test_*.py' -v
```

检查覆盖：loopback、数据库不发布、内部网络、必填秘密变量、日志/遥测设置、仅 mock 模型、推理 key 限制；负向变更应失败。生成器测试只在自动清理的临时目录创建随机合成数据，验证 0600、秘密各异、拒绝覆盖和符号链接。测试不生成本目录 `.env`。

## 待操作者显式执行的设置

1. 审查镜像及入口：从当前代码构建/选择经过审查且已存在于本机的 LiteLLM 网关镜像和 PostgreSQL 16 镜像，记录 commit 与镜像 digest。配置 `pull_policy: never`，不会自动拉取镜像。不要使用未审查镜像，不要关闭 TLS/启用 insecure registry。镜像必须支持 `--config`、`--host`、`--port` 并包含本次核对过的配置能力。
2. 自行运行 `python deploy/dev-isolated/init_env.py`。它只创建本目录 `.env`，为开发 master key、UI 密码、数据库密码分别生成随机值，权限 0600，已存在即拒绝，不输出秘密。它不启动服务。不得上传/提交该文件；不要更改权限或使用 `source` 执行来源不明 `.env`。
3. 用安全编辑器填入 `.env` 中空白的 `DEV_GATEWAY_IMAGE`、`DEV_POSTGRES_IMAGE`，使用经过审查的镜像 digest。不要填写真实模型/生产凭据。不要在共享终端输出 `docker compose config` 的完整结果，其中会展开秘密。
4. 仅在目标开发主机获得服务启动许可后，使用本目录作为项目目录、只使用 `compose.json` 和本目录 `.env` 启动。示例命令（本轮未执行）：

```sh
docker compose --project-directory deploy/dev-isolated \
  --env-file deploy/dev-isolated/.env -f deploy/dev-isolated/compose.json up -d
```

停止时用相同参数执行 `stop`。不要自动 `down -v`，它会删除开发数据库。

Docker `internal` 是防御措施，不替代目标宿主机网络安全验证。Docker 版本、现有路由或镜像启动行为可能影响效果；需在批准环境验证 loopback 实际绑定、外部出站失败、mock 不发请求、数据库迁移及镜像兼容性。当前未做这些运行时验证。

## 管理与推理凭据分离

- `DEV_MASTER_KEY` 是管理员初始化/管理专用，**不得配置到 Octop、AKB、Agent、浏览器前端、监控器或普通请求**。管理端 UI 凭据仅供管理员。
- 在批准的本机网关启动后，管理员通过 `/key/generate` 使用 `inference-key-request.json` 请求独立 virtual key。请求使用 `key_type: llm_api`、只允许 `dev-mock`、有效期 1 小时、预算 1 美元以及 RPM/TPM 限制。不要把 bearer 值写入命令行历史、截图或提交记录。此文件只是一份请求模板，不会自动创建 key。
- 把返回的推理 key 保存到开发端专用的秘密存储，只向 Octop 后端配置该 key 及 `http://127.0.0.1:4400/v1`（Octop 需在同一宿主机；容器内 localhost 指向自身，本配置不开放跨容器访问）。浏览器前端不得接收该 key。
- master key 仍具有超级管理员权限，技术上可能调用推理；这里的分离通过不分发 master key、给调用方发放受限 virtual key 实现，不是假称 master key 被禁止推理。
- 上线前必须单独批准并完成验收：匿名推理拒绝、推理 key 调用管理接口拒绝、过期/撤销 key 拒绝、模型白名单和限流生效、错误日志没有内容/秘密。不要因静态测试通过而认为这些运行时边界已经验证。

## 配置依据（本仓库实际实现）

- `litellm/proxy/proxy_server.py` 读取 `general_settings.disable_spend_logs`、`store_prompts_in_spend_logs`，加载 `litellm_settings` 属性。
- `litellm/__init__.py` 定义 `turn_off_message_logging`；`litellm/main.py` 处理 `mock_response`。
- `litellm/proxy/telemetry/settings.py` 中 `LITELLM_TELEMETRY_DISABLED` 进入 `EnvPolicy` veto。旧 `--telemetry` 参数在此版本为 no-op，因此本方案不使用它。
- `litellm/litellm_core_utils/offline_mode.py` 与 `get_model_cost_map.py` 分别支持离线及本地价格表变量；离线模式**不等于**全面出站沙箱。
- `litellm/types/proxy/management_endpoints/key_requests.py` 定义 `llm_api`，`key_management_endpoints.py` 将其限制到 `llm_api_routes`。

未改变现有生产配置；生产中的默认口令、内容审计开启以及监控使用 master key 问题仍需独立迁移方案处理，不能因新增本目录而视为已修复。
