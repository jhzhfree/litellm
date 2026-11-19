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
