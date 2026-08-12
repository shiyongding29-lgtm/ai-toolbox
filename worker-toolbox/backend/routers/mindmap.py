"""
思维导图生成 API — 将文本/会议/灵感转换为分层 Markdown，前端用 markmap 渲染。
支持：直接输入文本、从会议记录 ID 生成、上传文件生成。
"""
import os
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import MeetingRecord
from backend.services.llm_service import llm_service
from backend.routers.history import save_history

router = APIRouter(prefix="/api/mindmap", tags=["mindmap"])

MINDMAP_SYSTEM = """You are an expert knowledge organizer. Convert the user's input into a hierarchical mind map structure in Markdown format.

Rules:
- Use ## for main topics (level 1 nodes)
- Use ### for subtopics (level 2 nodes)
- Use #### for details (level 3 nodes)
- Use - for leaf items under any heading
- Keep each node concise (under 15 words)
- Organize logically: group related ideas, use clear hierarchy
- Cover ALL key points from the input — be thorough
- Use the same language as the input

Output ONLY the markdown structure, no preamble or explanation."""


class MindmapRequest(BaseModel):
    text: str = Field(default="", max_length=100000)
    mode: str = Field(default="auto", description="auto | meeting | ideas | document")


MODE_PROMPTS = {
    "meeting": "Convert this meeting transcript into a structured mind map. Capture decisions, action items, discussion topics, and key points:\n\n",
    "ideas": "Convert these brainstorm ideas into an organized mind map. Group related concepts, identify themes, and create a clear hierarchy:\n\n",
    "document": "Convert this document into a knowledge mind map. Extract the main topics, key concepts, and important details:\n\n",
    "auto": "",
}


@router.post("/generate")
async def generate_mindmap(req: MindmapRequest, db: Session = Depends(get_db)):
    text = req.text
    prefix = MODE_PROMPTS.get(req.mode, "")
    user_message = prefix + text

    markdown = llm_service.complete(MINDMAP_SYSTEM, user_message)
    history_id = save_history(db, "mindmap", f"思维导图: {text[:50]}", text[:500], markdown)

    return {
        "code": 0, "msg": "ok",
        "data": {"markdown": markdown, "mode": req.mode},
        "history_id": history_id,
    }


@router.post("/from-meeting")
async def mindmap_from_meeting(meeting_id: int = Form(...), content_type: str = Form("transcript"), db: Session = Depends(get_db)):
    """从会议记录生成思维导图。content_type: transcript | summary"""
    m = db.query(MeetingRecord).filter(MeetingRecord.id == meeting_id).first()
    if not m:
        return {"code": 404, "msg": "会议记录不存在", "data": None}

    text = m.summary if content_type == "summary" and m.summary else m.transcript
    if not text:
        return {"code": 400, "msg": "会议内容为空", "data": None}

    prefix = MODE_PROMPTS["meeting"]
    markdown = llm_service.complete(MINDMAP_SYSTEM, prefix + text)
    history_id = save_history(db, "mindmap", f"会议思维导图: #{meeting_id}", text[:500], markdown)

    return {
        "code": 0, "msg": "ok",
        "data": {"markdown": markdown, "meeting_id": meeting_id, "content_type": content_type},
        "history_id": history_id,
    }


@router.post("/from-file")
async def mindmap_from_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """从上传文件生成思维导图。支持 .txt .md .pdf"""
    raw = await file.read()
    filename = (file.filename or "document").lower()

    # 解析文件内容
    text = ""
    if filename.endswith(".pdf"):
        try:
            import fitz
            doc = fitz.open(stream=raw, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        except Exception:
            text = raw.decode("utf-8", errors="replace")
    else:
        text = raw.decode("utf-8", errors="replace")

    if not text.strip():
        return {"code": 400, "msg": "文件内容为空", "data": None}

    text = text[:50000] if len(text) > 50000 else text

    prefix = MODE_PROMPTS["document"]
    markdown = llm_service.complete(MINDMAP_SYSTEM, prefix + text)
    history_id = save_history(db, "mindmap", f"文档思维导图: {file.filename}", text[:500], markdown)

    return {
        "code": 0, "msg": "ok",
        "data": {"markdown": markdown, "filename": file.filename},
        "history_id": history_id,
    }
