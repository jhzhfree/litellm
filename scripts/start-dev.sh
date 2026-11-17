#!/usr/bin/env bash
# start-dev.sh — 一键启动本地前后端，并保证两个访问入口都是最新代码
#
# 背景：
#   - 前端 dev server (3000) 热更新，永远是最新源码
#   - 后端 (4001) 托管的 /ui 静态快照来自 litellm/proxy/_experimental/out，
#     源码改动后需要重新构建同步，否则 4001/ui 一直是旧版
#
# 本脚本流程：
#   1. 检测 UI 源码是否比静态快照新，新则先执行 sync-ui.sh --no-restart（构建 + 替换快照）
#   2. 启动后端（4001，proxy_server_config.yaml，--reload）
#   3. 启动前端 dev server（3000，NEXT_PUBLIC_BASE_URL 指向 4001）
#   4. 已在运行的进程直接跳过，不重复启动
#
# 用法：
#   scripts/start-dev.sh            # 按需同步快照 + 启动前后端
#   scripts/start-dev.sh --skip-ui  # 跳过快照同步检测（纯启动）
#
# 访问入口：
#   开发:      http://localhost:3000  （推荐，源码实时生效）
#   后端托管:  http://localhost:4001/ui
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$ROOT/ui/litellm-dashboard"
OUT_SNAPSHOT="$ROOT/litellm/proxy/_experimental/out/index.html"
BACKEND_PORT=4001
FRONTEND_PORT=3000
BACKEND_LOG="${BACKEND_LOG:-/root/litellm-backend.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/root/litellm-frontend.log}"

SKIP_UI=0
for arg in "$@"; do
  case "$arg" in
    --skip-ui) SKIP_UI=1 ;;
    *) echo "未知参数: $arg（支持 --skip-ui）"; exit 1 ;;
  esac
done

cd "$ROOT"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

port_busy() { ss -tln "sport = :$1" 2>/dev/null | grep -q LISTEN; }

# 1) UI 源码有更新时先同步静态快照（保证 4001/ui 也是最新）
if [ "$SKIP_UI" -eq 0 ]; then
  if [ ! -f "$OUT_SNAPSHOT" ]; then
    echo "==> 静态快照不存在，执行完整同步"
    scripts/sync-ui.sh --no-restart
  elif [ "$(find "$UI_DIR/src" \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' \) ! -name '*.test.*' -newer "$OUT_SNAPSHOT" 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "==> 检测到 UI 源码比静态快照新，先构建同步（约 1-2 分钟）"
    scripts/sync-ui.sh --no-restart
  else
    echo "==> UI 快照已是最新，跳过构建"
  fi
fi

# 2) 启动后端
if port_busy "$BACKEND_PORT"; then
  echo "==> 后端已在运行（端口 $BACKEND_PORT），跳过启动"
else
  echo "==> 启动后端: .venv/bin/litellm --config proxy_server_config.yaml --port $BACKEND_PORT --reload"
  echo "    日志: $BACKEND_LOG"
  setsid nohup .venv/bin/litellm \
    --config proxy_server_config.yaml --port "$BACKEND_PORT" --reload \
    > "$BACKEND_LOG" 2>&1 &
fi

# 3) 启动前端
if port_busy "$FRONTEND_PORT"; then
  echo "==> 前端已在运行（端口 $FRONTEND_PORT），跳过启动"
else
  echo "==> 启动前端: npm run dev（NEXT_PUBLIC_BASE_URL=http://localhost:$BACKEND_PORT）"
  echo "    日志: $FRONTEND_LOG"
  (cd "$UI_DIR" && setsid nohup env NODE_OPTIONS=--max-old-space-size=8192 \
    NEXT_PUBLIC_BASE_URL="http://localhost:$BACKEND_PORT" \
    npm run dev > "$FRONTEND_LOG" 2>&1 &)
fi

# 4) 就绪检查
echo "==> 等待服务就绪（后端首次启动约 60s）"
for i in $(seq 1 60); do
  if curl -sf "http://localhost:$BACKEND_PORT/health/liveliness" > /dev/null 2>&1; then
    echo "    后端就绪（端口 $BACKEND_PORT）"
    break
  fi
  sleep 2
done

for i in $(seq 1 30); do
  if port_busy "$FRONTEND_PORT"; then
    echo "    前端就绪（端口 $FRONTEND_PORT）"
    break
  fi
  sleep 2
done

cat <<EOF

启动完成，访问入口:
  开发:      http://localhost:$FRONTEND_PORT  （源码实时生效）
  后端托管:  http://localhost:$BACKEND_PORT/ui （静态快照，浏览器请硬刷新 Ctrl+Shift+R）

停止:  pkill -f "litellm --config" ; pkill -f "next dev"
日志:  $BACKEND_LOG / $FRONTEND_LOG
EOF
