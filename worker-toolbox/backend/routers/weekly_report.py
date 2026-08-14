"""周工作报告 API — 支持自动生成和历史查看。"""
import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.schemas import LlmRequest, LlmResponse, ApiResponse
from backend.services.llm_service import llm_service
from backend.services.prompt_library import WEEKLY_REPORT_SYSTEM
from backend.routers.history import save_history
from backend.models import HistoryRecord, TodoItem, WeeklyReport

router = APIRouter(prefix="/api/weekly-report", tags=["weekly-report"])


def _get_week_range(offset: int = 0):
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday()) + datetime.timedelta(weeks=offset)
    sunday = monday + datetime.timedelta(days=6)
    return monday, sunday


def _build_weekly_data(db: Session, week_start: str, week_end: str) -> str:
    """汇总本周所有历史记录和待办事项为 LLM 输入文本。"""
    parts = [f"## 本周 ({week_start} ~ {week_end}) 工作数据\n"]

    # 历史记录
    recs = db.query(HistoryRecord).filter(
        HistoryRecord.created_at >= week_start,
        HistoryRecord.created_at < (datetime.datetime.strptime(week_end, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    ).order_by(desc(HistoryRecord.created_at)).all()

    if recs:
        parts.append("### 本周工具使用记录")
        for r in recs:
            parts.append(f"- [{r.tool_type}] {r.title}")
    else:
        parts.append("本周暂无工具使用记录。")

    # 会议记录
    from backend.models import MeetingRecord
    meetings = db.query(MeetingRecord).filter(
        MeetingRecord.created_at >= week_start,
        MeetingRecord.created_at < (datetime.datetime.strptime(week_end, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    ).all()
    if meetings:
        parts.append("\n### 本周会议")
        for m in meetings:
            parts.append(f"- {m.created_at.strftime('%m/%d')} ({m.duration_seconds//60}分钟): {m.summary[:200] if m.summary else m.transcript[:200]}")

    # 待办事项
    month_key = datetime.date.today().strftime("%Y-%m")
    todos = db.query(TodoItem).filter(TodoItem.month_key == month_key).all()
    if todos:
        parts.append("\n### 待办事项")
        for t in todos:
            status = "✓" if t.completed else "○"
            parts.append(f"- [{status}] P{t.priority} {t.task}")
        done = sum(1 for t in todos if t.completed)
        parts.append(f"\n已完成 {done}/{len(todos)}")

    return "\n".join(parts)


@router.post("/run")
def weekly_report_run(req: LlmRequest, db: Session = Depends(get_db)):
    result = llm_service.complete(WEEKLY_REPORT_SYSTEM, req.text)
    history_id = save_history(db, "weekly-report", f"周报: {req.text[:50]}", req.text, result)

    # 保存到 WeeklyReport 表
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    sunday = monday + datetime.timedelta(days=6)
    report = WeeklyReport(
        history_id=history_id,
        week_start=monday.strftime("%Y-%m-%d"),
        week_end=sunday.strftime("%Y-%m-%d"),
        content=result,
    )
    db.add(report)
    db.commit()

    return LlmResponse(data={"result": result}, history_id=history_id)


@router.post("/auto")
def auto_generate_weekly(db: Session = Depends(get_db)):
    """基于本周历史记录和待办事项自动生成周报。"""
    monday, sunday = _get_week_range(0)
    week_start = monday.strftime("%Y-%m-%d")
    week_end = sunday.strftime("%Y-%m-%d")

    data = _build_weekly_data(db, week_start, week_end)
    prompt = f"""基于以下本周工作数据，生成一份专业的周工作报告。

{data}

请按以下格式输出：
## {week_start} ~ {week_end} 周工作报告
### 本周完成工作
### 下周计划
### 问题与风险
### 待办事项状态
### 总结"""

    result = llm_service.complete(WEEKLY_REPORT_SYSTEM, prompt)
    history_id = save_history(db, "weekly-report", f"自动周报: {week_start}~{week_end}", "", result)

    report = WeeklyReport(week_start=week_start, week_end=week_end, content=result, history_id=history_id)
    db.add(report)
    db.commit()

    return LlmResponse(data={"result": result, "week_start": week_start, "week_end": week_end}, history_id=history_id)


@router.get("/list")
def list_weekly_reports(db: Session = Depends(get_db)):
    """获取历史周报列表。"""
    reports = db.query(WeeklyReport).order_by(desc(WeeklyReport.created_at)).limit(20).all()
    return {
        "code": 0,
        "data": [{
            "id": r.id,
            "week_start": r.week_start,
            "week_end": r.week_end,
            "content": r.content,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        } for r in reports],
    }
