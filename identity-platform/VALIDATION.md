# 集成验证记录

2026-11-18，在本地回环网络运行 Keycloak 26.4.7 和独立 PostgreSQL。

执行命令

```bash
PYTHONPATH=. .venv/bin/python identity-platform/smoke.py --gateway-jwt
```

已通过真实网络调用验证 OIDC discovery、用户创建和禁用、应用注册、Client Credentials 签发。临时用户和应用在正常测试结束时删除。脚本不输出密码或令牌。

真实 Keycloak 令牌通过网关现有 JWTHandler 验证，JWKS 来自运行中的身份平台，校验签名与 issuer、audience。错误 audience 被拒绝。

这是身份服务到网关认证组件的集成测试，不是完整产品验收。尚未接入的新 external_identity 模块没有生产调用方。浏览器登录回调、外部 Agent 绑定、应用身份通过完整网关 HTTP 路径访问资源、统一管理 API 与身份同步尚未完成，不能标记为通过。

测试环境使用开发模式和本地 HTTP，不是生产发布配置。
