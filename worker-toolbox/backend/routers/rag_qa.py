"""本地知识库 RAG 问答 API。"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.llm_service import llm_service, LLMError
from backend.services.embedding_service import embedding_service
from backend.services.prompt_library import RAG_QA_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/rag-qa", tags=["rag-qa"])


class RagAskRequest(BaseModel):
    question: str = Field(..., min_length=1)


@router.post("/upload")
async def rag_upload(file: UploadFile = File(...)):
    """上传文档到知识库。"""
    try:
        raw = await file.read()
        content = raw.decode("utf-8", errors="replace")
    except Exception:
        try:
            import fitz
            doc = fitz.open(stream=raw, filetype="pdf")
            pages = [page.get_text() for page in doc]
            content = "\n\n".join(pages)
        except Exception:
            content = raw.decode("utf-8", errors="replace")

    if not content.strip():
        return {"code": 400, "msg": "无法解析文件内容", "data": None}

    count = embedding_service.add_document(content[:100000], file.filename or "unknown")
    return {"code": 0, "msg": f"已添加 {count} 个文本片段", "data": {"chunks_added": count}}


@router.post("/ask")
async def rag_ask(req: RagAskRequest, db: Session = Depends(get_db)):
    """向知识库提问。"""
    if not embedding_service.is_ready:
        return {"code": 400, "msg": "知识库为空，请先上传文档", "data": None}

    hits = embedding_service.search(req.question, top_k=5)
    context = "\n\n---\n\n".join(
        f"[{h['doc_name']}] {h['text']}" for h in hits
    )

    prompt = RAG_QA_SYSTEM.format(context=context, question=req.question)
    try:
        result = llm_service.complete("You are a helpful assistant.", prompt)
    except LLMError as e:
        return {"code": 503, "msg": e.message, "data": None}

    history_id = save_history(db, "rag-qa", f"Q: {req.question[:50]}", "", result)

    return {
        "code": 0,
        "msg": "ok",
        "data": {
            "answer": result,
            "sources": [{"doc_name": h["doc_name"], "score": round(h["score"], 3)} for h in hits],
        },
        "history_id": history_id,
    }


@router.get("/docs")
async def rag_list_docs():
    """列出知识库中的文档。"""
    try:
        docs = embedding_service.list_documents()
        return {"code": 0, "msg": "ok", "data": {"documents": docs}}
    except ImportError as e:
        return {"code": 503, "msg": f"依赖缺失: {str(e)}", "data": {"documents": []}}
