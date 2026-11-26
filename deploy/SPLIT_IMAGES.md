# 拆分镜像部署

网关拆成三个按功能命名的镜像，另有两个数据面镜像保持不变：

| 镜像 | 作用 | 运行时 |
| --- | --- | --- |
| `ai-gw/rust:1` | Rust 编译产物 wheel（python-bridge 的 `_native` 与 proxy gateway 扩展） | 否，仅构建期 |
| `ai-gw/python:1` | 完整 litellm proxy，容器监听 4000 | 是 |
| `ai-gw/ui:1` | Next.js 静态导出，nginx 监听 3000 并反代 API 到 core | 是 |
| `ai-gw/postgres:16` | 数据库 | 是 |
| `ai-gw/prometheus:1` | 监控 | 是 |

Rust 产物镜像提供构建期 wheel，不是运行时网络服务。python 镜像构建时用 `NATIVE_IMAGE` 指向 rust 镜像取出 wheel，因此 Rust 源码不变时 cargo 层命中缓存，改 UI 或 Python 代码都不会触发 Rust 重编。不可混用不同架构、Python ABI 或系统库版本的产物。

UI 是静态导出，由 nginx 提供，不运行 Node SSR。独立 UI 容器通过 `deploy/nginx.split.conf` 把 API 反代到 `core:4000`，核心服务只在容器内暴露 4000。数据库卷与监控抓取 core 的地址不变。

构建与推送使用 `scripts/build-split.sh`，按依赖顺序构建 rust、python、ui，只推固定标签。

```bash
scripts/build-split.sh
```

更新前端只需重建并替换 ui 镜像。

```bash
scripts/build-split.sh --only ui
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps ui
```

更新 Python 时重建 python 镜像并替换 core，随后重建 ui 以重新解析 core 的容器地址。

```bash
scripts/build-split.sh --only python
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps core
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate ui
```

独立前端代理覆盖 `/ui`、静态资源、API 和 WebSocket。SSO 的外部回调地址仍应指向公开入口。若前置 HTTPS 终止代理，需要部署时配置可信转发头，不能盲目信任任意来源。

## 管理控制台入口

网关管理员可在侧栏「设置」中打开独立身份平台和 Prometheus 控制台。在网关核心服务的运行环境设置以下可选变量。使用本文的生产 Compose 或离线 Compose 时，可将变量加到对应的 `.env`，然后重新创建核心服务容器。

```dotenv
LITELLM_UI_IDENTITY_ADMIN_URL=https://identity.example.internal/admin/
LITELLM_UI_PROMETHEUS_URL=https://monitor.example.internal/
```

地址应是管理员浏览器可达的完整 HTTP(S) URL，可包含部署路径。留空时隐藏对应入口。内网生产部署建议通过 HTTPS 暴露已授权的控制台地址。网关在新标签页打开控制台，身份平台和 Prometheus 仍由各自的访问控制或认证反向代理保护。
