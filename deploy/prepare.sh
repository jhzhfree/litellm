#!/usr/bin/env bash
# 部署准备：从 deploy/.env 生成 /metrics 抓取凭据文件 metrics-token
# 用法: cp env.example .env && vi .env && bash prepare.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "错误: 先执行 cp env.example .env 并填写配置" >&2
  exit 1
fi

master_key="$(grep -E '^LITELLM_MASTER_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\"' | tr -d \')"
# 未设置时使用 compose 中的默认主密钥（sk-ai-gw-default），保证监控凭据与应用一致
master_key="${master_key:-sk-ai-gw-default}"

printf '%s' "$master_key" > metrics-token
chmod 644 metrics-token # prometheus 容器以 nobody 运行，需可读
echo "已生成 deploy/metrics-token（监控服务抓取 /metrics 的 Bearer 凭据）"
