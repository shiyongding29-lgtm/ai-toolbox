"""
SSE 流式输出端点 — 支持前端实时显示 AI 生成内容。
"""

import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.services.llm_service import llm_service, LLMError
from backend.services.prompt_library import get_prompt

router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.post("/chat")
async def stream_chat(req: dict):
    """
    通用流式对话端点。
    body: { "system": "prompt name or raw prompt", "text": "user message", "mode": "optional" }
    """
    system_prompt = req.get("system", "")
    text = req.get("text", "")
    mode = req.get("mode", "")

    if not text:
        return {"code": 400, "msg": "Missing text", "data": None}

    if system_prompt in ("translation", "email_generation", "document_summary", "weekly_report",
                         "ppt_outline", "meeting_summary", "document_comparison", "task_planning",
                         "multi_source_synthesis", "data_analysis_insights", "todo_extraction",
                         "info_extraction", "rag_qa", "data_analysis_code", "deep_research_plan",
                         "deep_research_analyze", "deep_research_report"):
        system_prompt = get_prompt(system_prompt)

    if not llm_service.is_available:
        async def error_stream():
            yield f"data: {json.dumps({'chunk': '⚠️ LLM 未配置，请设置 OPENAI_API_KEY 环境变量。', 'error': 'llm_not_configured'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    async def event_stream():
        try:
            async for chunk in llm_service.stream(system_prompt, text):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                await asyncio.sleep(0.01)
            yield "data: [DONE]\n\n"
        except LLMError as e:
            yield f"data: {json.dumps({'error': e.message})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'LLM 调用失败: {str(e)[:200]}'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
