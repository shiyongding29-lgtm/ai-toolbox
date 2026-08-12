"""
统一历史记录 API — 所有工具模块共用。
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import HistoryRecord
from backend.schemas import HistoryItem, HistoryListResponse

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/list")
async def list_history(
    tool_type: str | None = Query(None, description="按工具类型过滤"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """获取历史记录列表。"""
    query = db.query(HistoryRecord)

    if tool_type:
        query = query.filter(HistoryRecord.tool_type == tool_type)

    total = query.count()
    items = (
        query.order_by(desc(HistoryRecord.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    data = [
        HistoryItem(
            id=item.id,
            tool_type=item.tool_type,
            title=item.title,
            input_preview=item.input_preview,
            output_preview=item.output_preview,
            created_at=item.created_at.strftime("%Y-%m-%d %H:%M"),
        )
        for item in items
    ]

    return HistoryListResponse(total=total, data=data)


@router.get("/{history_id}")
async def get_history(history_id: int, db: Session = Depends(get_db)):
    """获取单条历史记录详情。"""
    item = db.query(HistoryRecord).filter(HistoryRecord.id == history_id).first()
    if not item:
        return {"code": 404, "msg": "记录不存在", "data": None}
    return {
        "code": 0,
        "msg": "ok",
        "data": {
            "id": item.id,
            "tool_type": item.tool_type,
            "title": item.title,
            "full_output": item.full_output,
            "created_at": item.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    }


@router.delete("/{history_id}")
async def delete_history(history_id: int, db: Session = Depends(get_db)):
    """删除历史记录。"""
    item = db.query(HistoryRecord).filter(HistoryRecord.id == history_id).first()
    if not item:
        return {"code": 404, "msg": "记录不存在"}
    db.delete(item)
    db.commit()
    return {"code": 0, "msg": "已删除"}


def save_history(
    db: Session,
    tool_type: str,
    title: str,
    input_text: str,
    output_text: str,
    metadata_json: str | None = None,
) -> int:
    """保存历史记录（供其他 router 调用的辅助函数）。"""
    record = HistoryRecord(
        tool_type=tool_type,
        title=title,
        input_preview=input_text[:200] if input_text else None,
        output_preview=output_text[:200] if output_text else None,
        full_output=output_text,
        metadata_json=metadata_json,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.id
