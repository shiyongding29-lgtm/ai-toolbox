"""文档对比分析 API。"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.llm_service import llm_service
from backend.services.prompt_library import DOCUMENT_COMPARISON_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/document-comparison", tags=["document-comparison"])


async def _read_upload(file: UploadFile | None) -> str:
    if not file:
        return ""
    raw = await file.read()
    try:
        import fitz
        doc = fitz.open(stream=raw, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except Exception:
        return raw.decode("utf-8", errors="replace")


@router.post("/compare")
async def document_compare(
    text_a: str = Form(""),
    text_b: str = Form(""),
    file_a: UploadFile | None = File(None),
    file_b: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """对比两份文档。支持粘贴文本或上传文件。"""
    if not text_a and file_a:
        text_a = await _read_upload(file_a)
    if not text_b and file_b:
        text_b = await _read_upload(file_b)

    if not text_a or not text_b:
        return {"code": 400, "msg": "需要两份文档内容", "data": None}

    prompt = f"Document A:\n{text_a[:8000]}\n\n---\n\nDocument B:\n{text_b[:8000]}"
    result = llm_service.complete(DOCUMENT_COMPARISON_SYSTEM, prompt)
    history_id = save_history(db, "document-comparison", f"文档对比", f"A: {text_a[:50]}", result)

    return {"code": 0, "msg": "ok", "data": {"result": result}, "history_id": history_id}
