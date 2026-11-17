# LiteLLM 产品手册

## 1 产品简介

LiteLLM 是一个统一的 LLM 接入与治理产品，提供两种使用方式。

作为 Python SDK 时，你在应用代码里直接调用，它把不同厂商的大模型接口统一成 OpenAI 格式，让你用同一套代码访问任意模型。这种方式无需部署服务，适合应用内集成。

作为 AI Gateway 时，它是一个独立部署的服务，对外暴露 OpenAI 兼容的 API，在模型调用之上提供鉴权、路由、限流、预算、成本追踪和管理控制台。这种方式适合把模型能力作为团队共享的基础设施。

两种方式共享同一套请求与转换逻辑，从 SDK 迁移到网关时调用格式基本不变。本手册面向使用者，介绍如何安装、配置与使用两项能力。功能的状态与范围见 `RELEASE_FEATURES.md`，技术细节见 `TECHNICAL_SPECIFICATION.md`。

## 2 快速开始

### 2.1 用 SDK 发起第一个调用

安装后直接 import 即可调用。你需要准备好目标厂商的 API key 并通过环境变量提供。

```python
import litellm

response = litellm.completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

model 参数可用 `provider/model` 形式显式指定厂商，也可只写模型名由系统推断。异步调用把 `completion` 换成 `acompletion` 并 await 即可。

### 2.2 启动网关

网关从配置文件读取模型清单与运行参数。准备一个配置文件定义 model_list，然后启动服务。

```bash
python litellm/proxy/proxy_cli.py --config litellm/proxy/dev_config.yaml --port 4000 --detailed_debug --reload
```

生产部署通常不使用 reload，而是以多 worker 运行并配置共享 Redis，以便多个进程共享限流与预算状态。

### 2.3 通过网关发起调用

网关暴露 OpenAI 兼容端点，因此你可以直接用 OpenAI SDK 指向网关地址。

```python
from openai import OpenAI

client = OpenAI(api_key="<你的虚拟 key>", base_url="http://localhost:4000/v1")
response = client.chat.completions.create(
    model="你的模型别名",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

网关会在响应头返回本次调用的成本，便于对账与限额展示。

## 3 使用 SDK

### 3.1 同步与异步调用

`completion` 是同步入口，`acompletion` 是异步入口，二者行为一致。异步调用示例如下。

```python
import asyncio
import litellm

async def main():
    response = await litellm.acompletion(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "你好"}],
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

### 3.2 流式输出

把 `stream=True` 传入即可得到流式响应，逐块读取内容。

```python
import litellm

response = litellm.completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True,
)
for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

### 3.3 向量嵌入

`embedding` 提供统一的嵌入接口，用法类似。

```python
import litellm

response = litellm.embedding(
    model="openai/text-embedding-3-small",
    input=["示例文本"],
)
```

### 3.4 使用 Router 做负载均衡

当你有多个模型部署时，`Router` 可以在它们之间选择、重试与降级。

```python
from litellm import Router

router = Router(model_list=[
    {"model_name": "gpt-4o", "litellm_params": {"model": "openai/gpt-4o"}},
    {"model_name": "gpt-4o", "litellm_params": {"model": "azure/gpt-4o"}},
])
response = router.completion(model="gpt-4o", messages=[{"role": "user", "content": "你好"}])
```

可在 Router 配置中指定路由策略，例如最低延迟或最低成本，策略清单见 `RELEASE_FEATURES.md` 第 4.3 节。

## 4 配置网关

### 4.1 配置文件结构

网关配置文件是 YAML，核心是三段。`model_list` 定义可用模型部署，每项含 model_name、litellm_params 与 model_info。`router_settings` 定义路由策略、fallback、重试与超时。`general_settings` 定义 master key、数据库地址、回调与鉴权行为。

一个最小配置示例如下。

```yaml
model_list:
  - model_name: my-model
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

配置支持 `os.environ/` 前缀从环境变量读取敏感值，避免把密钥写进文件。启动前可用 `--validate_config` 校验配置。

### 4.2 启动参数

常用参数有 `--config` 指定配置、`--port` 指定端口、`--num_workers` 指定 worker 数、`--detailed_debug` 打开详细日志、`--reload` 用于开发热重载。生产环境用多 worker 并配置共享 Redis，开发环境用 reload 单 worker 即可。

注意 reload 模式下只运行一个 worker，若需验证并发请关闭 reload。

## 5 访问控制

### 5.1 Virtual Key

网关通过 Virtual Key 控制谁能调用哪些模型与多少额度。管理员创建一个 key 并绑定预算与允许的模型，调用方用这个 key 访问网关。key 的校验在每次请求时执行，会检查预算、模型权限与允许路由。

### 5.2 Team 与 User

Key 可归属到 team 与 user，预算与用量可按 team 或 user 维度统计与限制。跨 team 的可用部署由路由层过滤，确保团队只能访问被授权的模型。

### 5.3 SSO 与 JWT

企业部署可启用 SSO 登录与 JWT 鉴权，自定义 SSO handler 需企业 license。开源版本使用 Virtual Key 与 master key 即可满足基本鉴权需求。

## 6 预算与限流

你可以为 key、team、user 设置预算上限与速率限制。预算在每次调用后按实际成本扣减，达到上限后调用会被拒绝。限流基于 Redis 计数，支持多种策略，并能按时间窗口重置。中间件会在请求结束后释放未使用的预算预留，避免误扣。

## 7 成本与用量

每次调用的成本由系统自动计算并放在响应头 `x-litellm-response-cost` 中，同时记录到花费日志。你可以在响应对象中读取成本，用于展示或对账。

```python
response = litellm.completion(model="openai/gpt-4o", messages=[{"role": "user", "content": "你好"}])
print(response._hidden_params.get("response_cost"))
```

成本按周期汇总后可从管理 API 或控制台查询。若某次成本为零或不准确，通常是价格表缺少该模型条目，或厂商未上报成本，需要补充价格表配置。

## 8 管理控制台

管理后台是 `ui/litellm-dashboard/`，以 Next.js 实现，提供可视化的模型、key、team、用量与成本界面。本地开发时按以下步骤启动。

```bash
cd ui/litellm-dashboard
LENS_DEV_PROXY_URL=http://127.0.0.1:4000 npm run dev -- -H 0.0.0.0 -p 3000
```

`LENS_DEV_PROXY_URL` 必须设置，它决定前端是否把 API 请求转发到本地网关。设置后访问 `http://localhost:3000` 即可。不设置时前端为纯静态导出，无法联调。

## 9 常见场景

### 9.1 用统一接口接入多个厂商

在 `model_list` 里配置多个厂商的部署，用同一个 model_name 对外暴露。网关按路由策略在它们之间选择，应用侧无需改动调用代码。

### 9.2 配置故障降级

在 `router_settings` 里配置 fallback 模型。当首选部署持续失败时，Router 会自动切换到备用部署，并把故障部署置为冷却状态，避免反复重试坏节点。

### 9.3 按团队隔离预算

为每个 team 创建独立 key 并绑定预算与允许模型。路由层会按 team 过滤可用部署，成本按 team 汇总，实现隔离与对账。

## 10 故障排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 请求返回鉴权失败 | key 无效、预算耗尽或路由未授权 | 检查 key 状态、预算与允许路由 |
| 提示无法识别 provider | 模型名与前缀无法匹配 | 用 `provider/model` 显式指定或检查 provider 注册 |
| 成本显示为零 | 价格表缺条目或厂商未上报 | 补充价格表配置 |
| 多 worker 状态不一致 | 未配置共享 Redis | 让所有 worker 指向同一 Redis 与数据库 |
| reload 下只有一个 worker | reload 模式固有限制 | 关闭 reload 后以多 worker 启动 |
| 前端无法调用后端 | 未设置 LENS_DEV_PROXY_URL | 设置该环境变量后重启前端 |

## 11 常见问题

问，SDK 和网关该如何选择。如果只是一个应用调用模型，用 SDK 最直接。如果需要团队共享、统一鉴权、预算与监控，用网关。

问，从 SDK 迁移到网关要改多少代码。调用格式保持 OpenAI 兼容，主要是把 base_url 指向网关并使用网关签发的 key。

问，是否必须部署数据库。SDK 形态不需要。网关形态若只做转发可不启用数据库，但要使用 key 管理、预算与成本追踪就必须部署 PostgreSQL。

问，流式调用是否支持成本统计。支持。成本在流结束时聚合确定并回填，行为与非流式一致。

问，企业功能没有 license 会怎样。相关路由为空，开源功能不受影响，服务可正常启动。
