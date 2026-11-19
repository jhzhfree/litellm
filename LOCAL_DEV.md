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
| Prometheus（容器） | `${MONITOR_PORT:-9090}` | compose 自带 |

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

Registry：`192.168.22.6:5000`。**版本号保持不变**：拆分镜像固定标签 `split-1`（见 `deploy/env.example`），单体兼容镜像固定标签 `gateway:1`；同标签推送为覆盖语义，以 digest 区分版本。

### 5.1 拆分镜像（当前架构，本机未验收通过）

组件与脚本：`docker/split/build.sh native|gateway|ui`。`gateway` 依赖先构建好的 `native` 产物镜像（通过 `NATIVE_IMAGE` 传入）；`ui` 为 Next.js 静态导出 + nginx，不需 Node SSR。Rust 无变更时跳过 `native` 构建。

```bash
cd /opt/dev/litellm
export IMAGE_TAG=split-1
export IMAGE_PREFIX=192.168.22.6:5000/ai-gw

# 1) Rust 产物镜像（Rust 有变更时执行）
docker/split/build.sh native

# 2) Python 核心镜像（作为 compose 的 PYTHON_IMAGE）
export NATIVE_IMAGE=192.168.22.6:5000/ai-gw/native:split-1
docker/split/build.sh gateway

# 3) 静态 UI 镜像（作为 compose 的 UI_IMAGE）
docker/split/build.sh ui

# 4) 推送固定标签
docker push $IMAGE_PREFIX/native:split-1
docker push $IMAGE_PREFIX/gateway:split-1
docker push $IMAGE_PREFIX/ui:split-1
```

`deploy/docker-compose.prod.yml` 强制要求设置 `PYTHON_IMAGE` 和 `UI_IMAGE`（见 `deploy/env.example`）。服务端升级顺序：

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps core
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate ui  # 重新解析 core 容器地址
```

仅更新前端时只执行第二条。部署配置全部外置挂载（`proxy_config.yaml`、`nginx.split.conf`、`prometheus.yml`）。注意 `deploy/.env` 的 `UI_PASSWORD` 与 compose 默认值不一致（前者 `AI-Tokengw@2026`，后者 `AI-GovernanceGw@2026`），以实际 `.env` 为准。

### 5.1.1 定价数据本地化与热重载

定价数据（model cost map）**不访问外网**：`deploy/model_prices_and_context_window.json` 挂载进容器（compose 中 `LITELLM_MODEL_COST_MAP_PATH=/app/model_prices_and_context_window.json`），启动与重载都只读该文件。外部修改后热重载：

```bash
# 1) 编辑宿主机文件 deploy/model_prices_and_context_window.json（改价格/加模型）
# 2) 触发重载（管理员或 master key）
curl -X POST http://localhost:4000/reload/model_cost_map -H "Authorization: Bearer <master_key>"
# 返回 {status: success, models_count, source_revision}；revision 变化即文件已重读
```

说明：坏文件（JSON 非法）重载会失败并**保留当前定价数据**（fail-safe），修正文件后再重载即可。代码位于 `litellm/litellm_core_utils/get_model_cost_map.py`（`LITELLM_MODEL_COST_MAP_PATH` 优先级高于 `LITELLM_LOCAL_MODEL_COST_MAP`——后者会在首次联网失败后被 litellm 自动置 True，若路径分支顺序不当会被遮蔽）。本地测试期间 `docker-compose.local.yml` 临时把该模块源文件挂进容器，**下次 build-push.sh 重建镜像后可删除该挂载**。

### 5.2 单体兼容镜像（当前本机实际交付路径）

拆分镜像的 BuildKit 元数据解析在当前网络环境反复超时（`SPLIT_IMAGES.md` 也注明未完成构建验收），本机实际交付走本节的单体脚本。**版本号仍为固定标签 `gateway:1`，以 digest 区分版本**。

```bash
# 0) 预拉取基础镜像（首次或缓存被清后必做；BuildKit 元数据解析不走 dockerd 代理，
#    不预拉取会卡在 "load metadata ... i/o timeout"）
docker pull cgr.dev/chainguard/wolfi-base:latest
docker tag cgr.dev/chainguard/wolfi-base:latest cgr.dev/chainguard/wolfi-base:local   # /root/Dockerfile.build 用 :local 标签
docker pull ghcr.io/astral-sh/uv:0.11.7                                               # 摘要与 Dockerfile 固定值一致
docker pull node:24.19-alpine3.24                                                     # 同上

# 1) UI 源码有改动先同步静态产物（镜像构建输入）
scripts/sync-ui.sh --no-restart

# 2) 构建 + 推送 ai-gw/gateway:1（固定标签，版本号不变）
scripts/build-push.sh
```

基础镜像 digest 核对（与 `/root/Dockerfile.build` 固定值一致才可用缓存）：

```bash
docker images --digests --format '{{.Repository}}:{{.Tag}} {{.Digest}}' | grep -E "wolfi-base|astral-sh/uv|node:24.19-alpine"
```

`/root/Dockerfile.build` 是本机适配版（去掉 `# syntax=` 指令避免 buildkit frontend 拉取超时；`NODE_OPTIONS=--max-old-space-size=4096` 避免 Next.js OOM；烤入默认 `proxy_config.yaml`）。丢失时按 git 历史中的旧版文档重建，或直接从仓库 `Dockerfile` 按上述三处 sed 修改。

### 5.3 前置检查与排障

```bash
df -h /    # 剩余需 ≥6G；2026-11-18 已将 LVM 卷组空闲空间全部扩入根分区（115G，可用约 62G）
# 不足时: docker builder prune -f --keep-storage=10GB（勿全清，否则 Rust 全量重编）
```

> 磁盘扩容记录：`lsblk` 只看到一块 120G 盘，但 PV/LVM 成员分区已是 116.9G、逻辑卷仅 58.5G，卷组剩余 58.47G。执行 `lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv && resize2fs /dev/ubuntu-vg/ubuntu-lv` 在线扩容根文件系统（`ext4` 支持在线扩容，无需停机、不丢数据）。lvextend 输出的 "File descriptor leaked" 是 LVM 工具的提示，可忽略。

- **BuildKit 元数据解析不走 dockerd 代理**：`cgr.dev` / `ghcr.io` 匿名 token 拉取直连超时。先 `docker pull` 预拉取基础镜像到本地（含摘要标签），再重跑构建。拆分镜像当前固定的 `cgr.dev/chainguard/wolfi-base@sha256:360896ef...` 与旧单体镜像的 `:local`（`2c12da...`）**摘要不同**，需单独预拉取。
- `ui/Dockerfile` 带 `# syntax=docker/dockerfile:1.7`，本机需临时去掉该行并给 `npm run build` 加 `NODE_OPTIONS=--max-old-space-size=4096`，否则 frontend 拉取超时 / Node 堆溢出。
- 若构建中途磁盘满：清理后直接重跑，已编译层有缓存不会重来。
- 代理出口：`192.168.24.200:7890`（HTTP）/ `7891`（SOCKS5），控制接口 `9090`。验证：`curl -x http://192.168.24.200:7890 -m 15 -o /dev/null -w "%{http_code}\n" https://registry-1.docker.io/v2/`（401 即通）。
- 4000 端口占用：`ss -ltnp | grep :4000`；本地 dev 后端固定 4001。

### 5.4 推送验证

```bash
REG=$(curl -s -I -H "Accept: application/vnd.oci.image.index.v1+json" \
  http://192.168.22.6:5000/v2/ai-gw/gateway/manifests/split-1 | grep -i docker-content-digest | awk '{print $2}' | tr -d '\r')
LOCAL=$(docker inspect --format='{{index .RepoDigests 0}}' 192.168.22.6:5000/ai-gw/gateway:split-1 2>/dev/null | awk -F@ '{print $2}')
echo "registry: $REG"; echo "local: $LOCAL"; [ "$REG" = "$LOCAL" ] && echo "✓ digest 一致" || echo "✗ 不一致"
```

单体镜像把 `manifests/split-1` 换成 `manifests/1`、`:split-1` 换成 `:1` 即可。

### 5.5 本地用新镜像启动产品栈测试

单体镜像自带 UI，但拆分架构下 `core` 默认只在容器内暴露，需加本地覆盖文件 `deploy/docker-compose.local.yml`（把 core 的 4000 映射到宿主机，已固化在仓库）：

```bash
# 启动网关（core + db + monitor）
cd /opt/dev/litellm
PYTHON_IMAGE=192.168.22.6:5000/ai-gw/gateway:1 \
UI_IMAGE=192.168.22.6:5000/ai-gw/gateway:1 \
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.local.yml \
  --env-file deploy/.env up -d core db monitor

# 启动身份认证平台
cd identity-platform && docker compose up -d
```

- 网关入口 `http://localhost:4000`（凭证 `deploy/.env` 的 `UI_USERNAME`/`UI_PASSWORD`），监控 `http://localhost:9090`
- 身份平台管理台 `http://127.0.0.1:18080/admin/`（`identity-platform/.env`），Keycloak 就绪需 30-60s，判断：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/realms/company` 返回 200
- 停止：两个 compose 目录分别 `docker compose down`（**勿加 `-v`**，数据卷保留）

## 6. 离线发布包

`deploy/offline-release/` 提供 `pull_policy: never` 的离线 compose（core/db/monitor/ui，默认绑定 `127.0.0.1:4400`），构建包装 `deploy/offline-release/build/build.sh`（`docker save` + sha256）。适用于无外网环境交付；配置模板与在线版同路径。

## 7. 已知 unfinished 事项（勿误判为完成）

- `identity-platform` 使用 `start-dev`、仅回环绑定，不是生产部署模板；正式部署需 HTTPS、固定摘要、备份恢复、受限管理客户端。
- 网关 `deploy/proxy_config.yaml` 尚未配置 JWT issuer/JWKS/audience；身份平台与网关的集成目前只在 `smoke.py` 中验证。
- `external_identity` 模块无生产调用方；浏览器 SSO 回调、Agent 绑定、应用身份经网关访问资源、统一管理 API/同步未完成。
- `docs/PRODUCT_MANUAL.md` / `docs/RELEASE_FEATURES.md` 仍是「网关 + 内置 UI」两组件叙事，待补独立身份平台与拆分镜像章节。
