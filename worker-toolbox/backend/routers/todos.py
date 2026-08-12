"""待办事项 API — 支持增删改查、优先级、截止日期、逾期排序、每月自动清历史。"""
import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import TodoItem

router = APIRouter(prefix="/api/todos", tags=["todos"])

_month_key = datetime.date.today().strftime("%Y-%m")


def _drop_old(db: Session):
    """删除上个月的待办（每月清零）。"""
    global _month_key
    current = datetime.date.today().strftime("%Y-%m")
    if current != _month_key:
        db.query(TodoItem).filter(TodoItem.month_key != current).delete()
        db.commit()
        _month_key = current


def _is_overdue(item: TodoItem) -> bool:
    """判断待办是否已逾期。"""
    if not item.deadline or item.completed:
        return False
    try:
        dl = datetime.datetime.strptime(item.deadline, "%Y-%m-%d").date()
        return dl < datetime.date.today()
    except ValueError:
        return False


def _serialize(t: TodoItem) -> dict:
    return {
        "id": t.id, "task": t.task, "owner": t.owner or "", "deadline": t.deadline or "",
        "priority": t.priority, "completed": t.completed, "source": t.source or "",
        "created_at": t.created_at.strftime("%m-%d %H:%M") if t.created_at else "",
        "is_overdue": _is_overdue(t),
    }


class TodoCreate(BaseModel):
    task: str = Field(..., min_length=1, max_length=500)
    owner: str = ""
    deadline: str = ""
    priority: int = Field(2, ge=1, le=3)
    source: str = ""
    source_id: int | None = None


class TodoUpdate(BaseModel):
    task: str | None = None
    owner: str | None = None
    deadline: str | None = None
    priority: int | None = Field(None, ge=1, le=3)
    completed: bool | None = None


@router.get("")
async def list_todos(db: Session = Depends(get_db)):
    _drop_old(db)
    items = db.query(TodoItem).filter(TodoItem.month_key == _month_key).all()
    # 逾期未完成排最前，其次按优先级 → id 倒序
    items.sort(key=lambda t: (
        not _is_overdue(t),
        t.priority,
        -t.id,
    ))
    return {"code": 0, "data": [_serialize(t) for t in items]}


@router.post("")
async def create_todo(body: TodoCreate, db: Session = Depends(get_db)):
    _drop_old(db)
    t = TodoItem(**body.model_dump(), month_key=_month_key)
    db.add(t); db.commit(); db.refresh(t)
    return {"code": 0, "data": {"id": t.id}}


@router.put("/{todo_id}")
async def update_todo(todo_id: int, body: TodoUpdate, db: Session = Depends(get_db)):
    t = db.query(TodoItem).filter(TodoItem.id == todo_id).first()
    if not t:
        return {"code": 404, "msg": "未找到"}
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    if body.completed:
        t.completed_at = datetime.datetime.now()
    elif body.completed is False:
        t.completed_at = None
    db.commit()
    return {"code": 0, "msg": "ok"}


@router.delete("/{todo_id}")
async def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    t = db.query(TodoItem).filter(TodoItem.id == todo_id).first()
    if not t:
        return {"code": 404, "msg": "未找到"}
    db.delete(t); db.commit()
    return {"code": 0, "msg": "已删除"}


@router.post("/batch-create")
async def batch_create(body: list[TodoCreate], db: Session = Depends(get_db)):
    _drop_old(db)
    ids = []
    for b in body:
        t = TodoItem(**b.model_dump(), month_key=_month_key)
        db.add(t); db.flush(); ids.append(t.id)
    db.commit()
    return {"code": 0, "data": {"ids": ids}}
