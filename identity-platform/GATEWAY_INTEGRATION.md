# 复用网关认证的接入步骤

本实现复用通用 SSO、JWTHandler 和既有 Agent 授权，不增加另一个密码认证服务。未绑定身份的 Agent 继续采用原有调用者权限规则。外部受管 Agent 目前仅支持 autonomous，delegated 和 both 明确拒绝，等待用户身份映射与委托证明完整实现。

## 用户登录

参考 gateway-sso.env.example 设置已有 GENERIC_* 配置。GENERIC_CLIENT_USE_PKCE=true 与 gateway-console 的 S256 配置匹配。示例同时开启 PKCE_STRICT_CACHE_MISS=true，缺少 state 或 verifier 时直接拒绝登录回调。GENERIC_USER_ID_ATTRIBUTE=sub 避免使用可变用户名作为身份标识。只设置所选通用提供商，避免同时启用 Microsoft/Google 配置导致旧选择逻辑优先匹配其他提供商。

复制示例后在本地安全地填写 gateway-console 密钥，不提交环境文件。PROXY_BASE_URL 与 Keycloak 客户端回调列表必须一致。示例只适合全部进程运行于同一宿主机的回环开发环境；跨容器必须使用一致且可达的 issuer。本地浏览器与真实身份服务、网关 SSO 组件的授权码交换已经验证；网关数据库写入及最终控制台 Cookie 尚未验证，不能将这份配置视为完整产品登录验收。

## JWT 验证

网关需要启用已有 JWT 功能并配置受信任 issuer、audience 与 JWKS。优先使用现有 litellm_jwtauth.issuers 配置列表，确保 audience 校验开启。配置字段及功能门控以部署版本为准，不能只设置环境变量就认定 JWT 路径已启用。应用角色、团队和用户映射仍使用现有 JWT 授权配置，合法签名不代表业务访问已获授权。

## 外部自主 Agent 绑定

现有 POST /v1/agents 和更新接口接受 external_oidc 身份类型。绑定字段复用现有数据库列，不需要扩大数据库迁移范围。

```json
{
  "agent_name": "contract-agent",
  "execution_mode": "autonomous",
  "identity": {
    "provider": "external_oidc",
    "tenant_id": "https://identity.example.internal/realms/company",
    "client_id": "contract-agent-client",
    "service_principal_id": "实际服务账号的-sub",
    "required_scopes": ["gateway.invoke"]
  }
}
```

外部绑定的 tenant_id 是精确 issuer 命名空间，service_principal_id 是服务账号 sub，不是 Microsoft 对象 ID。required_roles 不支持，必须使用 scope；注册前网关必须已经信任该 issuer 且启用 audience 验证。管理页面的身份提供商可选择“外部 OIDC 身份平台”，从网关已信任的 issuer 列表选择签发者，再填写客户端 ID、服务账号 sub 和 scope。外部身份仅展示自主执行模式；创建时可跳过虚拟密钥，编辑和详情页保留同一绑定。也可以直接调用管理 API。

Keycloak 应用使用 confidential service account，禁用密码授权和不需要的浏览器流程。通过管理员控制的 mapper 将 identity_kind=workload 加入 Access Token，azp 标识客户端，sub 标识服务账号。为该客户端授予 gateway.invoke scope，并通过 audience mapper 加入 ai-governance-gateway。用户可编辑属性不能作为 workload 身份证明。

运行中的网关先进行真实 JWT 验证，再从身份存储解析绑定和调用 classify_agent_subject，随后保留现有准入与资源授权。新分类器本身不是验签入口。iss、客户端、主体与 scope 必须匹配，禁用或 revision 变化仍由原有策略执行。

## Octop 工作负载端到端验收

使用隔离的 Keycloak 和独立 PostgreSQL，另启动配有独立数据库和合法 JWT 功能授权的网关。网关配置须信任与 Octop 看到的完全相同的 issuer（本机 Compose 默认 `http://127.0.0.1:18080/realms/company`）、JWKS 和 audience `ai-governance-gateway`。网关启用 `enable_jwt_auth` 与 `strict_issuer_allowlist`。

将隔离网关的管理密钥从测试密钥设施注入 `OCTOP_E2E_GATEWAY_ADMIN_KEY`，然后在 LiteLLM 根目录运行：

```bash
python identity-platform/smoke.py \
  --env-file identity-platform/.env \
  --octop-smoke ../Octop/scripts/smoke_gateway_identity.py \
  --gateway http://127.0.0.1:4000
```

1. 测试管理员通过 Keycloak 管理 API 为 Octop 工作负载注册独立的 confidential client、服务账号和临时调用 scope，并从服务账号记录读取真实主体 ID。
2. Octop 验收脚本仅接收运行凭证，通过 discovery 和 Client Credentials 换取令牌，再用该令牌请求真实网关的 `GET /v1/agents`。缺少网关绑定时预期 HTTP 403。
3. 网关管理员通过 `POST /v1/agents` 写入 `external_oidc` 自主工作负载绑定。再次调用预期 HTTP 200，并通过网关管理接口检查身份绑定的 `last_authenticated_at`。
4. 禁用网关绑定后再次调用，预期 HTTP 403。Keycloak 随后禁用客户端，验证新取令牌失败。脚本清理本次创建的临时对象。

省略 `--gateway` 可单独验证身份平台注册及 Octop 取令牌。附加 `--gateway-jwt` 可运行真实 JWKS 的组件验签。只有完整 HTTP 模式通过才算完成网关认证验收。该用例使用 Agent 发现接口，无需调用模型；Octop 脚本是工作负载验收入口，生产 Agent 运行时仍需接入令牌提供器。

## 已执行验证

```bash
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py --gateway-jwt
```

该脚本创建临时应用，签发真实令牌，使用网关 JWTHandler 从实时 JWKS 验签，再验证 Agent 绑定主体匹配与错误主体拒绝。错误 audience 必须失败。烟测创建独立的临时调用 scope，验证已授予 scope 成功、未授予 scope 拒绝；生产客户端仍需单独授予 gateway.invoke。临时应用禁用后获取新令牌失败。禁用不会自动撤销已经签发且尚未到期的 JWT，需要配合网关禁用绑定及短令牌有效期。

旧 Agent 分类与授权执行单元回归。新增身份存储启停和提供商选择回归已通过，存储测试共 42 项通过；另 4 项需要 Prisma 生成模型，受官方域名 403 阻挡而失败。尚未完成真实数据库绑定加完整 HTTP 推理调用、浏览器回调、统一管理和同步端到端验收。


## 管理页面验证边界

创建、编辑和身份详情使用现有 Agent 页面，不新增第二套管理页。前端按 provider 区分 Entra UUID 与外部区分大小写的标识，切换提供商时清空旧提供商字段，避免误提交旧租户与主体。保存绑定不会显示“已认证”，只有实际认证记录才显示匹配证据。

本轮页面验证使用组件集成测试替代网络边界，验证创建和编辑请求；尚未连接真实数据库执行浏览器端到端操作。这些页面用于管理网关侧绑定，不等于在独立身份平台创建用户或应用。统一身份管理 API 与跨系统同步仍待实现。

接口模型更新后需先执行 `.venv/bin/python -m litellm.proxy._lazy_openapi_snapshot`，再在 `ui/litellm-dashboard` 执行 `LITELLM_PYTHON=/workspace/litellm/.venv/bin/python npm run gen:api`。否则懒加载接口快照会让生成的前端类型遗漏外部身份类型。解释器路径应替换为当前部署路径。

## 网关预批准员工身份接入

统一 OIDC 登录准入可以单独启用。沿用本目录的 Generic SSO 客户端配置，启用 PKCE 和严格 state，并额外设置：

```dotenv
LITELLM_UNIFIED_OIDC_ISSUER=https://identity.example.internal/realms/company
LITELLM_UNIFIED_OIDC_JWKS_URL=https://identity.example.internal/realms/company/protocol/openid-connect/certs
GENERIC_CLIENT_USE_PKCE=true
PKCE_STRICT_CACHE_MISS=true
```

部署应选择单一 Generic SSO 客户端，使用与 issuer 同一信任域的授权、令牌和 JWKS 端点。为迁移保留经过审计的管理恢复方式。预先关联并测试至少一个运维账号，再开启统一模式。该开关收紧 SSO 账号准入，其他既有认证入口采用各自的配置。关闭开关可恢复旧的 SSO 匹配策略。

统一模式验证 ID Token 签名、issuer、audience、有效期、nonce 和授权方。登录仅从已批准绑定加载本地账号，停用账号会被拒绝。网关角色及资源授权来自网关本地配置。当前使用 `sso_user_id` 的唯一索引保存带版本前缀的 `(issuer, sub)` 摘要。现有裸 `sub` 绑定需要经过审核迁移，不能用邮箱猜测。

已有员工首先应存在于 Keycloak 业务 realm 中。对首次登录才会产生本地主体的上游用户，先通过管理员批准的身份平台流程完成上游关联。然后由授权运维人员运行工具：

```bash
PYTHONPATH=. python identity-platform/user_onboard.py \
  --issuer https://identity.example.internal/realms/company \
  --gateway https://gateway.example.internal \
  <Keycloak-realm-user-id>
```

通过密钥设施注入短期 `IDENTITY_USER_MANAGER_TOKEN`（身份平台读用户权限）和 `IDENTITY_GATEWAY_PROVISIONING_TOKEN`（网关查询和建用户权限）。工具通过 Keycloak 管理接口确认用户存在且启用，按精确主体创建网关最小权限账号。默认不开启模型权限、不生成 API Key、不发本地邀请。重复运行核对并返回同一绑定；如发现冲突，需人工核对。随后在网关分配审批过的团队和权限。

### 从网关页面关联员工

设置 `LITELLM_IDENTITY_DIRECTORY_CLIENT_ID` 与 `LITELLM_IDENTITY_DIRECTORY_CLIENT_SECRET`，使用业务 realm 中独立的 confidential service account，仅授予读取目标 realm 用户的权限。密钥只注入网关核心环境。此客户端与控制台登录客户端及 Agent 工作负载客户端分开。

网关管理员在「用户 → 邀请用户」选择「关联已有员工」，填写 Keycloak realm 用户 ID。网关向配置的身份平台读取该账户，拒绝未知、停用和服务账号，再使用同一 `(issuer, sub)` 摘要核对或创建本地绑定。数据库唯一约束处理同时或重复提交。账号以最低权限建立，后续由网关管理员分配团队和模型权限。现有邀请流程仍在同一弹窗可选。

### 从网关邀请访客

在网关核心部署环境增加 `LITELLM_IDENTITY_GUEST_CLIENT_ID` 和 `LITELLM_IDENTITY_GUEST_CLIENT_SECRET`。使用独立的 Keycloak confidential service account，授权范围限定在业务 realm 的用户创建、读取与执行激活动作。该凭证独立于员工目录只读客户端。

为业务 realm 配置 SMTP 和可信外部 HTTPS 地址。关闭重复邮箱、邮箱即用户名、用户自助注册和用户自行修改用户名。预留 `litellm-guest-` 用户名前缀，禁止外部联邦按邮箱自动关联本地访客。在 Realm settings → User profile 中新增 `litellm_guest_operation` 属性，仅允许管理员查看和编辑。该属性用于识别网关创建的本地访客；匹配失败时拒绝复用既有身份。首次启用前以测试邮箱完成激活回归。

网关管理员在「用户 → 邀请用户 → 邀请访客」准备账号。后台先创建无密码且待验证的 Keycloak 用户，再创建最低权限网关绑定。相同 realm 和规范化邮箱对应同一操作，重复准备只补齐缺失的绑定。若发现与既有企业身份冲突，使用已有员工关联流程或人工核对。之后显式发送激活邮件，Keycloak 使用一小时有效的操作链接要求验证邮箱和设置密码。

关闭窗口后可再次输入同一邮箱查询状态。状态由身份记录和网关绑定推导，可区分未开始、身份已创建、待激活及已激活。邮件发送响应仅代表 Keycloak 接受请求，查询不会把该响应当作送达凭证。发送超时后应先核对身份平台或 SMTP 日志，再决定是否手动重发。

## 通过 agentctl 注册工作负载

身份平台部署独立的注册 API。运维人员用企业账号通过 Keycloak 登录，取得短期操作员 Access Token。终端只调用注册 API。注册服务依次创建禁用状态的 Keycloak confidential client 和服务账号，在网关绑定准确的 `issuer`、`client_id` 和服务账号 `sub`，然后启用 Keycloak 客户端。Agent 使用领取到的凭证申请短期令牌，由网关按外部 OIDC 的现有规则认证。

### 部署注册服务

在 `identity-platform` 目录安装依赖并启动独立进程。生产环境由 TLS 反向代理暴露 HTTPS，关闭注册 API 请求头、响应正文及密钥文件内容的采集。每个业务 realm 使用独立配置和持久卷，运行单个服务实例，SQLite 数据目录仅对服务账号可读写。操作记录保存状态、两个系统的绑定标识和领取标记。

```sh
python -m pip install -r requirements-agent-admin.txt
python -m uvicorn agent_registration:app --host 127.0.0.1 --port 18081
```

| 环境变量 | 配置 |
| --- | --- |
| `AGENT_ADMIN_ISSUER`、`AGENT_ADMIN_JWKS_URL` | Keycloak 业务 realm 的 issuer 和可信 JWKS 端点 |
| `AGENT_ADMIN_AUDIENCE`、`AGENT_ADMIN_OPERATOR_CLIENT_ID` | 注册 API audience 和专用操作员 OIDC 客户端 ID；后者需与访问令牌的 `azp` 一致 |
| `AGENT_ADMIN_KEYCLOAK_CLIENT_ID`、`AGENT_ADMIN_KEYCLOAK_CLIENT_SECRET` | 服务端专用 Keycloak 管理客户端。实测所需 realm 角色为 `manage-clients` 和 `view-users` |
| `AGENT_ADMIN_GATEWAY_URL`、`AGENT_ADMIN_GATEWAY_TOKEN` | 网关地址及能查询、创建和停用 Agent 的管理凭证 |
| `AGENT_ADMIN_GATEWAY_AUDIENCE` | 工作负载令牌使用的网关 audience，例如 `ai-governance-gateway` |
| `AGENT_ADMIN_DB` | 持久卷中的 SQLite 文件绝对路径 |

操作员客户端使用授权码加 PKCE，限制已获授权的企业人员访问。为该客户端的操作员 Access Token 配置注册服务 audience，并通过受控客户端或审批策略授予 `agent.register`。Keycloak 的普通用户客户端和工作负载客户端均不授予此 scope。应用只接受配置的签名、issuer、audience 和客户端。注册记录只对原操作员主体可见。网关管理凭证须能列出该服务创建的全部 Agent，便于失败后核对现有绑定。为注册服务预留 `managed-agent-` 客户端及网关 Agent 名称前缀。

创建 OIDC Client Scope `gateway.invoke`，启用 Include in token scope，按工作负载单独授予。网关需配置受信任的 issuer 和 JWKS、网关 audience、工作负载 claim 映射及工作负载允许的路由和模型权限。注册建立自主 Agent 的身份记录。若要让第三方通过 A2A 调用由该工作负载托管的服务，仍需配置目标 URL、Agent Card 和相应访问控制。

### 注册、领取和停用

将短期操作员令牌通过受控环境注入 `AGENTCTL_OPERATOR_TOKEN`。每次新注册生成一个 UUID 并妥善保存，整个操作使用同一个 UUID。

```sh
platform=https://identity-admin.example.internal
operation_id=00000000-0000-4000-8000-000000000001
python agentctl.py --platform "$platform" register "$operation_id" --name octop-worker
python agentctl.py --platform "$platform" status "$operation_id"
python agentctl.py --platform "$platform" credential "$operation_id" --secret-file ./octop-credential.json
python agentctl.py --platform "$platform" disable "$operation_id"
```

注册响应失败后先查状态，再用同一 UUID 和名称重试。客户端使用状态返回的 issuer 和 client ID，在对应 token endpoint 走 Client Credentials，然后以 Bearer 令牌调用网关。凭证领取需要启用的身份和原网关绑定，只向原操作员交付一次。工具以 `0600` 创建新的 JSON 文件，保存后通过部署密钥设施交给运行时。如果响应丢失，先查询 `credential_claimed`。已标记领取但文件内容不可恢复时，由运维停用该注册并重新注册。现阶段名称在同一操作员下不可复用，重新注册需使用新的名称。

停用先禁用网关绑定，再关闭 Keycloak 客户端。若第二步失败，状态为 `disabling`，使用原 UUID 重试。已签发 JWT 的有效期由 Keycloak 管理，网关拒绝已停用绑定是即时阻断的一部分。自动轮换、终端交互式登录及统一审计接入仍待补齐。

### 验收注册与停用

在隔离环境中启动注册服务、Keycloak 与使用独立数据库的 LiteLLM 网关。网关启用 JWT 认证，允许工作负载访问 `GET /v1/agents`。向验收进程注入短期 `AGENTCTL_OPERATOR_TOKEN` 和用于读取绑定状态的 `OCTOP_E2E_GATEWAY_ADMIN_KEY`。

```sh
python smoke_agentctl.py \
  --platform http://127.0.0.1:18081 \
  --gateway http://127.0.0.1:4000 \
  --issuer http://127.0.0.1:18080/realms/company
```

脚本先核对网关数据库就绪、受信任的 issuer 和 Keycloak OIDC discovery。只检查环境时可加 `--preflight-only`，此模式无需 `--platform` 或操作员令牌，也不会创建测试 Agent。

脚本调用实际 CLI 注册并重复提交，检查私有凭证文件和领取状态。从 Keycloak 获取令牌后调用网关，核对绑定主体和最近认证时间。停用后使用同一枚 JWT 再次访问，对照网关 HTTP 403 及 Keycloak 拒绝新令牌的结果。脚本会尝试停用已注册的测试身份，保留停用记录供核查。若运行中断，使用输出中的操作编号查询和停用。

### 使用 systemd 部署注册 API

将 `agent_registration.py`、`agentctl.py` 和 `requirements-agent-admin.txt` 安装到 `/opt/identity-agent-registration`，在该目录下创建 `venv` 并安装依赖。代码及虚拟环境由部署账号管理，并允许动态服务账号读取和执行。使用 [服务单元](deploy/identity-agent-registration.service) 和 [环境变量示例](deploy/identity-agent-registration.env.example) 生成部署配置。将真实环境文件放到 `/etc/identity-agent-registration.env`，由 root 持有并设置 `0600`。systemd 为服务提供私有持久目录并以单个 worker 运行。将反向代理转发到 `127.0.0.1:18081`，然后执行上节的验收脚本。

升级前停止注册服务并备份其状态目录，或使用 SQLite 在线备份。操作记录包含领取标记和持久绑定标识，应与身份平台及网关备份一起管理。回退代码时保留当前注册记录，避免把已领取凭证的标记回退，备份还原时先核对两端绑定和凭证状态。

在预发布环境验证服务升级或重启时，先注册一个隔离的测试 Agent、领取凭证并记录状态中的网关 Agent ID。重启 `identity-agent-registration.service` 后，用同一操作编号执行 `status`，确认仍为 `active`、网关 Agent ID 一致并且 `credential_claimed` 为 `true`。重新领取应返回 HTTP 409。最后停用测试 Agent，再次重启并确认状态仍为 `disabled`。
