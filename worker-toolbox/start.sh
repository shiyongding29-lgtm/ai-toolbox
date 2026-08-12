#!/bin/bash
# 打工人工具箱 — 一键启动脚本
# 同时启动后端 (FastAPI) 和前端 (Vite)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🛠️  打工人工具箱启动中..."
echo ""

# 检查环境变量
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  警告: OPENAI_API_KEY 未设置，LLM 功能不可用。"
    echo "   请在 ~/.zshrc 中设置: export OPENAI_API_KEY='your-key'"
    echo ""
fi

# 启动后端（从 worker-toolbox 根目录启动，确保 meeting_recorder 可 import）
echo "📡 启动后端 (FastAPI) — http://localhost:8000"
cd "$SCRIPT_DIR"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 启动前端
echo "🌐 启动前端 (Vite) — http://localhost:5173"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动"
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:8000/api/health"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 清理
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
