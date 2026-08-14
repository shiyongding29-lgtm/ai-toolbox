"""翻译 & 写作助手 API。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LlmRequest, LlmResponse
from backend.services.llm_service import llm_service
from backend.services.prompt_library import TRANSLATION_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/translation-assistant", tags=["translation-assistant"])

MODE_LABELS = {
    "translate_zh_en": "中译英",
    "translate_en_zh": "英译中",
    "polish": "润色",
    "rewrite": "改写",
    "style_casual": "正式转口语化",
    "style_formal": "口语转正式",
    "expand": "扩写",
    "summarize": "缩写",
    "generate_reply": "生成回复",
}

MODE_PREFIXES = {
    "translate_zh_en": "Translate the following Chinese text to English:\n\n",
    "translate_en_zh": "Translate the following English text to Chinese:\n\n",
    "polish": "Polish and improve the following text:\n\n",
    "rewrite": "Rewrite the following text.",
    "style_casual": "Rewrite the following text in a casual, conversational tone:\n\n",
    "style_formal": "Rewrite the following text in a formal, professional tone:\n\n",
    "expand": "Expand the following text with more details and examples while keeping the core meaning:\n\n",
    "summarize": "Condense the following text to its key points. Make it shorter:\n\n",
    "generate_reply": "Generate a natural reply to the following message:\n\n",
}


@router.post("/run")
def translation_run(req: LlmRequest, db: Session = Depends(get_db)):
    mode = req.mode or "translate_zh_en"
    mode_label = MODE_LABELS.get(mode, mode)
    user_prefix = MODE_PREFIXES.get(mode, "")

    if mode == "rewrite" and req.extra_context:
        user_prefix = f"Rewrite the following text. {req.extra_context}:\n\n"

    result = llm_service.complete(TRANSLATION_SYSTEM, user_prefix + req.text)
    history_id = save_history(db, "translation-assistant", f"{mode_label}: {req.text[:50]}", req.text, result)

    return LlmResponse(data={"result": result, "mode": req.mode}, history_id=history_id)
