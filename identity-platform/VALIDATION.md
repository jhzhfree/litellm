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

## 预批准员工统一 OIDC

以隔离 Keycloak 26.4.7 和 PostgreSQL 运行 `smoke_sso.py --unified-oidc --env-file <测试环境文件>`。真实 Chromium 登录后验证网关 Generic SSO 组件的授权码、state、PKCE、nonce、ID Token 签名和 realm 主体。缺少 state、state 不匹配及回调重放均被拒绝。该测试在浏览器端截获回调，再调用网关认证组件。

SSO 与 PKCE 定向回归通过 49 项。员工绑定测试覆盖精确主体、不存在、停用和其他来源拒绝。使用模拟网关 HTTP 响应验证运维工具重复运行只提交一次创建，并拒绝冲突绑定。实际网关数据库开户及最终浏览器控制台会话仍需验收。

## 网关页面关联已有员工

在隔离 Keycloak 环境创建临时员工和仅授予 `realm-management/view-users` 的服务账号。网关目录客户端使用 Client Credentials 获得访问令牌，读取并校验真实员工主体。测试结束后清理临时员工及客户端。

网关路由测试覆盖代理管理员授权、拒绝其他角色和目录拒绝，仓储测试覆盖已有绑定、并发唯一约束和冲突。仪表盘集成测试验证表单提交精确 realm 用户 ID，并保留旧邀请方式。本轮的数据库写入验证使用替身，尚需实际网关数据库联调。

## 访客开户和激活

在隔离 Keycloak realm 配置管理员专用访客标记和用户管理客户端，实测创建身份、读取要求动作、同邮箱重试及状态查询。网关数据库绑定使用替身。定向测试覆盖绑定前不发送、部分成功后的状态和恢复、Keycloak 接收激活请求，以及已激活账号不重复请求。前端集成测试覆盖准备和发信分步操作。尚未在真实 SMTP 或网关数据库上验收。

## agentctl 注册与凭证交付

在隔离 Keycloak 26.4.7 realm 和真实 SQLite 中验证。网关 HTTP 边界使用模拟响应。模拟网关建档第一次失败后，身份保持禁用，同一操作编号恢复到 `active` 且只建立一条绑定。跨操作员读取及领取被拒绝，失效网关绑定阻止领取，凭证只能交付一次。真实令牌通过 realm JWKS 验签，包含预期的 audience、工作负载标记、客户端、服务账号主体和 `gateway.invoke`。模拟身份平台在停用期间失联时，网关禁用先执行，重试完成 Keycloak 停用，旧凭证再次申请令牌返回 401。

真实 Keycloak 操作员 Access Token 通过注册 API 的 JWKS 校验。缺少 scope、错误 audience 或错误授权客户端均被拒绝。隔离测试使用临时客户端直接签发操作员令牌，生产授权码与 PKCE 登录、运行中的网关 HTTP 和 Prisma 持久化仍需部署联调。

### agentctl HTTP 验收脚本

`smoke_agentctl.py` 已用实际 CLI 子进程、本地 HTTP 注册服务和独立 Keycloak 跑通，网关使用 HTTP 替身。验证了重复注册、凭证文件权限、令牌签发、绑定认证时间检查，以及停用后同一枚 JWT 被替身拒绝和真实 Keycloak 拒绝新令牌。

本次重新运行 `prisma generate --schema=schema.prisma`，Prisma 官方 query-engine 校验文件仍返回 HTTP 403。真实 LiteLLM 网关的请求授权、持久化绑定和停用结果仍待验收。

停用操作增加了网关响应核对。模拟网关 HTTP 200 但返回错误 Agent ID 或仍为启用时，操作保留在 `disabling`，真实 Keycloak 继续签发令牌。恢复网关正常响应后，使用原操作编号重试成功，Keycloak 随后拒绝签发。网关托管 Agent 授权单元测试通过 270 项。Prisma 官方校验地址复查仍被网络代理拒绝，真实网关数据库验收尚未运行。

注册复用与创建响应现共用同一套绑定校验。隔离测试使用真实 Keycloak 和模拟网关，模拟网关已建档但 HTTP 200 响应返回错误 issuer。注册保持在 `identity_created`，Keycloak 客户端依旧禁用。原操作编号重试后复用正确绑定，只保留一条网关记录。凭证领取、停用异常和 CLI 验收流程同步复测通过。

## 发布验收记录

2026-11-24 对三个工程执行了定向回归。

| 工程 | 结果 |
| --- | --- |
| LiteLLM | 网关 SSO 与托管 Agent 授权合计 714 项通过，4 项 SSO 测试因 Prisma 客户端未生成而失败。邀请用户页面 6 项集成测试通过，仪表盘类型检查通过。 |
| Octop | 用户认证、OIDC 集成和 Agent 身份管理合计 244 项通过。SQLite 升级测试从版本 42 执行至当前最新迁移并检查已有用户及续期功能。 |
| AKB | 主体生命周期、工作负载身份服务和授权合计 23 项通过。 |
| 独立注册服务 | 真实 Keycloak、注册 API 和 CLI 回归通过，网关使用 HTTP 替身。新增 systemd 服务单元和环境模板，当前沙箱的 `/run/systemd` 只读，尚未完成 systemd 服务启动验收。 |

生产发布前需在具备 Prisma 引擎及校验文件访问权限的预发布环境，用项目正常构建流程生成客户端并重新运行上述 SSO 测试。使用真实数据库检验网关 SSO 会话和企业员工绑定，使用测试邮箱检验访客激活，再运行 `smoke_agentctl.py` 验证真实网关绑定、认证记录及停用。同一预发布环境还需验证部署单元重启后保留注册状态，以及原有认证方式仍可登录。Prisma 官方校验地址本轮复查仍返回 403，真实网关验收尚未完成。

独立注册服务的进程重启验收通过。三次启动全新的 Uvicorn 进程，共用同一份实际 SQLite 文件，连接真实 Keycloak 和网关 HTTP 替身。重启后保留原绑定 ID 和已领取标记，同一操作重试复用原绑定，重复领取返回 409。停用后再次重启，停用状态仍保留。本次验证覆盖应用进程及状态文件，systemd 单元和真实网关数据库仍待预发布验收。

发布预检已接入 `smoke_agentctl.py`。隔离测试以真实 Keycloak 验证 OIDC discovery，以网关 HTTP 替身验证健康探针和管理员可见的受信任 issuer。即使探针返回 HTTP 200，数据库状态为 `disconnected` 也会中止；网关未配置预期 issuer 同样中止。通过预检后的注册和停用验收已复测。Prisma 校验下载仍被网络代理以 403 拒绝，正式发布验收尚未完成。

## 身份平台功能复测

2026-11-24 在独立 Keycloak 26.4.7 和 PostgreSQL 环境复测。

- Chromium 完成真实 Keycloak 授权码登录。网关 SSO 组件完成 PKCE 换码和主体映射，拒绝缺失 state、错误 state 和重放。
- 员工目录只读服务账号可查询真实 realm 用户。访客可创建并保留待激活状态，重复准备复用原身份。网关开户使用替身，未验证 SMTP 投递。
- Octop 工作负载从真实 Keycloak 取得令牌。网关 JWT 组件通过实时 JWKS 验签，并拒绝错误 audience、主体或 scope。
- 实际 `agentctl` 与注册 API 完成注册、领取、重复领取拒绝和停用。网关使用 HTTP 替身，Keycloak 使用真实服务。
- LiteLLM 的 PKCE、统一 OIDC 与开户定向回归 57 项通过。Octop 的 OIDC、SSO 和 Agent 身份定向回归 70 项通过。

真实 LiteLLM 数据库用户绑定、控制台会话、访客邮件和 Agent 完整 HTTP 授权仍需联调。企业 IdP 联邦使用部署方的真实上游客户端另行验收。
# 企业微信身份提供方验证，2026-11-24

新增 `keycloak-wecom` 原生 SPI，固定 Keycloak 26.4.7。`mvn -B verify` 的 11 项测试通过，覆盖成员校验、企业与成员身份隔离、外部联系人与禁用成员拒绝、API 错误和网络异常脱敏、会话校验、state 缺失、过期、串 realm/provider 及重放拒绝。将允许的成员状态从 1 故意改为 2 后，测试出现 1 项失败和 1 项错误；恢复后全部通过。

使用已校验 digest 的官方 Maven 3.9.9 / JDK 21 镜像取得构建工具。容器内 Maven 首次因 DNS 无法解析 Maven Central 而失败，随后在工作区使用相同工具和环境已有代理成功构建，没有替换镜像源或绕过域名策略。

实际启动临时 Keycloak 26.4.7，JAR 挂载到 `/opt/keycloak/providers/`，只绑定 `127.0.0.1:18082`，使用独立临时 H2 数据和临时管理员。Admin API 成功配置 provider，Chromium 通过登录页点击企业微信后生成扫码地址。企业微信浏览器跳转由 Playwright 拦截，没有使用真实企业凭据。`keycloak-wecom/src/test/browser_smoke.py` 精确验证取消、重放和缺少 state 均返回 HTTP 400。验证过程中曾发现未注册 JAX-RS 资源造成 405，补充 `META-INF/beans.xml` 并改为静态回调资源后重新通过，不将任意 4xx/5xx 视为认证拒绝成功。

可选 Compose 通过 `docker compose -f compose.yaml -f compose.wecom.yaml config --quiet`。没有启动现有 company realm，没有修改现有身份数据库。Dockerfile 的 Maven 构建阶段未在当前容器网络下完成端到端镜像构建，实际运行验证采用本地构建 JAR 加官方 Keycloak 镜像。

企业微信官方文档站本次返回 403。真实企业扫码、可信域名与可信 IP、应用权限、企业员工范围及禁用状态需要部署方用测试企业完成验收。网关最终 SSO 会话、企业目录同步、离职事件同步和单点退出不在本轮验证范围内。此记录不宣称完整生产联调通过。
