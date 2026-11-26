#!/usr/bin/env bash
# 构建并推送拆分后的三镜像到 22.6 registry。
#   ai-gw/rust:1     Rust 编译产物 wheel（artifact，非运行服务）
#   ai-gw/python:1   完整 litellm proxy 服务（容器内 4000）
#   ai-gw/ui:1       nginx 静态 UI（反代 API 到 python）
# 其它镜像（postgres/prometheus）不在此脚本处理。
set -euo pipefail

REPO_DIR="${GATEWAY_REPO_DIR:-/opt/dev/litellm}"
[[ -f "$REPO_DIR/pyproject.toml" ]] || REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

REGISTRY="192.168.22.6:5000"
PREFIX="ai-gw"
TAG="${SPLIT_TAG:-1}"
BUILD_IMAGE="${BUILD_IMAGE:-cgr.dev/chainguard/wolfi-base:local}"
PROXY="${HTTP_PROXY:-http://192.168.24.200:7890}"
NO_PROXY_VAL="localhost,127.0.0.1,db,.svc,.local,.tsinghua.edu.cn,.npmmirror.com,crates.io,index.crates.io,static.crates.io,.crates.io"
PUSH=1
ONLY=""
COMPONENTS=(rust python ui)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=0 ;;
    --only) shift; ONLY="$1" ;;
    --tag) shift; TAG="$1" ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
  shift
done

[[ -z "$ONLY" ]] || COMPONENTS=("$ONLY")

COMMON_ARGS=(
  --build-arg "HTTP_PROXY=$PROXY" --build-arg "HTTPS_PROXY=$PROXY"
  --build-arg "http_proxy=$PROXY" --build-arg "https_proxy=$PROXY"
  --build-arg "NO_PROXY=$NO_PROXY_VAL" --build-arg "no_proxy=$NO_PROXY_VAL"
)

build_component() {
  local name="$1" dockerfile="$2" image="$3"
  shift 3
  echo "== 构建 $image"
  docker buildx build --builder default --load --target "$name" \
    -t "$image" \
    "${COMMON_ARGS[@]}" \
    "$@" \
    -f "$dockerfile" .
}

for component in "${COMPONENTS[@]}"; do
  case "$component" in
    rust)
      build_component artifact docker/split/Dockerfile.rust \
        "$REGISTRY/$PREFIX/rust:$TAG" --build-arg "LITELLM_BUILD_IMAGE=$BUILD_IMAGE"
      ;;
    python)
      build_component runtime docker/split/Dockerfile.python \
        "$REGISTRY/$PREFIX/python:$TAG" \
        --build-arg "LITELLM_BUILD_IMAGE=$BUILD_IMAGE" \
        --build-arg "LITELLM_RUNTIME_IMAGE=$BUILD_IMAGE" \
        --build-arg "NATIVE_IMAGE=$REGISTRY/$PREFIX/rust:$TAG"
      ;;
    ui)
      build_component runtime docker/split/Dockerfile.ui \
        "$REGISTRY/$PREFIX/ui:$TAG"
      ;;
    *) echo "未知组件: $component" >&2; exit 1 ;;
  esac
done

if [[ $PUSH -eq 1 ]]; then
  echo "== 推送"
  for component in "${COMPONENTS[@]}"; do
    image="$REGISTRY/$PREFIX/$component:$TAG"
    echo "-- $image"
    docker push "$image"
  done
fi

echo "== 完成"
