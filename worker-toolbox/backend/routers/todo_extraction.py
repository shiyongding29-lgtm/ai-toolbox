"""待办事项提取 API。"""
import json
import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LlmRequest, LlmResponse
from backend.services.llm_service import llm_service, LLMError
from backend.services.prompt_library import TODO_EXTRACTION_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/todo-extraction", tags=["todo-extraction"])


def _parse_items(raw: str) -> list[dict]:
    """Try to extract a JSON array from the LLM output."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```\w*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    try:
        items = json.loads(cleaned)
        if isinstance(items, list):
            return items
    except json.JSONDecodeError:
        pass
    m = re.search(r"\[[\s\S]*\]", raw)
    if m:
        try:
            items = json.loads(m.group(0))
            if isinstance(items, list):
                return items
        except json.JSONDecodeError:
            pass
    return []


PRIORITY_MAP = {"high": 1, "medium": 2, "low": 3, "高": 1, "中": 2, "低": 3}


@router.post("/run")
def todo_extraction_run(req: LlmRequest, db: Session = Depends(get_db)):
    try:
        result = llm_service.complete(TODO_EXTRACTION_SYSTEM, req.text)
    except LLMError as e:
        return {"code": 503, "msg": e.message, "data": None}

    items = _parse_items(result)

    normalized = []
    for item in items:
        p = item.get("priority", "medium")
        normalized.append({
            "task": item.get("task", ""),
            "owner": item.get("owner", "TBD"),
            "deadline": item.get("deadline", ""),
            "priority": PRIORITY_MAP.get(p.lower() if isinstance(p, str) else p, 2),
        })

    history_id = save_history(db, "todo-extraction", f"提取待办: {req.text[:50]}", req.text, result)

    return LlmResponse(data={"result": result, "items": normalized}, history_id=history_id)
