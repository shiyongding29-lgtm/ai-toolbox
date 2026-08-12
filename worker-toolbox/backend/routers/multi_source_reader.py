"""多源聚合阅读 API — 上传多份文件+URL，AI 综合阅读。"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
import httpx
from bs4 import BeautifulSoup

from backend.database import get_db
from backend.services.llm_service import llm_service
from backend.services.prompt_library import MULTI_SOURCE_SYNTHESIS_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/multi-source-reader", tags=["multi-source-reader"])


@router.post("/read")
async def multi_source_read(
    urls: str = Form(""),
    files: list[UploadFile] = File([]),
    db: Session = Depends(get_db),
):
    """上传文件+URL，全部阅读后综合。"""
    sources = []
    source_labels = []

    # 处理 URL
    url_list = [u.strip() for u in urls.split("\n") if u.strip()]
    for i, url in enumerate(url_list):
        try:
            resp = httpx.get(url, timeout=15, follow_redirects=True,
                             headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            text = "\n".join(line for line in text.split("\n") if line.strip())
            sources.append(f"### URL {i+1}: {url}\n{text[:5000]}")
            source_labels.append(url)
        except Exception as e:
            sources.append(f"### URL {i+1}: {url} (抓取失败: {e})")

    # 处理上传文件
    for i, file in enumerate(files):
        try:
            raw = await file.read()
            try:
                import fitz
                doc = fitz.open(stream=raw, filetype="pdf")
                text = "\n".join(page.get_text() for page in doc)
            except Exception:
                text = raw.decode("utf-8", errors="replace")
            sources.append(f"### File {i+1}: {file.filename}\n{text[:5000]}")
            source_labels.append(file.filename or f"file_{i+1}")
        except Exception as e:
            sources.append(f"### File {i+1}: {file.filename} (解析失败: {e})")

    if not sources:
        return {"code": 400, "msg": "请提供至少一个 URL 或文件", "data": None}

    all_text = "\n\n".join(sources)
    result = llm_service.complete(MULTI_SOURCE_SYNTHESIS_SYSTEM, all_text[:30000])
    history_id = save_history(db, "multi-source-reader", f"多源阅读: {len(sources)}个来源", "", result)

    return {
        "code": 0, "msg": "ok",
        "data": {"result": result, "sources": source_labels},
        "history_id": history_id,
    }
