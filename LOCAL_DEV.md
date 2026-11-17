# 本地开发环境指南（AI-Tokengw）

> 适用机器：`192.168.24.202`（宿主机），仓库路径 `/opt/dev/litellm`，开发分支 `feature/akb-octop-litellm-dev`（发布分支 `enterprise/zh-en-i18n`）。
> 机器配置：31GB 内存 / 8 核（2026-11-12 扩容）。
> 最后更新：2026-11-17。

## 1. 端口与环境总览

| 服务 | 端口 | 说明 |
|---|---|---|
| Docker 版网关（含镜像内 UI） | `4000` | `docker compose` 的 `litellm` 容器，做部署对照 |
| 本地开发后端 | `4001` | venv 直跑，热重载，避开容器 4000 |
| 本地开发前端 | `3000` | `next dev`，HMR |
| 宿主机 PostgreSQL 17 | `5432` | `.env` 的 `DATABASE_URL` → `127.0.0.1:5432/litellm_dev`（本地开发数据） |
| 容器版 PostgreSQL | `5433`（对外） | `docker-compose.override.yml` 里映射 `5433:5432`，容器内部仍走 `db:5432` |
| Prometheus（容器） | `9090` | compose 自带 |

本地 venv 是 **editable 安装**（`litellm.__file__` 指向仓库源码），后端改代码即生效。

## 2. 启动后端（热重载）

### 2.0 一键启动（推荐）

```bash
scripts/start-dev.sh
```

自动完成：检测 UI 源码比静态快照新时先构建同步（保证 4001/ui 也是最新）→ 启动后端（等价 2.1 命令）→ 启动前端（等价第 3 节命令）→ 就绪检查。已在运行的进程跳过，幂等可重复执行。`--skip-ui` 跳过快照同步检测。日志在 `/root/litellm-backend.log` 与 `/root/litellm-frontend.log`。

### 2.1 手动启动

```bash
cd /opt/dev/litellm
set -a && source .env && set +a
.venv/bin/litellm --config proxy_server_config.yaml --port 4001 --reload
```

- `--reload` 监听 `*.py` 和 `.env`，保存即自动重启（`litellm/proxy/proxy_cli.py` 内置）。
- 数据库走 `.env` 的宿主机库，与容器 db（5433）相互独立。
- 登录凭证：`.env` 里的 `UI_USERNAME` / `UI_PASSWORD`，或 `LITELLM_MASTER_KEY`。
- CORS 默认 `allow_origins=["*"]`（`litellm/proxy/proxy_server.py`），3000 → 4001 跨端口无需配置。

## 3. 启动前端（HMR）

```bash
cd /opt/dev/litellm/ui/litellm-dashboard
NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_BASE_URL=http://localhost:4001 npm run dev
```

- 起在 `3000`，浏览器访问 `http://192.168.24.202:3000`。
- **必须设置 `NEXT_PUBLIC_BASE_URL`**：不设时 dev 模式默认连 `http://localhost:4000`（会打到 Docker 容器，看不到本地后端改动）。解析逻辑见 `ui/litellm-dashboard/src/components/networking.tsx` 的 `resolveDefaultBase`。
- `NODE_OPTIONS=--max-old-space-size=8192`：32GB 机器上给 Node 堆提上限，避免大仓库首次编译（Turbopack 冷启动约 1 分钟属正常，持久缓存 `.next` 命中后启动很快）与热更新时的 OOM 风险。
- `next dev` 无需其它参数；`useTypeScriptCli` 实验默认关闭，类型检查走 `npm run typecheck`。
- Node 版本要求 `>=24.14.1`（当前 v24.19.0）。

### 3.1 停止服务

```bash
# 停止后端（--reload 的 reloader 与 worker 都会退出）
pkill -f "litellm --config"; sleep 2
ss -ltn | grep :4001   # 无输出即已停止

# 停止前端
pkill -f "next dev"; sleep 2
ss -ltn | grep :3000   # 无输出即已停止
```

说明：

- `pkill -f` 按完整命令行匹配，两个服务的命令行特征（`litellm --config` / `next dev`）不会误伤其它进程。
- 后端日志在 `/root/litellm-backend.log`，前端日志在 `/root/litellm-frontend.log`（按第 2/3 节命令启动时）；停止后如需后台重启，命令见上文对应章节（前端记得保留 `NEXT_PUBLIC_BASE_URL` 和 `NODE_OPTIONS`）。
- 同步脚本 `scripts/sync-ui.sh` 会自动重启后端，无需先手动停止。

## 4. 日常开发循环

- 后端：改 `litellm/proxy/**` → uvicorn 自动重启。
- 前端：改 `ui/litellm-dashboard/src/**` → 浏览器热更新。
- i18n：文案必须同步 `src/i18n/locales/en.json` 与 `zh.json`（key 路径完全一致），品牌名集中在 `src/i18n/untranslated/productNames.ts`（当前为 `AI-Tokengw`），改一处全站生效。
- 前端测试：`npm run test:unit`（i18n 对齐校验在内，共 32 个）；类型检查 `npm run typecheck`。
- 后端测试：`pytest tests/unit/...`（镜像路径同名对应）。

### 4.1 同步后端托管的登录页（容易踩的坑）

dev 前端（3000）检测到未登录时，会跳转到**后端托管的静态登录页** `${后端}/ui/login`（登录成功后 `redirect_to` 回 3000）。这个页面用的是仓库里 `litellm/proxy/_experimental/out` 的静态产物（827 个 git 跟踪文件），**不随 dev 热更新**——改了品牌/UI 后如果只看 3000 的页面是新的，但跳到登录页还是旧的，就是这里没同步。

同步命令（源码改完后执行一次）：

```bash
# 推荐方式：一键脚本（构建 → 同步 → 重启后端 → 健康检查）
scripts/sync-ui.sh                # 完整流程
scripts/sync-ui.sh --no-build     # 跳过 npm build（out/ 已是最新时）
scripts/sync-ui.sh --no-restart   # 只构建替换，不动后端
# 日志默认 /root/litellm-backend.log，可用 BACKEND_LOG=... 覆盖；堆上限可用 NODE_HEAP=... 覆盖

# 手动等价操作：
cd /opt/dev/litellm/ui/litellm-dashboard
NODE_OPTIONS=--max-old-space-size=8192 npm run build      # 产物输出到 out/
cd /opt/dev/litellm
rsync -a --delete ui/litellm-dashboard/out/ litellm/proxy/_experimental/out/
# 然后重启本地后端（4001）
```

验证：`curl -s http://localhost:4001/ui/login/ | grep -c AI-Tokengw`（应为 5）。
这个目录同样是 Docker 镜像构建的输入，改完它再打镜像，容器里的 UI 才是新的。

## 5. 改完代码提交镜像到 22.6（按改动范围选择命令）

镜像统一命名并推送内网 registry `192.168.22.6:5000`，**只推固定标签**（`gateway:1` / `postgres:16` / `prometheus:1`），不打时间戳标签。版本以 digest 区分。

### 5.1 改动范围 → 提交动作对照

| 改了什么 | 需要提交的镜像 | 命令 |
|---|---|---|
| Python 代码（`litellm/**`）、Rust 代码（`litellm-rust/**`）、Dockerfile | `ai-gw/gateway:1` | `scripts/build-push.sh` |
| UI 源码（`ui/litellm-dashboard/src/**`） | `ai-gw/gateway:1` | **先** `scripts/sync-ui.sh`（同步 `out/` 静态产物），**再** `scripts/build-push.sh` |
| 默认产品配置（`deploy/proxy_config.yaml`） | `ai-gw/gateway:1`（配置烤入镜像） | `scripts/build-push.sh`；同时外置挂载侧无需重建（挂载同路径自动覆盖） |
| 上游依赖（`pyproject.toml` / `uv.lock`） | `ai-gw/gateway:1`（全量重装依赖层，构建变慢） | `scripts/build-push.sh` |
| 升级 PostgreSQL 版本 | `ai-gw/postgres:16` | 见 5.3 |
| 升级 Prometheus 版本 | `ai-gw/prometheus:1` | 见 5.4 |
| 仅改 `deploy/*.yml`、`prometheus.yml`、`.env` | 无需提交镜像 | 改挂载侧文件 + `docker restart` 对应容器 |

### 5.2 核心应用 gateway（最常用）

```bash
cd /opt/dev/litellm

# 一键构建 + 推送（含 cargo/uv/npm 缓存挂载，只有变更部分重编译）
scripts/build-push.sh              # 构建 + 推送 ai-gw/gateway:1
scripts/build-push.sh --no-push    # 只构建不推送（先本地验证）

# 验证推送结果（digest 与本地一致即成功）
docker images --format '{{.Repository}} {{.ID}}' | grep ai-gw/gateway
curl -s -H "Accept: application/vnd.oci.image.index.v1+json" -I \
  http://192.168.22.6:5000/v2/ai-gw/gateway/manifests/1 | grep -i docker-content-digest
```

**构建前置检查**：

```bash
df -h /   # 剩余空间需 ≥6G，不足先清理:
# docker builder prune -af --keep-storage=10GB   # 保留最近 10G 缓存（勿全清，会全量重编 Rust）
# docker rmi <多余的 ai-gw/gateway 旧镜像标签>
```

要点：

- 构建走脚本（内部用 `/root/Dockerfile.build` + 代理 build-arg），不要手写 buildx 命令，参数见脚本 `scripts/build-push.sh`。
- UI 改动必须先跑 `sync-ui.sh`（第 4.1 节），否则镜像里的 UI 是旧的。
- 同标签推送是覆盖语义，服务端 `docker compose pull && up -d` 即升级。
- 部署编排 `deploy/docker-compose.prod.yml` 的配置全部外置挂载；镜像内烤入的 `proxy_config.yaml` 只是"裸 docker run 兜底默认值"。

### 5.3 数据库 postgres（仅升级上游版本时）

```bash
docker pull postgres:16                     # 经 dockerd 代理拉官方镜像
docker tag postgres:16 192.168.22.6:5000/ai-gw/postgres:16
docker push 192.168.22.6:5000/ai-gw/postgres:16
```

### 5.4 监控 prometheus（仅升级上游版本时）

```bash
docker pull prom/prometheus:latest
docker tag prom/prometheus:latest 192.168.22.6:5000/ai-gw/prometheus:1
docker push 192.168.22.6:5000/ai-gw/prometheus:1
```

### 5.5 服务端使用提交后的镜像

```bash
# 部署包: /root/ai-tokengw-deploy/（配置与分支 enterprise/zh-en-i18n 一致）
# 前置: 服务器 /etc/docker/daemon.json 需含 {"insecure-registries": ["192.168.22.6:5000"]}
cd ai-tokengw-deploy
cp env.example .env && vi .env          # 填 DEEPSEEK_API_KEY（默认口令开箱可用）
bash prepare.sh                         # 生成 metrics-token
docker compose -f docker-compose.prod.yml --project-directory . pull
docker compose -f docker-compose.prod.yml --project-directory . up -d
```

### 5.6 常见问题

- **构建中途磁盘满**（报 `No space left on device`）：按 5.2 前置检查清理后**直接重跑**，已编译层有缓存不会重来。
- **时间戳标签堆积**（registry `tags/list` 里有 `2026xxxx-xxxx`）：registry 未开启删除 API（DELETE 返回 405），需在 22.6 上配置 `REGISTRY_STORAGE_DELETE_ENABLED=true` 后才能删；确认无用后可忽略。
- **不要执行 `docker builder prune -af`（不带 keep-storage）**：会清空 cargo 缓存挂载，下次 Rust 全量重编约 15 分钟。

## 6. 本机适配版 Dockerfile（/root/Dockerfile.build）

仓库原生 `Dockerfile` 在这台机器有三个问题，因此打包要用适配版（丢失时用下面命令重新生成）：

```bash
cd /opt/dev/litellm
sed -e '1{/^# syntax=/d}' \
    -e 's|^RUN npm run build$|RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build|' \
    Dockerfile > /root/Dockerfile.build
# 再补两处产品化改动（烤入默认配置 + 默认命令），重新生成后必须执行:
sed -i 's|COPY --from=builder /app/litellm-proxy-extras /app/litellm-proxy-extras|COPY --from=builder /app/litellm-proxy-extras /app/litellm-proxy-extras\n# 默认产品配置烤入镜像（外置挂载同路径时优先），裸启动即含内容审计\nCOPY --from=builder /app/deploy/proxy_config.yaml /app/proxy_config.yaml|' /root/Dockerfile.build
sed -i 's|CMD \["--port", "4000"\]|CMD ["--config", "/app/proxy_config.yaml", "--port", "4000"]|' /root/Dockerfile.build
# 校验: grep -c proxy_config.yaml /root/Dockerfile.build   # 应为 2
```

改动的原因：

1. **去掉 `# syntax=docker/dockerfile:1.7`**：该指令会联网拉取外部 frontend 镜像，本机 buildkit 解析 `auth.docker.io` 不走代理导致 `DeadlineExceeded`。去掉后使用 buildkit 内置 frontend（支持 `RUN --mount=type=cache`）。
2. **`NODE_OPTIONS=--max-old-space-size=4096`**：Next.js 16 全量构建超出 Node 默认 2GB 堆，会报 `JavaScript heap out of memory`。

## 7. 代理与镜像拉取排障

Docker 出网依赖 `192.168.24.200` 上的 Clash：

- `7890` = HTTP 代理，`7891` = SOCKS5（dockerd 当前配置走 `socks5://192.168.24.200:7891`，见 `/etc/systemd/system/docker.service.d/20-proxy.conf`）。
- 控制接口：`http://192.168.24.200:9090`（可远端切节点）。

验证国际出口（返回 401 即通）：

```bash
curl -x http://192.168.24.200:7890 -m 15 -o /dev/null -w "%{http_code}\n" https://registry-1.docker.io/v2/
```

节点整体不可用时，经控制接口测活并切换（注意 PUT 返回 204 无响应体）：

```bash
curl -sS -X PUT -H "Content-Type: application/json" \
  -d '{"name":"R9-4|狮城-NF|BGP"}' \
  "http://192.168.24.200:9090/proxies/%F0%9F%9A%80%E4%BB%A3%E7%90%86%E7%BA%BF%E8%B7%AF"
```

其它常见坑：

- `uv.lock` 与 Dockerfile 冲突（`==3.12.*` vs python3.13）：构建前确认 `grep -m1 requires-python uv.lock` 为 `>=3.10, <3.16`；本地 `uv lock` 重新生成会把它锁死在 3.12，构建前临时 `git checkout -- uv.lock`。
- 4000 端口被占：`ss -ltnp | grep :4000` 找到进程；本地 dev 后端固定用 4001。
- 构建卡在 `resolve image config for docker/dockerfile:1.7`：说明用了原生 Dockerfile，换第 6 节的适配版。
