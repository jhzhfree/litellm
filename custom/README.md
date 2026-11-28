# litellm-custom

Self-maintained implementation of the premium feature surface that used to ship
in the closed `litellm_enterprise` package. Everything in this folder is MIT
licensed. The modules mirror the original design so the OSS-side hook points
(`PROXY_HOOKS`, `enterprise_custom_auth`, route gating, callback registry,
alerting loggers) keep working unchanged.
