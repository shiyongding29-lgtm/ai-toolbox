"""信息提取 API。"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LlmResponse
from backend.services.llm_service import llm_service
from backend.services.prompt_library import INFO_EXTRACTION_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/info-extraction", tags=["info-extraction"])


@router.post("/run")
async def info_extraction_run(
    text: str = Form(""),
    mode: str = Form("general"),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """信息提取：从文本或上传文件中提取结构化信息。"""
    content = text

    if file and not content:
        try:
            raw = await file.read()
            import fitz
            doc = fitz.open(stream=raw, filetype="pdf")
            pages = [page.get_text() for page in doc]
            content = "\n\n".join(pages)
        except Exception as e:
            return {"code": 500, "msg": f"文件解析失败: {e}", "data": None}

    if not content or not content.strip():
        return {"code": 400, "msg": "未提供有效内容", "data": None}

    prompt = f"Mode: {mode}\n\nDocument text:\n{content[:50000]}"
    result = llm_service.complete(INFO_EXTRACTION_SYSTEM, prompt)
    history_id = save_history(db, "info-extraction", f"信息提取({mode}): {content[:50]}", content[:500], result)

    return LlmResponse(data={"result": result, "mode": mode}, history_id=history_id)
