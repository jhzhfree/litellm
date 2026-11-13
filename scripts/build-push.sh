#!/usr/bin/env bash
# scripts/build-push.sh — 增量构建 AI-Tokengw 镜像并推送到本地 registry
#
# 用法:
#   scripts/build-push.sh             # 构建 + 推送 latest 和时间戳 tag
#   scripts/build-push.sh --no-push   # 仅构建
#   scripts/build-push.sh --tag v1.2  # 额外指定 tag（latest 和时间戳 tag 始终会打）
#
# 依赖 /root/Dockerfile.build（含 cargo/uv/npm 缓存挂载与 thin LTO 加速）。
# 注意: 不要执行 docker builder prune —— 会清空缓存挂载数据, 导致下次全量重编。
set -euo pipefail
cd "$(dirname "$0")/.."

REGISTRY="192.168.22.6:5000"
IMAGE="litellm/ai-tokengw"
STAMP="$(date +%Y%m%d-%H%M)"
DOCKERFILE="${DOCKERFILE:-/root/Dockerfile.build}"
PROXY="${HTTP_PROXY:-http://192.168.24.200:7890}"
NO_PROXY_VAL="localhost,127.0.0.1,db,.svc,.local"
PUSH=1
EXTRA_TAGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=0 ;;
    --tag) shift; EXTRA_TAGS+=("$REGISTRY/$IMAGE:$1") ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
  shift
done

TAGS=("$REGISTRY/$IMAGE:latest" "$REGISTRY/$IMAGE:$STAMP" "${EXTRA_TAGS[@]}")
T_ARGS=()
for t in "${TAGS[@]}"; do T_ARGS+=(-t "$t"); done

echo "== 构建开始: ${TAGS[*]}"
time docker buildx build --builder default --load --target runtime \
  "${T_ARGS[@]}" \
  --build-arg "HTTP_PROXY=$PROXY" --build-arg "HTTPS_PROXY=$PROXY" \
  --build-arg "http_proxy=$PROXY" --build-arg "https_proxy=$PROXY" \
  --build-arg "NO_PROXY=$NO_PROXY_VAL" --build-arg "no_proxy=$NO_PROXY_VAL" \
  -f "$DOCKERFILE" .

if [[ $PUSH -eq 1 ]]; then
  echo "== 推送"
  for t in "${TAGS[@]}"; do
    echo "-- $t"
    docker push "$t" | tail -1
  done
fi

echo "== 完成。服务器拉取:"
echo "   docker pull $REGISTRY/$IMAGE:latest"
