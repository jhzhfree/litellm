# 企业微信身份提供方

本实现为 Keycloak 26.4.7 的原生身份提供方插件。启用后，管理员可在 Identity providers 中选择 `企业微信 / WeCom`，员工通过企业自建应用扫码登录。网关仍信任 Keycloak 的 issuer、JWKS 和用户 sub，无需直接接受企业微信凭据。默认 Compose 不安装插件，现有 OIDC 和本地登录方式保持原有配置。

## 支持边界

当前支持单个配置对应一个企业自建应用的网页登录。不同企业使用不同 provider alias。第三方服务商应用、代开发授权、企业微信内网页静默登录、通讯录同步、部门权限映射和单点退出不在本次实现范围内。

每次登录向企业微信获取应用 access_token，用回调 code 获取成员 userid，再读取成员确认该应用可访问成员且状态为已激活。只返回 openid 的非企业成员、禁用成员、成员不匹配及 API 失败均拒绝。应用 access_token 暂不缓存，高并发部署前需验证企业微信限额并另行实现按企业与应用隔离的凭据缓存。

插件使用 `(CorpID, UserID)` 的无歧义编码作为外部绑定键，大小写保留。用户名为该绑定键的 SHA-256 派生值。不要修改已投入使用的 CorpID 或 alias 来切换企业，否则原绑定会改变。网关使用的 sub 仍然是 Keycloak realm 用户 ID，不是企业微信 UserID。

插件不读取或信任邮箱、手机号、部门或上游角色，不自动按邮箱合并已有账户，不保存企业微信 token，不提供 token retrieval 或 token exchange。Keycloak 首次登录流程可能要求补充资料，补充的邮箱不构成企业身份依据。保留默认的现有账号关联验证，禁止启用仅凭相同邮箱自动链接的流程。插件不自动创建网关授权，严格 OIDC 模式仍要求管理员预批准网关绑定。

## 构建和启动

在仓库根目录执行，构建需要访问 Docker 官方 Maven 镜像、Maven Central 和 Keycloak 镜像仓库。网络受限时由环境管理员放行，不替换成未知镜像源。

```bash
cd identity-platform
docker compose -f compose.yaml -f compose.wecom.yaml build identity
docker compose -f compose.yaml -f compose.wecom.yaml up -d
```

覆盖文件使用 `ai-identity/keycloak-wecom:26.4.7-1` 镜像。Java 插件构建与网关 Python、Rust、Next.js 镜像独立。Dockerfile 固定 Maven 和 Keycloak 镜像 digest，并在构建阶段执行测试。更新已有平台时先备份身份数据库，不删除命名卷，不重新导入或覆盖已有 realm。

已有 JDK 21 与 Maven 3.9.9 时，也可在 `keycloak-wecom` 执行 `mvn -B verify`，将 `target/keycloak-wecom-1.0.0.jar` 放入 Keycloak 的 `/opt/keycloak/providers/`，然后重新执行 `kc.sh build` 并重启。升级 Keycloak 必须重新编译与验证 SPI 兼容性。生成的 JAR 和 Maven 缓存不提交 Git。

离线交付时先在允许联网的构建机生成镜像，再执行 `docker save`，目标机器使用 `docker load`，之后 `docker compose ... up -d --no-build --pull never`。本插件不会使企业微信登录离线可用，浏览器仍需访问企业微信登录站点，Keycloak 需访问企业微信 API。

## 企业微信侧配置

在企业微信管理后台创建或选择企业内部自建应用，记录 CorpID、AgentId 和该应用 Secret。配置允许登录的成员可见范围，并启用应用所需的企业微信授权登录能力。不要使用其他应用或通讯录同步应用的 Secret 代替。

准备可从员工浏览器访问的身份平台 HTTPS 域名，例如 `https://identity.example.internal`。在企业微信应用配置中登记对应的授权回调域及可信域名，按企业微信要求完成域名校验。若应用配置要求可信 IP，应登记身份平台访问企业微信 API 的实际出口 IP。成员信息读取权限及可见范围必须满足本插件的 `user/get` 校验，权限不足时不会降级为放行。

回调地址由 Keycloak 生成，例如：

```text
https://identity.example.internal/realms/company/broker/wecom/endpoint
```

这是企业微信到 Keycloak 的回调，不能填写网关的 `/sso/callback`。网关到 Keycloak 的登录客户端仍按原手册配置。

企业微信 API 地址固定为 `https://qyapi.weixin.qq.com`，登录地址固定为 `https://open.work.weixin.qq.com/wwopen/sso/qrConnect`。没有管理员可编辑的 API URL，避免错误配置将应用 Secret 发送到其他服务器。HTTP 客户端不跟随重定向，有连接和请求超时。企业微信接口要求 Secret 和 token 作为查询参数，生产环境应禁止 HTTP wire debug 日志，并在出口代理日志中屏蔽查询串。

## Keycloak 侧配置

在 `.env` 设置 `IDENTITY_PUBLIC_URL=https://identity.example.internal`。该变量只配置公开 hostname，不安装证书、不创建 DNS，也不自动设置 TLS 反向代理。Compose 仍绑定回环地址。TLS 在受信任反向代理终止时，按 Keycloak 官方部署指南配置代理头及可信网络，仅允许该代理连接身份服务。生产使用 `start`，不要把开发用的 `start-dev` 当作生产配置。

在业务 realm 打开 Identity providers，添加 `企业微信 / WeCom`。填写以下字段：

| 字段 | 值 |
| --- | --- |
| Alias | `wecom`，投入使用后保持稳定 |
| Display name | 企业微信 |
| Client ID | 企业 CorpID |
| Client Secret | 该自建应用 Secret，或已配置 Keycloak Vault 的引用 |
| Agent ID | 该自建应用 AgentId |
| Enabled | 开启 |
| Trust Email | 关闭 |
| Store Tokens | 关闭，插件也不会提供上游 token |
| First login flow | 默认验证流程，或经过安全审核的企业流程 |

可通过现有 Keycloak Admin API 配置同一 provider。以下是结构示例，Secret 必须由密钥设施注入请求，不要把真实值写入仓库或终端历史：

```json
{
  "alias": "wecom",
  "providerId": "wecom",
  "displayName": "企业微信",
  "enabled": true,
  "trustEmail": false,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "YOUR_CORP_ID",
    "clientSecret": "${vault.wecom_app_secret}",
    "agentId": "1000001",
    "syncMode": "IMPORT"
  }
}
```

创建接口是 `POST /admin/realms/company/identity-provider/instances`。Vault 引用只有在服务器已部署相应 Vault provider 时才可用，未解析的引用会拒绝登录。Admin API、realm 导出和数据库备份都应按敏感管理数据保护。

## 登录与网关准入

员工在网关选择 SSO，在 Keycloak 登录页点击企业微信，扫码授权后回到 Keycloak。插件通过 Keycloak 单次对象存储保存五分钟有效的随机 state，回调原子领取一次，并校验原始 broker 登录会话。缺失、错误、过期、已使用的 state 都拒绝。取消登录或后端失败也消费该次 state，需要从登录页重新开始。

首次登录产生或按安全关联流程绑定 realm 用户后，管理员在 Keycloak Users 查看用户 ID。再按配置手册的“关联已有员工”步骤将该 ID 绑定到网关。网关没有预批准绑定时拒绝登录是正常准入行为，不应关闭严格模式来绕过。

后续 Keycloak SSO 会话可能复用，企业微信成员状态检查只发生在重新经过本插件登录时。企业微信停用不会自动撤销已有 Keycloak 会话或网关会话。离职处置仍需禁用 Keycloak 用户、撤销会话和禁用网关绑定，通讯录事件同步尚未实现。

## 验证和排障

隔离测试运行 `cd identity-platform/keycloak-wecom && mvn -B verify`。测试注入企业微信响应，不发送真实企业 API 请求。正式验收需要真实企业自建应用、可信回调域名、可见范围内的测试员工和企业出口 IP。

浏览器组件回归脚本为 `keycloak-wecom/src/test/browser_smoke.py`，依赖 `httpx==0.28.1`、父目录 `requirements-smoke.txt` 固定版本的 Playwright 和本机 Chromium。启动加载插件的临时 Keycloak，监听 `127.0.0.1:18082`，使用临时引导管理员。设置 `KC_BOOTSTRAP_ADMIN_USERNAME`、`KC_BOOTSTRAP_ADMIN_PASSWORD` 后，从仓库根运行以下命令。不要使用生产管理员凭据。脚本只接受回环地址，临时创建 realm 并在结束时删除，浏览器拦截企业微信跳转，精确断言拒绝回调为 HTTP 400，405 或 500 不算通过。

```bash
python identity-platform/keycloak-wecom/src/test/browser_smoke.py
```

可通过 `WECOM_SMOKE_KEYCLOAK_URL` 指定其他回环端口，通过 `CHROMIUM_PATH` 指定 Chromium。该脚本验证插件资源注册和浏览器跳转，不能证明真实企业扫码成功。

验收时验证登录页有企业微信入口、扫码成功创建正确 realm 主体、网关预绑定后能登录、同一成员重复登录不产生新主体。还需验证非成员和禁用成员被拒绝，错误与重放回调被拒绝，其他企业同名 UserID 不会合并，原有 OIDC 登录仍可用。真实网关数据库与最终会话必须单独验收，插件测试不能替代。

出现“identity provider unexpected error”时先核对 CorpID、AgentId、应用 Secret、应用可见范围、出口 IP 和可信域名。插件刻意不将企业微信原始响应或异常 URL 输出到错误页和日志。网络超时后从登录页重新开始，不重放旧回调。

参考协议入口为企业微信官方的[扫码登录](https://developer.work.weixin.qq.com/document/path/91019)、[获取应用 access_token](https://developer.work.weixin.qq.com/document/path/91039)、[获取登录身份](https://developer.work.weixin.qq.com/document/path/98176)和[读取成员](https://developer.work.weixin.qq.com/document/path/90196)。Keycloak 扩展安装遵循[官方 Provider 指南](https://www.keycloak.org/server/configuration-provider)，接口对齐 Keycloak GitHub 的 `26.4.7` 标签。本次开发环境读取企业微信文档站返回 403，需在企业部署验收时核对官方当前应用权限要求。
