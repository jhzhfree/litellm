# 独立身份平台开发部署

完整目标架构、管理 API、兼容策略、同步、部署及验收设计见 [设计说明书](DESIGN.md)。实施状态以设计文档第一节与 [验证记录](VALIDATION.md) 为准。

此目录可单独使用 Docker Compose 运行，不依赖网关进程。当前交付是本地开发环境，使用 Keycloak 管理页面及原生管理 REST API。统一产品管理 API、同步消费者和网关认证适配尚未完成。

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
