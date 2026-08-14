"""智能任务规划 API。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.llm_service import llm_service
from backend.services.prompt_library import TASK_PLANNING_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/task-planning", tags=["task-planning"])


@router.post("/plan")
def task_planning_run(req: dict, db: Session = Depends(get_db)):
    """智能任务分解。输入 {"tasks": "...", "constraints": "5天内完成"}"""
    tasks = req.get("tasks", "")
    constraints = req.get("constraints", "无")
    if not tasks:
        return {"code": 400, "msg": "缺少 tasks", "data": None}

    prompt = f"Tasks:\n{tasks}\n\nConstraints: {constraints}\n\nDecompose each task with subtasks, time estimates, and dependencies."
    result = llm_service.complete(TASK_PLANNING_SYSTEM, prompt)
    history_id = save_history(db, "task-planning", f"任务规划: {tasks[:50]}", tasks, result)

    return {"code": 0, "msg": "ok", "data": {"result": result}, "history_id": history_id}
