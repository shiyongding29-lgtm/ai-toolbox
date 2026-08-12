"""文档摘要 API。"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LlmResponse
from backend.services.llm_service import llm_service
from backend.services.prompt_library import DOCUMENT_SUMMARY_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/document-summary", tags=["document-summary"])


@router.post("/run")
async def document_summary_run(
    text: str = Form(""),
    url: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """文档摘要：支持直接粘贴文本、URL 抓取、PDF 上传三种输入。"""
    content = text

    # URL 抓取
    if url and not content:
        try:
            import httpx
            from bs4 import BeautifulSoup
            resp = httpx.get(url, timeout=15, follow_redirects=True)
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer"]):
                tag.decompose()
            content = soup.get_text(separator="\n", strip=True)
            content = "\n".join(line for line in content.split("\n") if line.strip())
            if len(content) > 50000:
                content = content[:50000] + "...(已截断)"
        except Exception as e:
            return {"code": 500, "msg": f"URL 抓取失败: {e}", "data": None}

    # PDF 上传
    if file and not content:
        try:
            raw = await file.read()
            import fitz  # PyMuPDF
            doc = fitz.open(stream=raw, filetype="pdf")
            pages = []
            for page in doc:
                pages.append(page.get_text())
            content = "\n\n".join(pages)
            if len(content) > 50000:
                content = content[:50000] + "...(已截断)"
        except Exception as e:
            return {"code": 500, "msg": f"PDF 解析失败: {e}", "data": None}

    if not content or not content.strip():
        return {"code": 400, "msg": "未提供有效内容", "data": None}

    result = llm_service.complete(DOCUMENT_SUMMARY_SYSTEM, content[:50000])
    title = f"文档摘要: {content[:50]}"
    history_id = save_history(db, "document-summary", title, content[:500], result)

    return LlmResponse(data={"result": result}, history_id=history_id)
