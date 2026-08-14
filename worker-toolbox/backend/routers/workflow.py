"""
动态工作流 API — AI 根据需求编排工具，可视化执行管道。
"""
import json
import os
import tempfile
import time
import asyncio
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field

from backend.routers.workflow_engine import (
    plan_workflow, run_workflow, get_workflow_status,
)
from backend.routers.tools_registry import TOOLS, TOOLS_BY_ID
from backend.services.audio_service import transcribe_audio, segments_to_text

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


class PlanRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class RunRequest(BaseModel):
    plan: dict = Field(...)
    input: dict = Field(default_factory=dict)


@router.post("/plan")
def workflow_plan(req: PlanRequest):
    """AI 分析用户需求，生成工作流计划（nodes + edges）。"""
    plan = plan_workflow(req.text)
    if "error" in plan:
        return {"code": 400, "msg": plan["error"], "data": plan.get("raw")}
    return {"code": 0, "msg": "ok", "data": plan}


@router.post("/run")
def workflow_run(req: RunRequest):
    """根据 plan 执行工作流。"""
    plan = req.plan
    user_input = req.input
    if not plan.get("nodes"):
        return {"code": 400, "msg": "Invalid plan", "data": None}
    workflow_id = run_workflow(plan, user_input)
    return {"code": 0, "msg": "ok", "data": {"workflow_id": workflow_id}}


@router.get("/status/{workflow_id}")
def workflow_status(workflow_id: str):
    """查询工作流执行进度。"""
    data = get_workflow_status(workflow_id)
    if not data:
        return {"code": 404, "msg": "工作流不存在", "data": None}
    return {"code": 0, "msg": "ok", "data": data}


@router.post("/plan-and-run")
def workflow_plan_and_run(req: PlanRequest):
    """一键：AI 分析需求 → 生成工作流 → 执行。"""
    # 1. AI 规划
    plan = plan_workflow(req.text)
    if "error" in plan:
        return {"code": 400, "msg": plan["error"], "data": plan.get("raw")}

    # 2. 执行
    workflow_id = run_workflow(plan, {"text": req.text})

    return {
        "code": 0, "msg": "ok",
        "data": {
            "workflow_id": workflow_id,
            "plan": plan,
        },
    }


@router.get("/tools")
def list_tools():
    """返回所有可用工具定义，供前端可视化工作流构建器使用。"""
    return {"code": 0, "msg": "ok", "data": TOOLS}


@router.get("/tools/{tool_id}")
def get_tool(tool_id: str):
    """获取单个工具定义。"""
    tool = TOOLS_BY_ID.get(tool_id)
    if not tool:
        return {"code": 404, "msg": "Tool not found", "data": None}
    return {"code": 0, "msg": "ok", "data": tool}


@router.post("/plan-and-run-with-audio")
async def workflow_plan_and_run_with_audio(file: UploadFile = File(...), description: str = None):
    """上传录音 + AI 自动规划并执行工作流（如果不需要特定规划，默认用 meeting→summary→mindmap→todos）。"""
    # 保存并转写
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        segments = await asyncio.to_thread(transcribe_audio, tmp_path)
        transcript = segments_to_text(segments)
    finally:
        os.unlink(tmp_path)

    if not transcript:
        return {"code": 400, "msg": "转写结果为空", "data": None}

    # 如果有用户描述，让 AI 根据描述来规划
    if description:
        plan = await asyncio.to_thread(plan_workflow, f"{description}\n\n会议转录内容：{transcript}")
        if "error" in plan:
            # 降级到默认流程
            plan = {
                "title": "Meeting → Summary → Mindmap → Todos",
                "description": "默认会议处理流程",
                "nodes": [
                    {"id": "rec", "tool": "meeting_recorder", "label": "录音转写"},
                    {"id": "sum", "tool": "document_summary", "label": "AI 总结"},
                    {"id": "mm", "tool": "mindmap", "label": "生成思维导图"},
                    {"id": "todo", "tool": "todo_extraction", "label": "提取待办"},
                    {"id": "add", "tool": "todo_add", "label": "添加到列表"},
                ],
                "edges": [
                    {"from": "rec", "to": "sum", "data": "transcript"},
                    {"from": "sum", "to": "mm", "data": "summary"},
                    {"from": "rec", "to": "todo", "data": "transcript"},
                    {"from": "todo", "to": "add", "data": "todos"},
                ],
                "input": "record_audio",
                "reply": "好的！录音转写 → AI 总结 → 思维导图 → 提取待办 → 添加到列表。",
            }
    else:
        # 默认会议处理流程
        plan = {
            "title": "Meeting → Summary → Mindmap → Todos",
            "description": "会议录音自动处理",
            "nodes": [
                {"id": "rec", "tool": "meeting_recorder", "label": "录音转写"},
                {"id": "sum", "tool": "document_summary", "label": "AI 总结"},
                {"id": "mm", "tool": "mindmap", "label": "生成思维导图"},
                {"id": "todo", "tool": "todo_extraction", "label": "提取待办"},
                {"id": "add", "tool": "todo_add", "label": "添加到列表"},
            ],
            "edges": [
                {"from": "rec", "to": "sum", "data": "transcript"},
                {"from": "sum", "to": "mm", "data": "summary"},
                {"from": "rec", "to": "todo", "data": "transcript"},
                {"from": "todo", "to": "add", "data": "todos"},
            ],
            "input": "record_audio",
            "reply": "好的！录音转写 → AI 总结 → 思维导图 → 提取待办 → 添加到列表。",
        }

    workflow_id = run_workflow(plan, {"text": transcript})

    return {
        "code": 0, "msg": "ok",
        "data": {
            "workflow_id": workflow_id,
            "plan": plan,
            "transcript_preview": transcript[:300],
            "transcript_len": len(transcript),
        },
    }
