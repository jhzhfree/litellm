#!/usr/bin/env bash
# sync-ui.sh — 用最新前端源码同步后端托管的 UI（/ui/login 等静态页面）
#
# 背景：dev 前端(3000)是热更新的，但后端(4001)托管的 /ui/login 等页面来自
# litellm/proxy/_experimental/out 静态快照，源码改动不会自动生效。
# 本脚本完成：构建 → 替换快照 → 重启后端 → 健康检查与品牌验证。
#
# 用法：
#   scripts/sync-ui.sh              # 完整流程：构建 + 替换 + 重启后端
#   scripts/sync-ui.sh --no-build   # 跳过 npm build（out/ 已是最新时）
#   scripts/sync-ui.sh --no-restart # 只构建和替换，不动后端
#
# 详见 LOCAL_DEV.md 4.1 节。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$ROOT/ui/litellm-dashboard"
OUT_SRC="$UI_DIR/out"
OUT_DST="$ROOT/litellm/proxy/_experimental/out"
PORT=4001
BACKEND_LOG="${BACKEND_LOG:-/root/litellm-backend.log}"
NODE_HEAP="${NODE_HEAP:-8192}"

NO_BUILD=0
NO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --no-build)   NO_BUILD=1 ;;
    --no-restart) NO_RESTART=1 ;;
    *) echo "未知参数: $arg（支持 --no-build / --no-restart）"; exit 1 ;;
  esac
done

for d in "$UI_DIR" "$ROOT/.env"; do
  [ -e "$d" ] || { echo "缺少 $d，请在仓库根目录的 git 工作区中运行"; exit 1; }
done

echo "==> [1/4] 构建静态导出（NODE_OPTIONS 堆上限 ${NODE_HEAP}MB）"
if [ "$NO_BUILD" -eq 0 ]; then
  (cd "$UI_DIR" && NODE_OPTIONS="--max-old-space-size=${NODE_HEAP}" npm run build) \
    || { echo "构建失败，未做任何替换"; exit 1; }
else
  echo "    跳过构建（--no-build）"
fi

echo "==> [2/4] 同步快照 $OUT_DST"
if command -v rsync >/dev/null 2>&1; then
  mkdir -p "$OUT_DST"
  rsync -a --delete "$OUT_SRC/" "$OUT_DST/"
else
  rm -rf "$OUT_DST"
  cp -r "$OUT_SRC" "$OUT_DST"
fi

brand=$(grep -c "AOIDC" "$OUT_DST/index.html" || true)
echo "    首页品牌标记: AOIDC ×${brand}（预期 ≥1）"

if [ "$NO_RESTART" -eq 1 ]; then
  echo "==> 完成（--no-restart：后端未重启，下次重启后端时生效）"
  exit 0
fi

echo "==> [3/4] 重启后端（端口 $PORT）"
pkill -f "litellm --config" 2>/dev/null || true
# Wait for the old instance (reloader + workers) to release the port, otherwise
# the new instance exits with "address already in use".
for _ in $(seq 1 30); do
  ss -ltn 2>/dev/null | grep -q ":$PORT " || break
  sleep 2
done
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "    端口 $PORT 仍被占用，放弃重启。占用进程:"
  ss -ltnp 2>/dev/null | grep ":$PORT " || true
  exit 1
fi
set -a; source "$ROOT/.env"; set +a
(cd "$ROOT" && setsid nohup .venv/bin/litellm \
  --config proxy_server_config.yaml --port "$PORT" --reload \
  > "$BACKEND_LOG" 2>&1 &)
echo "    日志: $BACKEND_LOG（首次启动需等待 Prisma 检查与 worker 导入，约 60s）"

echo "==> [4/4] 健康检查"
ok=0
for i in $(seq 1 24); do
  if curl -sS -m 5 "http://localhost:$PORT/health/liveliness" 2>/dev/null | grep -q "I'm alive"; then
    ok=1; break
  fi
  sleep 5
done
if [ "$ok" -ne 1 ]; then
  echo "    后端 $PORT 未就绪，查看日志: tail -20 $BACKEND_LOG"
  exit 1
fi
echo "    后端就绪: $(curl -sS -m 5 "http://localhost:$PORT/health/liveliness")"

login_brand=$(curl -sSL -m 20 "http://localhost:$PORT/ui/login/" 2>/dev/null | grep -c "AOIDC" || true)
echo "    登录页品牌标记: AOIDC ×${login_brand}（预期 ≥1）"

echo ""
echo "全部完成。访问入口:"
echo "  开发:      http://192.168.24.202:3000  (连 $PORT 后端，源码实时生效)"
echo "  后端托管:  http://192.168.24.202:$PORT/ui  (静态快照，浏览器请硬刷新)"
