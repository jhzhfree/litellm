#!/usr/bin/env bash
# scripts/build-push.sh — 智能构建 AI-GovernanceGw 镜像并推送到本地 registry
#
# 用法:
#   scripts/build-push.sh             # 自动选择构建方式 + 推送 gateway:1
#   scripts/build-push.sh --no-push   # 仅构建
#   scripts/build-push.sh --full      # 强制全量构建(跳过快速路径)
#   scripts/build-push.sh --tag v1.2  # 额外指定 tag
#
# 智能模式(根据上次构建点以来的改动自动选择):
#   1. config-only  仅 deploy 配置/文档改动 且本地容器运行中
#                   → 快速路径: docker cp 配置进容器 + restart, 秒级
#                     (需要发布镜像时用 --full 或 git 提交后自然触发全量)
#   2. full         其他情况走完整构建 — Dockerfile 精细分层保证:
#                     仅 UI 改动 → Rust/Python 层 CACHED
#                     仅 Python 改动 → Rust 层 CACHED
#                     仅配置改动 → 只有 config/runtime 层重建(分钟级)
#
# 依赖 /root/Dockerfile.build（含 cargo/uv/npm 缓存挂载与 thin LTO 加速）。
# 注意: 不要执行 docker builder prune —— 会清空缓存挂载数据, 导致下次全量重编。
set -euo pipefail
# 脚本可能放在 /root 或仓库内, 统一定位仓库根
REPO_DIR="${GATEWAY_REPO_DIR:-/opt/dev/litellm}"
[[ -f "$REPO_DIR/pyproject.toml" ]] || REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

REGISTRY="192.168.22.6:5000"
IMAGE="ai-gw/gateway"
STAMP="$(date +%Y%m%d-%H%M)"
DOCKERFILE="${DOCKERFILE:-/root/Dockerfile.build}"
PROXY="${HTTP_PROXY:-http://192.168.24.200:7890}"
# 国内镜像源直连(pypi tuna/npmmirror/crates.io), 不走代理 —— 代理出口对
    # TLS 长连接不稳, 直连镜像更可靠
    NO_PROXY_VAL="localhost,127.0.0.1,db,.svc,.local,.tsinghua.edu.cn,.npmmirror.com,crates.io,index.crates.io,static.crates.io,.crates.io"
PUSH=1
FORCE_FULL=0
EXTRA_TAGS=()
LAST_BUILD_COMMIT_FILE="/root/.gateway-last-build-commit"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=0 ;;
    --full) FORCE_FULL=1 ;;
    --tag) shift; EXTRA_TAGS+=("$REGISTRY/$IMAGE:$1") ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# 改动分析: 与上次成功构建点比较 (含工作区未提交改动与未跟踪文件)
# ---------------------------------------------------------------------------
LAST_REF="HEAD"
[[ -f "$LAST_BUILD_COMMIT_FILE" ]] && LAST_REF="$(cat "$LAST_BUILD_COMMIT_FILE")"

CHANGED="$( { git diff --name-only "$LAST_REF" -- . 2>/dev/null || true;
              git diff --name-only 2>/dev/null || true;
              git ls-files --others --exclude-standard; } | sort -u )"

SRC_CHANGED=0; UI_CHANGED=0; RUST_CHANGED=0; CONFIG_ONLY=0; PY_CHANGED=0
if [[ -n "$CHANGED" ]]; then
  CONFIG_ONLY=1
  while IFS= read -r f; do
    case "$f" in
      ui/litellm-dashboard/*) UI_CHANGED=1; CONFIG_ONLY=0 ;;
      litellm-rust/*)         RUST_CHANGED=1; CONFIG_ONLY=0 ;;
      litellm/*|enterprise/*|litellm_cli/*|litellm-proxy-extras/*|packaging/*) PY_CHANGED=1; CONFIG_ONLY=0 ;;
      # 不参与镜像构建的文件(配置/文档/构建脚本自身), 不破坏 config-only 判定
      deploy/*|*.md|docs/*|.gitignore|.dockerignore|scripts/*|.build-prisma-cache/*|*.log) : ;;
      *)                      CONFIG_ONLY=0 ;;  # 未知文件: 保守走全量
    esac
  done <<< "$CHANGED"
  SRC_CHANGED=1
fi

# ---------------------------------------------------------------------------
# 模式选择
# ---------------------------------------------------------------------------
if [[ $FORCE_FULL -eq 1 ]]; then
  MODE="full(--full 强制)"
elif [[ $CONFIG_ONLY -eq 1 && $PUSH -eq 0 ]] && docker ps --format '{{.Names}}' | grep -q '^ai-tokengw-core$'; then
  MODE="config-quick"
else
  MODE="full"
fi

echo "== 改动分析 (基点: $LAST_REF)"
if [[ -z "$CHANGED" ]]; then
  echo "   无改动; 将使用全缓存构建"
elif [[ $CONFIG_ONLY -eq 1 ]]; then
  echo "   仅配置/文档改动(分层优化下 config/runtime 层重建):"
  echo "$CHANGED" | sed 's/^/     /'
else
  [[ $UI_CHANGED -eq 1 ]] && echo "   UI 改动 → next build 重跑 (~6-8 分钟)"
  [[ $RUST_CHANGED -eq 1 ]] && echo "   Rust 改动 → cargo 重编译 (~10-15 分钟)"
  [[ $PY_CHANGED -eq 1 ]] && echo "   Python 改动 → wheel/prisma 层重建 (~3-5 分钟)"
  [[ $UI_CHANGED -eq 0 && $RUST_CHANGED -eq 0 && $PY_CHANGED -eq 0 ]] && echo "   其他改动 → 触发依赖层之后的重建"
fi
echo "== 构建模式: $MODE"

# ---------------------------------------------------------------------------
# 快速路径: 仅配置改动且只做本地验证 → docker cp + restart
# ---------------------------------------------------------------------------
if [[ "$MODE" == "config-quick" ]]; then
  echo "== 快速路径: 更新本地容器配置"
  # 本地部署把 deploy/proxy_config.yaml bind-mount 进容器 → 宿主机文件即是
  # 容器内文件, restart 即生效; 未挂载时退回 docker cp。
  MOUNT_SRC="$(docker inspect ai-tokengw-core --format '{{range .Mounts}}{{if eq .Destination "/app/proxy_config.yaml"}}{{.Source}}{{end}}{{end}}')"
  if [[ -n "$MOUNT_SRC" ]]; then
    if [[ "$MOUNT_SRC" != "$(pwd)/deploy/proxy_config.yaml" && -f deploy/proxy_config.yaml ]]; then
      cp deploy/proxy_config.yaml "$MOUNT_SRC"
    fi
    docker restart ai-tokengw-core >/dev/null
    echo "   配置(挂载于 $MOUNT_SRC)已更新并重启 ai-tokengw-core"
  elif [[ -f deploy/proxy_config.yaml ]]; then
    docker cp deploy/proxy_config.yaml ai-tokengw-core:/app/proxy_config.yaml
    docker restart ai-tokengw-core >/dev/null
    echo "   proxy_config.yaml 已更新并重启 ai-tokengw-core"
  fi
  echo "   (此模式不构建/不推送镜像; 需要发布 22.6 时加 --full)"
  exit 0
fi

# ---------------------------------------------------------------------------
# 完整构建
# ---------------------------------------------------------------------------
# 只推固定标签（不打时间戳/别名标签，避免 registry 堆积旧版本）
TAGS=("$REGISTRY/$IMAGE:1" "${EXTRA_TAGS[@]}")
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

# 记录本次构建点 (供下次改动分析)
git rev-parse HEAD > "$LAST_BUILD_COMMIT_FILE"

echo "== 完成。服务器拉取:"
echo "   docker pull $REGISTRY/$IMAGE:latest"
