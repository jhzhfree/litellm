# 统一身份认证平台与 AI 治理网关对接说明（实操版）

文档更新：2026-11-19。源码基线：当前分支 `litellm_identity_platform_integration`（HEAD `07d9b86a`）。

## 0. 先读这一节：本文的定位与交付状态

本目录已有三份文档，分工不同，不要混用：

| 文档 | 定位 |
|---|---|
| `DESIGN.md` | **目标态设计规格**。描述拟建设的统一身份平台、产品管理 API、事件同步、`external_oidc` 新配置结构等。文中“拟新增/目标”**均未实现**，示例配置不能直接用于当前版本。 |
| `VALIDATION.md` | 已通过的集成验证记录（组件级）。 |
| 本文 `INTEGRATION.md` | **当前代码下的对接原理与可操作配置**：哪些链路已经能用、怎么配、怎么验证、哪些还没有打通。 |

一句话结论：

- **已经打通**：Keycloak 独立身份平台 + 网关 `JWTHandler` 的**令牌验签组件联调**（JWKS 验签、issuer/audience 校验、错误 audience 拒绝）。
- **框架具备但未联调**：浏览器 SSO 登录（网关 `/sso/key/generate` → `/sso/callback`、UI 的 SSO 按钮/自动跳转），但 Keycloak 尚未注册为网关的 `GENERIC_*` provider，`deploy/proxy_config.yaml` 也没有 JWT 信任锚配置。
- **仅设计未实现**：统一管理 API、身份同步、Agent 外部身份绑定经完整业务链路、`external_identity` 的生产调用、`external_oidc` 新配置结构。

当前运行中的网关配置 `deploy/proxy_config.yaml` **没有任何 JWT 配置项**（已核对 `jwks|issuer|audience|jwt` 零命中）；要启用对接必须先按第 4 节修改配置并重启/重载网关。

---

## 1. 对接组件与网络拓扑

```
┌────────────── 身份平台（独立栈） ──────────────┐
│ Keycloak 26.4.7 :18080(回环) + 独立 PostgreSQL │
│   realm: company                              │
│   ├─ gateway-console  授权码 + PKCE S256        │
│   ├─ ai-governance-gateway  bearerOnly 资源客户端│
│   └─ roles: gateway-user / gateway-agent       │
└───────┬─────────────────────────┬──────────────┘
        │ OIDC discovery/JWKS/token│ 管理 REST API
┌───────▼────────┐         ┌───────▼────────┐
│ 网关 JWTHandler│         │ smoke.py/管理员 │
│ (验签/声明映射) │         └────────────────┘
└───────┬────────┘
        │ enable_jwt_auth → auth_jwt()
┌───────▼───────────────────────────────────────┐
│ AI 治理网关：Proxy :4000/4001 + UI :3000/4000  │
│ general_settings.litellm_jwtauth + GENERIC_*   │
└───────────────────────────────────────────────┘
```

关键文件：

- 身份平台：`identity-platform/compose.yaml`、`realm.json`、`smoke.py`、`.env`（`IDENTITY_DB_PASSWORD` / `IDENTITY_ADMIN_USER` / `IDENTITY_ADMIN_PASSWORD`）
- 网关 JWT：`litellm/proxy/auth/handle_jwt.py`（`JWTHandler`）、`litellm/proxy/auth/user_api_key_auth.py`（请求分派）
- 配置类型：`litellm/proxy/_types.py` 的 `LiteLLM_JWTAuth`（4938 起）、`JWTIssuerConfig`（4843 起）、`RoleMapping`（4781）
- 启动初始化：`litellm/proxy/proxy_server.py:11372-11404`（`initialize_jwt_auth`）
- SSO：`litellm/proxy/management_endpoints/ui_sso.py`（`/sso/key/generate` 1140 起、`/sso/callback` 2297 起）、`litellm/proxy/config_resolvers/sso.py`（环境变量映射）
- UI：`ui/litellm-dashboard/src/app/login/LoginPage.tsx`（SSO 按钮/自动跳转）

---

## 2. 对接原理

### 2.1 信任锚：issuer + JWKS + audience

网关验签只信任三件事，缺一不可：

1. **issuer（`iss`）**：令牌签发者。Keycloak 为 `http://127.0.0.1:18080/realms/company`（生产应换成 HTTPS 公网地址）。
2. **JWKS（公钥集）**：网关从 `issuer + /protocol/openid-connect/certs` 拉取公钥并缓存，用于验证 RS256 签名。缓存参数 `public_key_ttl` 默认 600 秒，`public_key_stale_ttl` 默认 3600 秒（IdP 短暂不可用时仍可使用上次公钥；设为 0 则 fail-closed）。
3. **audience（`aud`）**：令牌目标受众。身份平台通过 **audience mapper** 把 `ai-governance-gateway` 写进 access token；网关期望同一字符串。错误 audience 必须拒绝——这是 `smoke.py --gateway-jwt` 的断言之一。

代码行为（`handle_jwt.py:1096-1141`）：

- 配置 `issuers` 时，按 token 未验签的 `iss` 路由到对应 issuer 的 JWKS 与 audience（`_get_configured_issuer`）。
- **`issuers` 是附加路由，不是白名单**：`iss` 未命中任何条目时回退到全局 `JWT_ISSUER` / `JWT_AUDIENCE` 路径。若两者都没配，PyJWT 只验签与过期时间（会打印警告）——**任何共享同一 IdP 签名密钥的应用令牌都会被接受**，生产必须避免。
- `JWTIssuerConfig` 校验器强制：`audience` 与 `disable_audience_validation` 二选一，不能都不填，也不能同时填。

### 2.2 机器对机器（M2M）令牌认证链路

适用于应用/Agent 用 Client Credentials 拿 token 调网关 API：

1. 应用在 Keycloak 注册 service account client，拿到 `client_id` / `client_secret`。
2. 用 `grant_type=client_credentials` 换取 access token（Keycloak 默认 300 秒，见 `realm.json` 的 `accessTokenLifespan`）。
3. 请求网关：`Authorization: Bearer <access_token>`。
4. `user_api_key_auth.py:2367,2391,2414`：`enable_jwt_auth` 为真 → 调用 `jwt_handler.auth_jwt(token)`。
5. `JWTHandler` 走 issuer 路由 → 拉 JWKS → 验签 → 校验 `iss`/`aud`/`exp` → 提取 claims。
6. claims 映射为网关身份：用户 ID / 邮箱 / 团队 / 组织 / Agent，随后走原有虚拟 key、预算、限流、护栏逻辑。
7. `agent_id_jwt_field` 可把 `azp`/`client_id` 等 claim 与已注册 Agent 绑定（`handle_jwt.py:2569`、`proxy_server.py:11404` 的 `global_agent_registry`）。

**注意**：`/chat/completions` 等业务授权（角色、模型权限、预算）目前只在 JWT 验签组件上验证过；外部应用 token 走完整网关 HTTP 路径访问资源的端到端业务授权尚未验收。

### 2.3 claims → 网关身份映射（真实字段名）

全部定义在 `litellm/proxy/_types.py` 的 `LiteLLM_JWTAuth` / `JWTIssuerConfig`。常用字段：

| 字段 | 作用 |
|---|---|
| `user_id_jwt_field` | 映射到网关用户 ID（Keycloak 常用 `sub`） |
| `user_email_jwt_field` | 用户邮箱（Keycloak 常用 `email`） |
| `user_id_upsert` | 用户不存在时自动创建（JIT 开户），默认 `false` |
| `team_ids_jwt_field` / `team_id_jwt_field` | 团队 ID 列表 / 单个团队 ID |
| `team_id_upsert` | 团队不存在时自动创建，默认 `false` |
| `org_id_jwt_field` / `end_user_id_jwt_field` | 组织 / 终端用户 ID |
| `agent_id_jwt_field` | 调用方 Agent 标识（匹配已注册 Agent 的 ID 或名称，支持点号路径） |
| `roles_jwt_field` + `role_mappings` + `object_id_jwt_field` | v2 RBAC：从 claim 取值映射到网关内部角色（`RoleMapping`：`role` → `internal_role`） |
| `enforce_rbac` | 是否强制 RBAC，默认 `false` |
| `admin_jwt_scope` | 管理路由所需 scope，默认 `litellm_proxy_admin` |
| `virtual_key_claim_field` + `unregistered_jwt_client_behavior` | JWT claim → 已有虚拟 key 映射，让应用继承其模型权限/预算（见 `terraform/provider/docs/resources/jwt_key_mapping.md`） |
| `issuers` | 多 issuer 路由，每项含 `issuer` / `jwks_url` / `audience` 及该 issuer 专属的 claim 映射字段 |

**容易写错的字段名**（代码中不存在或含义不同）：`jit_fetch_roles`、`common_parameters` 不存在；`role_mapping` 应为复数 `role_mappings`；`enforced_params` 是虚拟 key 预算参数，不是 JWT 配置。

### 2.4 浏览器 SSO 登录链路（框架已有，Keycloak 未联调）

网关已有通用 SSO 框架，流程：

```
用户点 UI「SSO 登录」/自动跳转
  → GET /sso/key/generate?return_to=...
  → 302 到 IdP authorize 端点（授权码 + PKCE S256）
  → 用户登录 Keycloak
  → IdP 302 回 <网关>/sso/callback（带 code/state）
  → 网关后端用 code 换 token、拉 userinfo、建会话并跳回 UI
```

- UI 是否显示 SSO 按钮由 `/.well-known/litellm-ui-config` 下发的 `sso_configured` 决定；自动跳转由 `auto_redirect_to_sso` 决定（`ui_discovery_endpoints.py:17-56`）。
- Keycloak 侧客户端为 `gateway-console`（`realm.json:10-27`），启用 `standardFlowEnabled`、`pkce.code.challenge.method=S256`，`publicClient: false`（confidential，需要 client secret）。
- 当前 `redirectUris` 只有 `http://127.0.0.1:4001/sso/callback`（本地 dev 后端）。要接 4000 产品栈或生产域名，必须通过管理 API 改成实际网关回调地址，且必须与 `PROXY_BASE_URL` 一致。
- `DESIGN.md` 要求的 state/nonce/PKCE 事务绑定、`issuer+sub` 稳定映射库、HttpOnly Secure Cookie 尚未按目标态验收，浏览器链路不能标记为打通。

### 2.5 external_identity 模块的定位

`litellm/proxy/auth/external_identity.py` 只有 60 行：对**已验签**的 claims 按 `iss`/`aud`/`azp`/`sub`/`scope`/`identity_kind`/`act` 分类为自主工作负载或委托身份，并给出拒绝原因。**没有生产调用方**，测试仅 `tests/unit/proxy/auth/test_external_identity.py`。不要把它当成 JWT 验证器使用——密码学验签必须先由 `JWTHandler` 完成。

---

## 3. 身份平台侧配置

### 3.1 启动

```bash
cd /opt/dev/litellm/identity-platform
cp .env.example .env
# 为 IDENTITY_DB_PASSWORD、IDENTITY_ADMIN_PASSWORD 生成不同的随机值
python3 -c 'import secrets; print(secrets.token_urlsafe(24)); print(secrets.token_urlsafe(24))'
docker compose up -d
```

- 管理台 `http://127.0.0.1:18080/admin/`，业务 realm `company`
- OIDC discovery `http://127.0.0.1:18080/realms/company/.well-known/openid-configuration`
- 就绪判断：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/realms/company`（200 即就绪；`start-dev` 下 `/health/ready` 返回 404）
- 停止用 `docker compose down`，**禁止 `down -v`**（删除身份数据库卷）

### 3.2 realm 与客户端（`realm.json`，首次导入生效）

```json
{
  "realm": "company",
  "accessTokenLifespan": 300,
  "internationalizationEnabled": true,
  "supportedLocales": ["en", "zh-CN"],
  "defaultLocale": "en",
  "clients": [
    {"clientId": "gateway-console", "standardFlowEnabled": true,
     "attributes": {"pkce.code.challenge.method": "S256"},
     "redirectUris": ["http://127.0.0.1:4001/sso/callback"]},
    {"clientId": "ai-governance-gateway", "bearerOnly": true}
  ]
}
```

浏览器 SSO 与 API audience 的分工：`gateway-console` 是用户登录客户端，`ai-governance-gateway` 是资源客户端（不参与登录，只作为 `aud`）。

### 3.3 audience mapper（关键，决定网关是否接受 token）

`smoke.py:36-46` 注册 service account client 时挂了 mapper：

```python
'protocolMapper': 'oidc-audience-mapper',
'config': {
    'included.custom.audience': 'ai-governance-gateway',
    'access.token.claim': 'true',
    'id.token.claim': 'false',
}
```

手工配置时：Keycloak 管理台 → Clients → 目标客户端 → Client scopes → Add mapper → Audience → Included Client Audience 选 `ai-governance-gateway`，勾选 Add to access token。没有这一步，网关侧配了 `audience` 也会拒绝 token。

### 3.4 创建用户/应用与签发令牌

原生管理 API（管理员 token 获取见 `smoke.py:24-31`）：

- `POST /admin/realms/company/users`：创建用户
- `POST /admin/realms/company/clients`：注册应用（service account）
- `GET  /admin/realms/company/clients/<id>/client-secret`：取应用密钥

换 token：

```bash
TOKEN=$(curl -s -X POST \
  -d 'grant_type=client_credentials' \
  -d 'client_id=<你的应用 client_id>' \
  -d 'client_secret=<你的应用 client_secret>' \
  http://127.0.0.1:18080/realms/company/protocol/openid-connect/token \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
```

不要使用引导管理员账号做产品集成；管理员凭据只用于身份平台管理。烟测脚本会自动清理创建的临时用户/应用。

### 3.5 中英文切换（已配置）

登录页右上角下拉框即时切换并记住选择；管理台在用户菜单 → Manage account → Personal info → Select a locale 选中文并保存。`master` realm 的 i18n 通过管理 API 开启，存于身份数据库卷；重建卷需重新设置。

---

## 4. 网关侧配置

### 4.1 启用 M2M JWT 认证（当前代码可用配置）

编辑 `deploy/proxy_config.yaml` 的 `general_settings`（**必须放在 `general_settings` 下，不能顶层写 `litellm_jwtauth`**；顶层误配会被 `_warn_on_misplaced_jwt_keys` 拒绝）：

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  store_model_in_db: true
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: sub
    user_email_jwt_field: email
    user_id_upsert: true
    team_ids_jwt_field: groups          # 若 Keycloak token 中带 groups 再配
    issuers:
      - issuer: http://127.0.0.1:18080/realms/company
        jwks_url: http://127.0.0.1:18080/realms/company/protocol/openid-connect/certs
        audience: ai-governance-gateway
        user_id_jwt_field: sub
        user_email_jwt_field: email
```

要点：

- `issuer` 必须与 Keycloak discovery 的 `issuer` **逐字一致**（含协议、主机、端口、realm 名）。
- `jwks_url` 可省略，省略时从 issuer 的 OIDC discovery 自动发现；显式写出更利于排障。
- `audience` 与 `disable_audience_validation` 二选一；**不要为了省事关闭 audience 校验**（共享签名密钥的其他应用 token 会被接受）。
- 生产环境应同时设置全局 `JWT_ISSUER` 与 `JWT_AUDIENCE` 环境变量，兜住 `issuers` 未命中的回退路径；或确保未命中时网关拒绝（不要留空走无作用域模式）。
- 也可用环境变量替代 issuer 级配置：`JWT_ISSUER`（= Keycloak issuer）、`JWT_AUDIENCE`（= `ai-governance-gateway`）、`JWT_PUBLIC_KEY_URL`（= JWKS URL）。`initialize_jwt_auth` 会把 `os.environ/XXX` 形式的值解析为环境变量。
- 修改配置后重启或触发配置热重载；用 `curl .../health/liveliness` 与网关日志确认启动无报错。

### 4.2 角色与权限映射（按实际需要开启）

Keycloak realm 中 `gateway-user`、`gateway-agent` 只是声明，**当前代码没有任何分支读取这两个角色**。要赋予网关角色，必须配置映射（RBAC）：

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: sub
    enforce_rbac: true
    roles_jwt_field: realm_access.roles
    role_mappings:
      - role: gateway-user
        internal_role: internal_user       # RBAC_ROLES 合法值：proxy_admin / team / internal_user
      - role: gateway-agent
        internal_role: internal_user
```

字段含义：`roles_jwt_field` 指向 token 中角色 claim（支持 `realm_access.roles` 这类点号路径，由 `get_nested_value` 解析）；`role_mappings` 把 IdP 角色映射到网关内部角色（`RoleMapping`：`role` → `internal_role`，合法值来自 `_types.py:4761` 的 `RBAC_ROLES`，**只有** `proxy_admin` / `team` / `internal_user`）；`object_id_jwt_field` 指定映射对象所在的 claim；管理员路由另需 `admin_jwt_scope`（默认 `litellm_proxy_admin`）scope。注意 SSO 配置里的 `role_mappings`（`ui_sso.py`）用的是另一套 `LitellmUserRoles` 值（可含 `proxy_admin_viewer`），不要与 JWT 的 `RBAC_ROLES` 混淆。自定义角色需要在 Keycloak 里通过协议 mapper 写入 token（例如把 realm role 放进 `roles` 或 `groups` claim），否则 `roles_jwt_field` 取不到值。

Agent 身份：`agent_id_jwt_field: azp`（或 `client_id`）可让 service account 与已注册 Agent 绑定；绑定失败会拒绝请求，先确认 Agent 注册表里有对应 ID/名称。

JWT → 虚拟 key 映射（可选）：设置 `virtual_key_claim_field: client_id` 后，每个应用可用已有虚拟 key 的模型权限、预算、限流；未注册策略用 `unregistered_jwt_client_behavior` 控制。

### 4.3 浏览器 SSO 接入 Keycloak（框架具备，需联调验证）

第一步：Keycloak 侧给 `gateway-console` 设置 client secret（管理台 Clients → Credentials），并把回调地址改为实际网关地址，例如 `https://<gateway-host>/sso/callback`。当前 `realm.json` 写死 `http://127.0.0.1:4001/sso/callback`，生产必须改。

第二步：网关 `.env` 配置（字段名来自 `litellm/proxy/config_resolvers/sso.py:26-50`）：

```bash
GENERIC_CLIENT_ID=gateway-console
GENERIC_CLIENT_SECRET=<Keycloak 中生成的 client secret>
GENERIC_AUTHORIZATION_ENDPOINT=http://127.0.0.1:18080/realms/company/protocol/openid-connect/auth
GENERIC_TOKEN_ENDPOINT=http://127.0.0.1:18080/realms/company/protocol/openid-connect/token
GENERIC_USERINFO_ENDPOINT=http://127.0.0.1:18080/realms/company/protocol/openid-connect/userinfo
GENERIC_SCOPE=openid email profile
PROXY_BASE_URL=http://127.0.0.1:4000
AUTO_REDIRECT_UI_LOGIN_TO_SSO=false
```

- `PROXY_BASE_URL` 决定 `/sso/key/generate` 生成的回调地址；必须与 Keycloak `redirectUris` 逐字一致。
- SSO 角色/团队映射走 `role_mappings` / `team_mappings`（`litellm/types/proxy/management_endpoints/ui_sso.py:198-208`），可通过 SSO 配置 API 设置。
- UI 侧：`AUTO_REDIRECT_UI_LOGIN_TO_SSO=true` 或 `general_settings.auto_redirect_ui_login_to_sso: true` 可让登录页自动跳转；否则显示 SSO 按钮。
- **现状提醒**：以上配置在仓库样例中没有针对 Keycloak 的成套落地；`/sso/callback` 走 Google/Microsoft/GENERIC 的既有路径，`DESIGN.md` 的 `external_oidc` 新结构（`general_settings.authentication`）**未实现**，不要照抄 `DESIGN.md` 的配置示例到当前版本。

### 4.4 配置落点核对清单

- `enable_jwt_auth` 与 `litellm_jwtauth` 在 `general_settings` 下；顶层会被拒绝。
- `issuers[].audience` 或 `disable_audience_validation: true` 必须二选一。
- `os.environ/XXX` 形式的值会在启动时由 `get_secret` 解析（`proxy_server.py:11382-11394`）。
- 多 issuer 场景：每个 issuer 可单独覆盖 claim 映射字段；未命中的 `iss` 走全局环境变量路径。

---

## 5. 端到端验证步骤

### 5.1 组件级（已通过，可重复）

```bash
cd /opt/dev/litellm
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py --gateway-jwt
```

预期输出（3 项 PASS）：

```
PASS gateway JWT verifies live Keycloak signature and claims
PASS gateway JWT rejects wrong audience
PASS discovery, user create/read/disable, application registration, client credentials issuance
```

这一步验证的是：真实 Keycloak 签名、JWKS 拉取、issuer/audience 校验、错误 audience 拒绝；不等于业务接口授权通过。

### 5.2 M2M 令牌调用网关（配置完成后）

```bash
# 1) 取 token（见 3.4）
# 2) 调网关 API
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:4000/v1/models
```

- 200：认证与授权通过；403：认证通过但角色/团队权限不足；401：验签失败、issuer/audience 不匹配或 token 过期（默认 300 秒）。
- 负例：把 `audience` 改成错误值签发 token，应得 401；把 `iss` 改成别的值，应回退到全局路径并被拒。

### 5.3 浏览器 SSO（联调时）

1. 确认 `GENERIC_*` 与 `PROXY_BASE_URL` 已配、网关重启。
2. 打开管理 UI 登录页，确认 SSO 按钮可用或自动跳转。
3. 在 Keycloak 登录，观察回调是否命中 `/sso/callback` 并跳回 UI。
4. 用浏览器开发者工具核对 authorize 请求中的 `state`、`code_challenge` 与回调后的会话 Cookie 是否符合目标态安全要求（这部分尚未按 `DESIGN.md` 验收）。

---

## 6. 安全与生产注意

- 身份平台当前 `start-dev` + 仅回环 HTTP，**不可作为生产模板**；生产需 HTTPS、固定镜像摘要、备份恢复、受限管理客户端。
- audience 必须配置为专用资源客户端；不要关闭 audience 校验，也不要让 `JWT_ISSUER` / `JWT_AUDIENCE` 双双留空。
- 客户端密钥、管理员密码只放环境变量/密钥管理，不写进 realm.json 或配置文件；`deploy/.env`、`identity-platform/.env` 不要提交。
- JWKS 缓存有陈旧容忍窗口（`public_key_stale_ttl` 默认 3600 秒）；密钥轮换后如需立即失效，调小该值或缩短 token 有效期。
- `user_id_upsert` / `team_id_upsert` 会 JIT 创建用户/团队，开启前确认 IdP 用户可控且 claim 可信。
- 管理台引导管理员只用于初始化；`gateway-console` 的 secret 轮换后需同步更新网关 `GENERIC_CLIENT_SECRET` 并重启。

---

## 7. 当前状态 vs 目标态（勿误判）

| 能力 | 当前代码 | DESIGN.md 目标 |
|---|---|---|
| JWT 验签（M2M） | `enable_jwt_auth` + `litellm_jwtauth.issuers`，组件级实测通过 | 保留并扩展 |
| claims → 用户/团队/Agent | 字段已在 `_types.py` 定义并有通用链路 | 统一身份模型 |
| 浏览器 SSO | GENERIC_* 框架可用，Keycloak 未注册联调 | `general_settings.authentication.providers` 新结构（**未实现**） |
| 角色 | `role_mappings` 需显式配置；`gateway-user/agent` 未被读取 | 统一管理 API + 角色投影 |
| external_identity | 仅策略分类器，无生产调用方 | 接入请求链路做工作负载/委托身份判定 |
| 应用/Agent 业务授权 | 未做完整 HTTP 路径验证 | 端到端验收 |
| 统一管理 API/同步 | 无 | 产品 API + Outbox 事件 + 投影表（均未实现） |

---

## 8. 故障排查

| 现象 | 定位 |
|---|---|
| 401 / `Invalid audience` | token 的 `aud` 与 `issuers[].audience` 不一致；检查 audience mapper 是否加到 access token |
| 401 / `Invalid issuer` | `issuer` 与 Keycloak discovery 的 `issuer` 字符串不一致（协议/端口/尾斜杠） |
| JWKS 拉取超时 | 网关到 `127.0.0.1:18080` 网络不通；生产用 HTTPS 公网地址；检查 `JWT_PUBLIC_KEY_URL` |
| 启动报 `must configure audience` | `JWTIssuerConfig` 要求 `audience` 或 `disable_audience_validation` 二选一 |
| 顶层配置不生效 | `litellm_jwtauth` 必须写在 `general_settings` 下，顶层会触发 `_warn_on_misplaced_jwt_keys` |
| token 很快过期 | `realm.json` 的 `accessTokenLifespan` 默认 300 秒，用 client credentials 重新获取 |
| SSO 按钮不可用 | `/.well-known/litellm-ui-config` 的 `sso_configured=false`，检查 `GENERIC_*` 是否配置且网关已重启 |
| SSO 回调 302 回 IdP | `PROXY_BASE_URL` 生成的 callback 与 Keycloak `redirectUris` 不一致 |
| 网关日志 `neither JWT_AUDIENCE nor JWT_ISSUER` | 全局回退路径无作用域，生产必须补齐这两个环境变量 |

---

## 9. 参考文件

- `identity-platform/DESIGN.md`（目标态设计，非当前实现）
- `identity-platform/VALIDATION.md`（已通过的组件级验证）
- `identity-platform/realm.json` / `smoke.py` / `compose.yaml`
- `litellm/proxy/_types.py`（`LiteLLM_JWTAuth` / `JWTIssuerConfig` / `RoleMapping`）
- `litellm/proxy/auth/handle_jwt.py`（`JWTHandler`）
- `litellm/proxy/management_endpoints/ui_sso.py`、`litellm/proxy/config_resolvers/sso.py`
- `tests/e2e/gateway/perf_ci_config.yml`（JWT 配置样例）
- `terraform/provider/docs/resources/jwt_key_mapping.md`（JWT → 虚拟 key 映射）
