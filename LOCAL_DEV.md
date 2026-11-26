# 本地开发环境指南（AI治理网关 / AI-GovernanceGw）

> 适用机器：`192.168.24.202`（宿主机），仓库 `/opt/dev/litellm`，当前分支 `litellm_identity_platform_integration`。
> 机器配置：31GB 内存 / 8 核。最后更新：2026-11-18。
>
> 当前架构（2026-11-18 起）：
> - **前后端镜像拆分**：Python 核心与静态 UI 分别构建、独立升级（见 `deploy/SPLIT_IMAGES.md`）。
> - **独立身份认证平台**：Keycloak + 独立 PostgreSQL，位于 `identity-platform/`，与网关数据库隔离。
> - **品牌**：界面文案 `AI治理网关` / `AI-GovernanceGw`；部署标识 `ai-tokengw-*` 容器名与 `ai-gw/*` 镜像名保持不变。
> - 身份平台与网关 JWT 的集成验证见 `identity-platform/VALIDATION.md`；**尚未固化到 `deploy/proxy_config.yaml`**，不能当成生产 SSO 方案。

## 1. 端口与环境总览

| 服务 | 端口 | 说明 |
|---|---|---|
| 身份认证平台（Keycloak） | `18080`（仅 `127.0.0.1`） | `identity-platform/compose.yaml`，管理台 `/admin/`，OIDC discovery `/realms/company/.well-known/openid-configuration` |
| 本地开发后端 | `4001` | venv 直跑，`--reload`，避开容器 4000 |
| 本地开发前端 | `3000` | `next dev`，HMR |
| 产品栈 UI（容器） | `${CORE_PORT:-4000}` | `deploy/docker-compose.prod.yml` 的 `ui` 服务（nginx 静态 UI + API 反代） |
| 产品栈核心（容器） | 仅容器内部 `4000` | `core` 服务 `expose: 4000`，由 UI nginx 反代 |
| 宿主机 PostgreSQL | `5432` | `.env` 的 `DATABASE_URL` → 本地开发库 |
| 容器版 PostgreSQL | `5433`（对外） | `docker-compose.override.yml` 映射，容器内部 `db:5432` |
| 身份平台 PostgreSQL | 仅容器内部 `5432` | 独立命名卷 `identity-db`，不与网关共用 |
| Prometheus（容器） | `${MONITOR_PORT:-9190}` | compose 自带 |

本地 venv 是 editable 安装（`litellm.__file__` 指向仓库源码），后端改代码即生效。

## 2. 本地前后端开发

### 2.1 一键启动（推荐）

```bash
cd /opt/dev/litellm
scripts/start-dev.sh
```

自动完成：检测 UI 源码比静态快照新时先 `sync-ui.sh --no-restart` → 启动后端 4001 → 启动前端 3000 → 就绪检查。已在运行的进程跳过，幂等可重复。`--skip-ui` 跳过快照同步。日志：`/root/litellm-backend.log`、`/root/litellm-frontend.log`。

### 2.2 手动启动

```bash
# 后端
cd /opt/dev/litellm
set -a && source .env && set +a
.venv/bin/litellm --config proxy_server_config.yaml --port 4001 --reload

# 前端（另一个终端）
cd /opt/dev/litellm/ui/litellm-dashboard
NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_BASE_URL=http://localhost:4001 npm run dev
```

要点：

- `NEXT_PUBLIC_BASE_URL` 必须指向本地后端 4001（不设则默认打 4000 容器，看不到本地改动）。解析见 `src/components/networking.tsx` 的 `resolveDefaultBase`。
- Node 要求 `>=24.14.1`（当前 24.19.0）；`useTypeScriptCli` 默认关闭，类型检查走 `npm run typecheck`。
- 登录凭证：`.env` 的 `UI_USERNAME` / `UI_PASSWORD`，或 `LITELLM_MASTER_KEY`。

### 2.3 停止

```bash
pkill -f "litellm --config"; sleep 2     # 后端
pkill -f "next dev"; sleep 2             # 前端
ss -ltn | grep -E ':4001|:3000'          # 无输出即停止
```

### 2.4 后端托管的静态登录页（易踩坑）

未登录时 dev 前端会跳 `${后端}/ui/login`，该页面来自 `litellm/proxy/_experimental/out` 静态快照，**不随 HMR 更新**。改 UI 后执行：

```bash
scripts/sync-ui.sh                 # 构建 → 替换快照 → 重启后端 → 健康检查
scripts/sync-ui.sh --no-build      # out/ 已是最新时
scripts/sync-ui.sh --no-restart    # 只构建替换，不动后端
```

验证：`curl -s http://localhost:4001/ui/login/ | grep -c AI-GovernanceGw`（应为 ≥1）。

## 3. 身份认证平台（Keycloak）

目录 `/opt/dev/litellm/identity-platform/`，**独立的本地开发身份服务**，不依赖网关进程。镜像 Keycloak 26.4.7（固定摘要）+ PostgreSQL 16，OIDC，realm `company`，授权码客户端 `gateway-console`（PKCE S256）、bearerOnly 客户端 `ai-governance-gateway`，角色 `gateway-user` / `gateway-agent`。

### 3.1 启动

```bash
cd /opt/dev/litellm/identity-platform
cp .env.example .env
# 生成两个独立随机值分别填入 IDENTITY_DB_PASSWORD 与 IDENTITY_ADMIN_PASSWORD
python3 -c 'import secrets; print(secrets.token_urlsafe(24)); print(secrets.token_urlsafe(24))'
docker compose up -d
docker compose ps
```

- 管理台：`http://127.0.0.1:18080/admin/`（管理员为 `IDENTITY_ADMIN_USER`，默认 `admin`）
- OIDC discovery：`http://127.0.0.1:18080/realms/company/.well-known/openid-configuration`
- 就绪判断：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/realms/company`（200 即就绪）；`start-dev` 模式下 `/health/ready`、`/health/live` 返回 404，不要用它判断存活。
- **中英文切换**：`company` realm 的 `realm.json` 已启用 `internationalizationEnabled` + `supportedLocales: ["en","zh-CN"]`（默认 `en`，`loginTheme: keycloak.v2`）；登录页右上角下拉框即时切换并记住选择。管理台登录页同样可切换；进入管理台后用户菜单 → Manage account → Personal info → Select a locale 选中文并保存（语言存入 admin 用户 profile）。`master` realm 的国际化通过管理 API 开启，配置存于身份数据库卷；若重建卷需重新设置。
- 只绑定回环、`start-dev` + `--import-realm`，**不可作为生产部署模板**；没有预置用户密码或客户端密钥，需在管理台设置/轮换 `gateway-console` 密钥后经环境配置交给网关。
- 关闭保留数据用 `docker compose down`；**禁止 `down -v`**（会删身份数据库卷 `identity-db`）。
- realm 只在首次启动导入；后续改 `realm.json` 不会覆盖，需走管理 API 受控更新。

### 3.2 集成验证（真实网络调用）

本机已验证通过（2026-11-18）：discovery、用户创建/禁用、应用注册、Client Credentials 签发，以及网关 `JWTHandler` 用真实 Keycloak JWKS 验签与错误 audience 拒绝。

```bash
cd /opt/dev/litellm
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py --gateway-jwt
```

覆盖 OIDC discovery、用户创建/禁用、应用注册、Client Credentials 签发，并用网关 `JWTHandler` 验证真实 Keycloak 签名与 issuer/audience（错误 audience 被拒）。脚本临时资源会清理，不输出密码或令牌。**注意范围**：只是身份服务到网关认证组件的集成测试；浏览器回调、Agent 绑定、应用身份经完整网关 HTTP 路径访问资源、统一管理 API 与同步均未验收；`external_identity` 模块尚无生产调用方。网关配置 `deploy/proxy_config.yaml` 当前不含 JWT/jwks/issuer/audience 项。

## 4. 日常开发循环

- 后端：改 `litellm/proxy/**` → uvicorn 自动重启。
- 前端：改 `ui/litellm-dashboard/src/**` → 浏览器热更新。
- i18n：文案必须同步 `src/i18n/locales/en.json` 与 `zh.json`（key 路径一致）；品牌名集中在 `src/i18n/untranslated/productNames.ts`（当前 `AI-GovernanceGw`）。
- 前端测试：`npm run test:unit`（含 i18n 对齐）；类型检查 `npm run typecheck`。
- 后端测试：`pytest tests/unit/...`。
- 身份平台：改 `realm.json` 仅首次导入生效，后续用管理 API。

## 5. 镜像构建与推送（22.6）

Registry：`192.168.22.6:5000`。**版本号保持不变**，全部使用固定标签，以 digest 区分版本：

| 镜像 | 标签 | 作用 |
| --- | --- | --- |
| `ai-gw/rust` | `1` | Rust 编译产物 wheel，仅构建期 |
| `ai-gw/python` | `1` | 完整 proxy 服务（管理 + 推理） |
| `ai-gw/ui` | `1` | 静态 UI + nginx，反代 API 到 core |
| `ai-gw/identity` | `1` | Keycloak 统一身份管理系统（AOIDC） |
| `ai-gw/identity-db` | `16` | 身份平台 PostgreSQL |
| `ai-gw/postgres` | `16` | 网关 PostgreSQL |
| `ai-gw/prometheus` | `1` | 监控 |

配置基准是 `deploy/env.example`，与 `deploy/.env` 保持一致。

### 5.1 拆分镜像构建

脚本 `scripts/build-split.sh` 按依赖顺序构建 rust、python、ui 并推送固定标签，Dockerfile 在 `docker/split/`。python 镜像从 rust 镜像取 wheel，不重编 Rust，因此改 UI 或 Python 代码不会触发 cargo 重编。

```bash
cd /opt/dev/litellm
scripts/build-split.sh                 # 全部三个
scripts/build-split.sh --only ui       # 仅前端
scripts/build-split.sh --only python   # 仅 Python
```

服务端升级顺序（仅更新前端时只执行第二条）：

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps core
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate ui  # 重新解析 core 容器地址
```

部署配置全部外置挂载（`proxy_config.yaml`、`nginx.split.conf`、`prometheus.yml`）。

### 5.1.1 定价数据本地化与热重载

定价数据（model cost map）**不访问外网**：`deploy/model_prices_and_context_window.json` 挂载进容器（compose 中 `LITELLM_MODEL_COST_MAP_PATH=/app/model_prices_and_context_window.json`），启动与重载都只读该文件。外部修改后热重载：

```bash
# 1) 编辑宿主机文件 deploy/model_prices_and_context_window.json（改价格/加模型）
# 2) 触发重载（管理员或 master key）
curl -X POST http://localhost:4000/reload/model_cost_map -H "Authorization: Bearer <master_key>"
# 返回 {status: success, models_count, source_revision}；revision 变化即文件已重读
```

说明：坏文件（JSON 非法）重载会失败并**保留当前定价数据**（fail-safe），修正文件后再重载即可。代码位于 `litellm/litellm_core_utils/get_model_cost_map.py`（`LITELLM_MODEL_COST_MAP_PATH` 优先级高于 `LITELLM_LOCAL_MODEL_COST_MAP`——后者会在首次联网失败后被 litellm 自动置 True，若路径分支顺序不当会被遮蔽）。

### 5.2 身份平台镜像

Keycloak 与它的 PostgreSQL 已本地化到 22.6，compose 在 `identity-platform/compose.yaml`，自定义 AOIDC 主题通过 `keycloak-theme` 目录挂载，`realm.json` 首次导入。

```bash
docker compose -f identity-platform/compose.yaml pull
docker compose -f identity-platform/compose.yaml up -d
```

### 5.3 前置检查与排障

```bash
df -h /    # 剩余需 ≥6G
# 不足时: docker builder prune -f --keep-storage=10GB（勿全清，否则 Rust 全量重编）
```

- **BuildKit 元数据解析不走 dockerd 代理**：`cgr.dev` / `ghcr.io` 匿名 token 拉取直连超时。先 `docker pull` 预拉取基础镜像到本地（含摘要标签），再重跑构建。
- 三个新 Dockerfile 不带 `# syntax=` 指令，避免 buildkit frontend 拉取超时；UI 构建已设 `NODE_OPTIONS=--max-old-space-size=4096` 防 Node 堆溢出。
- 若构建中途磁盘满：清理后直接重跑，已编译层有缓存不会重来。
- 端口占用排查：`ss -ltnp | grep -E ':4000|:9190|:18080'`；网关 UI 对外 4000，Prometheus 对外 9190（容器内部仍 9090），身份平台 18080。

### 5.4 推送验证

```bash
for tag in rust:1 python:1 ui:1 identity:1 identity-db:16 postgres:16 prometheus:1; do
  echo "-- $tag"
  curl -s -I -H "Accept: application/vnd.oci.image.index.v1+json" \
    "http://192.168.22.6:5000/v2/ai-gw/${tag%:*}/manifests/${tag#*:}" \
    | grep -i docker-content-digest | awk '{print $2}' | tr -d '\r'
done
```

### 5.5 本地用新镜像启动产品栈

网关 UI 对外 4000（nginx 反代 API 到 core），core 只在容器内暴露 4000，不需覆盖文件：

```bash
cd /opt/dev/litellm
docker compose -f deploy/docker-compose.prod.yml pull
docker compose -f deploy/docker-compose.prod.yml up -d

docker compose -f identity-platform/compose.yaml pull
docker compose -f identity-platform/compose.yaml up -d
```

- 网关入口 `http://localhost:4000`（凭证 `deploy/.env` 的 `UI_USERNAME`/`UI_PASSWORD`），监控 `http://localhost:9190`
- 身份平台管理台 `http://127.0.0.1:18080/admin/`（`identity-platform/.env`），Keycloak 就绪需 30-60s，判断：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/realms/company` 返回 200
- 停止：两个 compose 目录分别 `docker compose down`（**勿加 `-v`**，数据卷保留）

## 6. 离线发布包

`deploy/offline-release/` 提供 `pull_policy: never` 的离线 compose（core/db/monitor/ui，默认绑定 `127.0.0.1:4400`，Prometheus 对外 `9190`），镜像由 `scripts/build-split.sh` 构建后经 `docker save` 打包，加载到本地后再由该 compose 启动。适用于无外网环境交付；配置模板与在线版同路径。

## 7. 已知 unfinished 事项（勿误判为完成）

- `identity-platform` 使用 `start-dev`、仅回环绑定，不是生产部署模板；正式部署需 HTTPS、固定摘要、备份恢复、受限管理客户端。
- 网关 `deploy/proxy_config.yaml` 尚未配置 JWT issuer/JWKS/audience；身份平台与网关的集成目前只在 `smoke.py` 中验证。
- `external_identity` 模块无生产调用方；浏览器 SSO 回调、Agent 绑定、应用身份经网关访问资源、统一管理 API/同步未完成。
- `docs/PRODUCT_MANUAL.md` / `docs/RELEASE_FEATURES.md` 仍是「网关 + 内置 UI」两组件叙事，待补独立身份平台与拆分镜像章节。
