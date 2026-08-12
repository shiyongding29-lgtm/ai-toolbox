"""图片分析 API — 上传图片，AI 分析描述。"""
import json
import re
import os
import tempfile
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form
from PIL import Image

from backend.services.llm_service import llm_service
from backend.services.prompt_library import IMAGE_ANALYSIS_SYSTEM

router = APIRouter(prefix="/api/image", tags=["image-analyzer"])


@router.post("/analyze")
async def image_analyze(file: UploadFile = File(...), hint: str = Form("")):
    """上传图片，返回 AI 分析描述。"""
    # 读取并验证图片
    try:
        contents = await file.read()
        img = Image.open(BytesIO(contents))
    except Exception:
        return {"code": 400, "msg": "Invalid image file 無效的圖片文件", "data": None}

    # 提取元信息
    fmt = img.format or file.filename.split('.')[-1].upper() if file.filename else "UNKNOWN"
    w, h = img.size
    mode = img.mode
    file_size_kb = len(contents) / 1024

    meta = (
        f"Image: {file.filename}\n"
        f"Format: {fmt} | Size: {w}x{h}px | Mode: {mode} | File: {file_size_kb:.0f}KB\n"
    )
    if hint:
        meta += f"User hint: {hint}\n"

    # 调用 LLM 分析
    try:
        raw = llm_service.complete(IMAGE_ANALYSIS_SYSTEM, meta)
    except Exception as e:
        return {"code": 503, "msg": f"LLM error: {str(e)[:100]}", "data": None}

    # 解析 JSON
    cleaned = raw.strip()
    cleaned = re.sub(r'^```\w*\n?', '', cleaned)
    cleaned = re.sub(r'\n?```$', '', cleaned)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r'\{[\s\S]*\}', cleaned)
        if m:
            try:
                result = json.loads(m.group(0))
            except json.JSONDecodeError:
                result = {"description": raw[:500], "objects": [], "colors": "", "style": "unknown", "text_in_image": "", "quality_notes": ""}
        else:
            result = {"description": raw[:500], "objects": [], "colors": "", "style": "unknown", "text_in_image": "", "quality_notes": ""}

    result["_meta"] = {"filename": file.filename, "format": fmt, "width": w, "height": h, "mode": mode, "size_kb": round(file_size_kb, 1)}

    return {"code": 0, "msg": "ok", "data": result}
