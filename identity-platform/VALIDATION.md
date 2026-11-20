# 集成验证记录

2026-11-19，在本地回环网络运行 Keycloak 26.4.7 和独立 PostgreSQL。

执行命令

```bash
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py --gateway-jwt
```

已通过真实网络调用验证 OIDC discovery、用户创建和禁用、应用注册、Client Credentials 签发。临时用户和应用在正常测试结束时删除。脚本不输出密码或令牌。

真实 Keycloak 令牌通过网关现有 JWTHandler 验证，JWKS 来自运行中的身份平台，校验签名与 issuer、audience。错误 audience 被拒绝。

这是身份服务到网关认证组件的集成测试，不是完整产品验收。external_identity 已接入现有 Agent 分类与身份存储路径。真实令牌已验证主体匹配、所需 scope 匹配和拒绝未授予 scope。应用禁用后不能获取新令牌，但该测试不意味着已签发令牌立即撤销。浏览器登录回调、数据库中的外部 Agent 绑定、应用身份通过完整网关 HTTP 路径访问资源、统一管理 API 与身份同步尚未完成，不能标记为通过。

测试环境使用开发模式和本地 HTTP，不是生产发布配置。

生成 Prisma 客户端时，官方 binaries.prisma.sh 的 query-engine 校验文件返回 403 Forbidden。已将 Prisma 和 npm 缓存指向工作区目录，未跳过完整性校验，也未绕过网络策略。将测试中的 Prisma 导入推迟到实际需要的测试后，身份存储测试执行结果为 42 通过、4 项因缺少 prisma.models 失败。新增外部绑定、禁用、身份命名空间测试通过。其余身份分类与授权回归 327 项通过。数据库与完整网关 HTTP 联调尚未通过。


## 外部身份管理页面

2026-11-19，补齐外部 OIDC 提供商选择、创建、编辑、详情与中英文文案。更新后端懒加载 OpenAPI 快照并重新生成前端接口类型。

前端身份参数单元测试 17 项、创建与编辑组件集成测试 29 项、身份详情测试 2 项、语言资源测试 4 项通过，共 52 项。`npm run typecheck` 通过，修改涉及的 ESLint 检查无错误，仍有警告。本轮组件测试替换了网络边界，没有浏览器或真实数据库验收。

测试命令均在 ui/litellm-dashboard 执行，使用 node_modules/.bin/vitest 的 unit、integration、component 项目，分别指定 agent_identity.test.ts、add_agent_form.integration.test.tsx、agent_info.integration.test.tsx、AgentIdentityDetails.test.tsx 和 src/i18n/locales.test.ts。文件位置为 src/app/(dashboard)/agents/_components，语言资源测试除外。


## 用户授权码与严格 PKCE

2026-11-19，`PYTHONPATH=. .venv/bin/python identity-platform/smoke_sso.py` 通过。使用本机 Chromium、真实 Keycloak 临时用户和 confidential 客户端完成授权码登录，再调用网关 `get_generic_sso_response` 完成真实 token 与 userinfo 请求，用户 ID 与 Keycloak sub 一致。

缺少 state、Cookie state 不匹配、重复使用回调均拒绝。新增缺少 state 的两项回归在修复前均失败（未抛出错误），修复后 PKCE 相关 39 项测试全部通过。命令为 `.venv/bin/python -m pytest tests/unit/proxy/management_endpoints/test_ui_sso.py -q -k 'pkce or PKCE' --disable-warnings`。

修复只影响显式启用 PKCE_STRICT_CACHE_MISS 的部署；默认非严格模式兼容行为保留。身份平台接入示例已启用严格模式。

本测试的浏览器回调由 Playwright 拦截，再直接调用 SSO 组件，未启动网关 HTTP 服务，未执行网关数据库用户同步或最终控制台会话签发。Prisma 官方校验文件本轮复查仍返回 403，未跳过校验或绕过网络规则。统一管理 API、同步与完整产品联调仍待完成。

## Octop 工作负载注册与网关认证

2026-11-20，在独立 Compose 项目中启动 Keycloak 26.4.7 和 PostgreSQL，执行 `smoke.py --octop-smoke ../Octop/scripts/smoke_gateway_identity.py --gateway-jwt`，并以 `--env-file` 指定隔离测试配置。

- 通过 Keycloak 管理 API 创建临时客户端、服务账号和调用 scope。Octop 验收进程以 Client Credentials 向实际身份平台换取 Bearer 令牌。禁用客户端后，新签发请求被拒绝。
- 网关 JWT 组件从实际 JWKS 验签，核对 issuer、audience 以及与 Keycloak 管理 API 一致的客户端和服务账号主体。错误 audience、错误主体和缺失所需 scope 被拒绝。
- 完整 HTTP 用例已加入，覆盖未绑定拒绝、持久化绑定后放行、认证时间记录和禁用后拒绝。本环境未配置网关 JWT 授权，且访问 Prisma 官方引擎域名返回 403，本轮未运行完整网关 HTTP 用例。
