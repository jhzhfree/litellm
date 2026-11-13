# 本地开发环境指南（AI-Tokengw）

> 适用机器：`192.168.24.202`（宿主机），仓库路径 `/opt/dev/litellm`，分支 `enterprise/zh-en-i18n`。
> 机器配置：31GB 内存 / 8 核（2026-11-12 扩容）。
> 最后更新：2026-11-12。

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

## 5. 改完代码打包 Docker 镜像（tag 不变）

```bash
cd /opt/dev/litellm

# 1) 重新构建（-f 用本机适配版 Dockerfile，见第 6 节）
docker buildx build --builder default --load --target runtime \
  -t docker.litellm.ai/berriai/litellm:main-stable \
  --build-arg HTTP_PROXY=http://192.168.24.200:7890 \
  --build-arg HTTPS_PROXY=http://192.168.24.200:7890 \
  --build-arg http_proxy=http://192.168.24.200:7890 \
  --build-arg https_proxy=http://192.168.24.200:7890 \
  --build-arg NO_PROXY=localhost,127.0.0.1,db,.svc,.local \
  --build-arg no_proxy=localhost,127.0.0.1,db,.svc,.local \
  -f /root/Dockerfile.build .

# 2) 只替换网关容器（不重建 db / prometheus）
docker compose up -d --force-recreate --no-deps litellm

# 3) 验证
curl http://192.168.24.202:4000/health/liveliness   # 期望 "I'm alive!"
```

要点：

- `docker compose up -d` **不会重建镜像**，改码后必须先 build（或带 `--build`）。
- 同 tag 重建是覆盖语义，旧镜像变 dangling；`--force-recreate --no-deps litellm` 才会让容器换新镜像。
- 代理 `--build-arg` 不能省：构建内 npm / PyPI / apk / Prisma 下载都走它。
- 依赖层有缓存：只改业务代码时 `uv sync` 层命中缓存，增量很快；改 `pyproject.toml` / `uv.lock` 才会全量重装。

## 6. 本机适配版 Dockerfile（/root/Dockerfile.build）

仓库原生 `Dockerfile` 在这台机器有两个问题，因此打包要用适配版（丢失时用下面命令重新生成）：

```bash
cd /opt/dev/litellm
sed -e '1{/^# syntax=/d}' \
    -e 's|^RUN npm run build$|RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build|' \
    Dockerfile > /root/Dockerfile.build
```

两处改动的原因：

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
