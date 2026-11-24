# 独立身份平台开发部署

首次使用请参阅[配图操作手册](USER_MANUAL.md)。
整体认证改造主方案见 [统一认证解决方案](SOLUTION.md)，覆盖 LiteLLM、Octop、AKB 的认证选择，企业 OIDC 联邦、企业目录同步、工作负载身份、SDK 和 DPoP。历史详细设计见 [设计说明书](DESIGN.md)，实施状态以主方案第二节与 [验证记录](VALIDATION.md) 为准。当前代码下的对接原理、配置字段与验证步骤见 [对接实操说明](INTEGRATION.md)。

此目录可单独使用 Docker Compose 运行，不依赖网关进程。本地 Compose 提供 Keycloak 管理台和管理 REST API。工作负载注册另由独立注册服务处理，可通过 `agentctl` 创建身份、建立网关绑定、领取凭证和停用。企业目录同步和真实网关数据库端到端验收仍待完成。

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

## 配置和日常使用

使用同一个业务 realm issuer。上生产时填写浏览器和各服务都能访问的 HTTPS 地址，例如 `https://identity.example.internal/realms/company`。每个产品使用独立客户端和自己的精确回调 URL，将密钥交由部署环境注入。由 Keycloak 发布的 realm 用户 ID（`sub`）用于关联账号，产品各自维护角色、团队和资源权限。

| 场景 | 设置和用法 |
| --- | --- |
| 复用企业员工登录 | 在业务 realm 的 **Identity providers** 中配置企业 OIDC IdP，或按 [企业微信接入指南](WECOM.md) 安装可选扫码登录插件。先用测试员工验证上游登录和 realm 主体，再让产品关联该主体。企业微信通讯录同步尚未交付。 |
| LiteLLM 员工 SSO | 为 `gateway-console` 配置授权码、S256 PKCE 和网关实际回调。设置 [SSO 环境变量](gateway-sso.env.example)，再按文档配置 `LITELLM_UNIFIED_OIDC_ISSUER` 和 JWKS。先关联一名管理员并验证登录。关联员工时在「用户 → 邀请用户 → 关联已有员工」输入 Keycloak realm 用户 ID。[网关 SSO 与员工绑定](GATEWAY_INTEGRATION.md#网关预批准员工身份接入) |
| LiteLLM 访客邀请 | 单独配置 Keycloak SMTP、访客管理客户端及受限用户属性。在「用户 → 邀请用户 → 邀请访客」先准备账号，再发送激活邮件。先用测试邮箱验收收信、验证邮箱、设置密码和登录。[访客配置](GATEWAY_INTEGRATION.md#从网关邀请访客) |
| Octop 登录 | 创建独立 Octop OIDC 客户端，填入 Octop 返回的回调地址，管理员先绑定并验证。再配置 `OCTOP_UNIFIED_OIDC_ISSUER` 和 `OCTOP_USER_AUTHENTICATION_MODE=unified_oidc`。需恢复旧模式时将认证模式设为 `legacy` 并重启。[Octop 配置与回滚](INTEGRATION.md#octop-启用与回滚) |
| Agent 注册和认证 | 配置独立注册服务、专用操作员客户端、Keycloak 管理客户端、网关管理凭证和 `gateway.invoke` scope。运行 `agentctl register`、`status` 和 `credential`。将私有凭证文件交给 Agent 运行时，运行时用 Client Credentials 换取短期 Bearer 令牌。下线时用原操作编号执行 `disable`。[部署变量、命令和验收](GATEWAY_INTEGRATION.md#通过-agentctl-注册工作负载) |
| AKB 委托访问 | 为 AKB 配置独立 audience、受信任 issuer 和 JWKS，并预先绑定用户主体。启用后知识库调用同时校验 Agent Service Key 和用户令牌。AKB 控制台统一 OIDC 登录尚未交付。[委托配置](INTEGRATION.md#45-octop-与-akb-使用同一签发者) |

## 验收命令

在 LiteLLM 仓库根目录运行。身份平台 Compose 保持启动，以下默认使用 `identity-platform/.env` 中的本地引导账号配置。

```bash
PYTHONPATH=. .venv/bin/python identity-platform/smoke_sso.py --unified-oidc
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py \
  --gateway-jwt --octop-smoke ../Octop/scripts/smoke_gateway_identity.py
```

第一条用 Chromium 完成真实 Keycloak 授权码登录并验证网关 SSO 组件。第二条验证身份生命周期、Octop 取令牌和网关 JWT 组件。真实网关启动并连上数据库后，继续运行 [agentctl 网关验收](GATEWAY_INTEGRATION.md#验收注册与停用)，并从产品界面验证员工控制台会话和访客邮件激活。本轮测试结果见 [验证记录](VALIDATION.md)。
