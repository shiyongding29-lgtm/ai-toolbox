"""数据看板 API。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta

from backend.database import get_db
from backend.models import HistoryRecord, TodoItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(db: Session = Depends(get_db)):
    """获取看板数据。"""
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())

    # 总操作数
    total_history = db.query(func.count(HistoryRecord.id)).scalar() or 0

    # 今日操作数
    today_count = db.query(func.count(HistoryRecord.id)).filter(
        HistoryRecord.created_at >= today_start
    ).scalar() or 0

    # 本周各工具使用次数
    weekly_raw = db.query(
        HistoryRecord.tool_type, func.count(HistoryRecord.id).label("count")
    ).filter(
        HistoryRecord.created_at >= week_start
    ).group_by(HistoryRecord.tool_type).order_by(func.count(HistoryRecord.id).desc()).all()
    weekly_counts = [{"tool_type": r[0], "count": r[1]} for r in weekly_raw]

    # 待办统计
    todo_total = db.query(func.count(TodoItem.id)).scalar() or 0
    todo_completed = db.query(func.count(TodoItem.id)).filter(TodoItem.completed == True).scalar() or 0
    todo_active = todo_total - todo_completed

    month_key = now.strftime("%Y-%m")
    overdue_raw = db.query(func.count(TodoItem.id)).filter(
        TodoItem.completed == False,
        TodoItem.deadline != "",
        TodoItem.deadline != None,
        TodoItem.deadline < now.strftime("%Y-%m-%d"),
    ).scalar() or 0

    # 最近活动
    recent = db.query(HistoryRecord).order_by(
        HistoryRecord.created_at.desc()
    ).limit(10).all()
    recent_activity = [{
        "tool_type": r.tool_type,
        "title": r.title,
        "created_at": r.created_at.strftime("%m-%d %H:%M") if r.created_at else "",
    } for r in recent]

    return {
        "code": 0,
        "msg": "ok",
        "data": {
            "total_history": total_history,
            "today_count": today_count,
            "weekly_counts": weekly_counts,
            "todo_stats": {
                "total": todo_total,
                "completed": todo_completed,
                "active": todo_active,
                "overdue": overdue_raw,
            },
            "recent_activity": recent_activity,
        },
    }
