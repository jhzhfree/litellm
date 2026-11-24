# 分组件镜像部署

构建分别使用 `docker/split/build.sh native`、`gateway` 和 `ui`，每次设置 `IMAGE_TAG`。构建 gateway 时必须指定已经构建好的 `NATIVE_IMAGE`。Rust 没有变化时不运行 native 构建。原生产 Compose 现在要求明确设置 `PYTHON_IMAGE` 和 `UI_IMAGE`。

Rust 产物镜像提供构建期 wheel，不是运行时网络服务。Python 镜像内包含匹配的原生扩展，Rust 变更后需要重新组装 Python 镜像。不可把不同架构、Python ABI 或系统库版本的产物混用。当前不使用可变共享卷覆盖原生扩展，避免版本漂移。

UI 为 Next.js 静态导出，由 Nginx 提供，不需要运行 Node SSR。Python 核心使用完整 CLI 提供管理与推理接口。`nginx.split.conf` 必须和 Compose 一起交付，UI 监听原 CORE_PORT，核心仅容器内暴露 4000。数据库卷及监控抓取 core 的地址保持不变。

更新前端只需加载或拉取新 UI 镜像，修改 UI_IMAGE，执行以下命令。

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps ui
```

更新 Python 时修改 PYTHON_IMAGE 并更新 core，随后重建 ui 以重新解析 core 的容器地址。

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps core
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate ui
```

独立前端代理覆盖 /ui、静态资源、API 和 WebSocket。SSO 的外部回调地址仍应指向公开入口。若前置 HTTPS 终止代理，需要部署时配置可信转发头，不能盲目信任任意来源。

当前只通过 Compose 配置解析与 shell 语法校验。基础镜像 cgr.dev 拉取返回 Forbidden，尚未完成拆分镜像构建和运行验收。不能将本文当作已经完成生产发布的证明。

## 管理控制台入口

网关管理员可在侧栏「设置」中打开独立身份平台和 Prometheus 控制台。在网关核心服务的运行环境设置以下可选变量。使用本文的生产 Compose 或离线 Compose 时，可将变量加到对应的 `.env`，然后重新创建核心服务容器。

```dotenv
LITELLM_UI_IDENTITY_ADMIN_URL=https://identity.example.internal/admin/
LITELLM_UI_PROMETHEUS_URL=https://monitor.example.internal/
```

地址应是管理员浏览器可达的完整 HTTP(S) URL，可包含部署路径。留空时隐藏对应入口。内网生产部署建议通过 HTTPS 暴露已授权的控制台地址。网关在新标签页打开控制台，身份平台和 Prometheus 仍由各自的访问控制或认证反向代理保护。
