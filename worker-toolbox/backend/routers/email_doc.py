"""邮件 / 公文生成 API。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LlmRequest, LlmResponse
from backend.services.llm_service import llm_service, LLMError
from backend.services.prompt_library import EMAIL_GENERATION_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/email-doc", tags=["email-doc"])

MODE_LABELS = {"email": "邮件", "official": "公文", "report": "报告", "notice": "通知"}


@router.post("/run")
async def email_doc_run(req: LlmRequest, db: Session = Depends(get_db)):
    mode = req.mode or "email"
    mode_label = MODE_LABELS.get(mode, mode)
    # Build a more detailed prompt so the LLM has context
    user_text = req.text.strip() or req.extra_context or ""
    prompt = f"Generate a {mode_label} ({mode}). The user said: {user_text}"
    try:
        result = llm_service.complete(EMAIL_GENERATION_SYSTEM, prompt)
    except LLMError as e:
        return {"code": 503, "msg": e.message, "data": None}
    history_id = save_history(db, "email-doc", f"生成{mode_label}: {user_text[:50]}", user_text, result)
    return {"code": 0, "msg": "ok", "data": {"result": result, "mode": mode}, "history_id": history_id}
