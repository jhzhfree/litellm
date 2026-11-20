# 独立身份平台开发部署

完整目标架构、管理 API、兼容策略、同步、部署及验收设计见 [设计说明书](DESIGN.md)。实施状态以设计文档第一节与 [验证记录](VALIDATION.md) 为准。当前代码下的对接原理、配置字段与验证步骤见 [对接实操说明](INTEGRATION.md)。

此目录可单独使用 Docker Compose 运行，不依赖网关进程。当前交付是本地开发环境，使用 Keycloak 管理页面及原生管理 REST API。网关已增加外部自主 Agent 身份适配和管理表单。统一产品管理 API、同步消费者与数据库端到端验收尚未完成。

复制 `.env.example` 为 `.env`，为两个密码生成独立随机值，然后运行。

```bash
cd identity-platform
docker compose up -d
```

管理入口为 `http://127.0.0.1:18080/admin/`，业务 realm 为 `company`。
OIDC discovery 为 `http://127.0.0.1:18080/realms/company/.well-known/openid-configuration`。

中英文切换：`company` realm 已在 `realm.json` 启用国际化（`en` / `zh-CN`，默认英文），登录页右上角下拉框可即时切换并记住选择（Keycloak locale cookie）。管理控制台登录页同样可切换；进入管理台后在用户菜单 → Manage account → Personal info → Select a locale 选择中文并保存。`master` realm 的国际化已通过管理 API 开启（配置存在身份数据库卷中）；若重建身份数据库卷，需重新对 `master` realm 设置 `internationalizationEnabled=true`、`supportedLocales=["en","zh-CN"]`。

Keycloak 原生管理 API 使用 `/admin/realms/company/users` 和 `/admin/realms/company/clients` 管理用户与应用。调用需要具备相应 realm 管理权限的访问令牌。不要将引导管理员凭据用于产品集成。

`gateway-console` 为授权码登录客户端，启用 PKCE S256。启动后在管理台设置或轮换其客户端密钥，将密钥通过环境配置交给网关。没有预置用户密码或客户端密钥。

当前 Compose 仅绑定回环地址，使用 `start-dev`，不得作为生产部署模板。正式部署需要 HTTPS、固定镜像摘要、备份恢复、受限管理客户端及生产启动方式。数据库使用独立命名卷，不使用网关数据库。

首次启动导入 realm。后续修改 JSON 不会覆盖已存在的 realm，应通过管理 API 执行受控更新。

关闭保留数据使用 `docker compose down`。不要用 `down -v`，它会删除身份数据库。


## 本地用户登录联调

网关 Python 开发依赖之外，浏览器烟测需要 `requirements-smoke.txt` 中的 Playwright 和本机 Chromium。脚本默认使用 `/usr/bin/chromium`，可以通过 `IDENTITY_TEST_CHROMIUM` 指定已安装的浏览器。不得为下载浏览器或 Prisma 绕过环境网络限制。

在仓库根目录执行以下命令，先确保本目录开发 Compose 已启动且 .env 保存了本地引导管理员配置。

```bash
.venv/bin/pip install -r identity-platform/requirements-smoke.txt
PYTHONPATH=. .venv/bin/python identity-platform/smoke_sso.py
```

脚本创建临时用户和授权码客户端，浏览器登录本地 Keycloak，使用网关真实通用 SSO 适配器换取令牌及映射用户，并检查缺少 state、错误 Cookie state、回调重放被拒绝。退出时删除临时用户和客户端，不发送邮件，不打印密码或令牌。引导管理员仅用于测试对象的创建和清理。

浏览器回调由测试拦截，再在进程内调用网关适配器；测试不会启动网关监听端口，也不会写入网关数据库或创建控制台会话。不能用此测试替代完整产品登录验收。
