"""深度调研 Agent API — 多步骤管道：搜索→抓取→分析→报告。"""
import json, threading
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.llm_service import llm_service
from backend.services.agent_orchestrator import orchestrator
from backend.services.web_search_service import web_search
from backend.services.prompt_library import (
    DEEP_RESEARCH_PLAN_SYSTEM, DEEP_RESEARCH_ANALYZE_SYSTEM, DEEP_RESEARCH_REPORT_SYSTEM
)
from backend.routers.history import save_history

router = APIRouter(prefix="/api/deep-research", tags=["deep-research"])


@router.post("/research")
async def deep_research_run(req: dict, db: Session = Depends(get_db)):
    """执行深度调研。输入 {"topic": "..."}"""
    topic = req.get("topic", "")
    if not topic:
        return {"code": 400, "msg": "缺少 topic", "data": None}

    # Step 1: 搜索
    results = web_search.search(topic, num_results=5)
    if not results:
        return {"code": 500, "msg": "搜索无结果", "data": None}

    # Step 2: 抓取每个结果
    sources_text = []
    for i, r in enumerate(results, 1):
        page_text = web_search.fetch_page(r["url"])
        sources_text.append(f"=== Source {i}: {r['title']} ===\n{page_text[:5000]}")

    all_sources = "\n\n".join(sources_text)

    # Step 3: LLM 分析
    analysis = llm_service.complete(DEEP_RESEARCH_ANALYZE_SYSTEM, f"Topic: {topic}\n\nSources:\n{all_sources}")

    # Step 4: LLM 生成报告
    report = llm_service.complete(DEEP_RESEARCH_REPORT_SYSTEM, f"Topic: {topic}\n\nAnalysis:\n{analysis}")

    history_id = save_history(db, "deep-research", f"调研: {topic[:50]}", topic, report)

    return {
        "code": 0, "msg": "ok",
        "data": {
            "topic": topic,
            "sources": [{"title": r["title"], "url": r["url"]} for r in results],
            "report": report,
        },
        "history_id": history_id,
    }
