"""
转写 Job 管理器 — 后台异步执行转写 + 摘要，避免 HTTP 超时。

Job 状态流转: PENDING → TRANSCRIBING_SYSTEM → TRANSCRIBING_MIC → MERGING → SUMMARIZING → DONE / FAILED
"""

import threading
import uuid
import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    TRANSCRIBING_SYSTEM = "transcribing_system"
    TRANSCRIBING_MIC = "transcribing_mic"
    MERGING = "merging"
    SUMMARIZING = "summarizing"
    DONE = "done"
    FAILED = "failed"


class TranscriptionJob:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = JobStatus.PENDING
        self.progress = 0.0
        self.status_message = ""
        self.transcript = ""
        self.summary = ""
        self.summary_error = ""
        self.duration = 0.0
        self.meeting_id = 0
        self.audio_url = ""
        self.history_id = 0
        self.error = ""
        self.created_at = datetime.datetime.now().isoformat()


_jobs: dict[str, TranscriptionJob] = {}
_lock = threading.Lock()


def create_job() -> TranscriptionJob:
    job_id = uuid.uuid4().hex[:12]
    job = TranscriptionJob(job_id=job_id)
    with _lock:
        _jobs[job_id] = job
    return job


def get_job(job_id: str) -> Optional[TranscriptionJob]:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **kwargs):
    with _lock:
        job = _jobs.get(job_id)
        if job:
            for key, value in kwargs.items():
                setattr(job, key, value)


def run_transcription_job(
    job_id: str,
    system_wav: str,
    mic_wav: str,
    duration: float,
    prefix: str,
    output_dir: str,
    mode: str,
    db_session_factory,
):
    """
    后台线程：转写 → 摘要 → 保存数据库。
    通过 update_job() 更新进度，前端通过 /transcription-status 轮询。
    """

    def _progress(status: JobStatus, message: str, progress: float):
        update_job(job_id, status=status, status_message=message, progress=progress)

    try:
        from backend.services.audio_service import transcribe_dual as _transcribe_dual
        from backend.services.llm_service import llm_service
        from backend.services.prompt_library import MEETING_SUMMARY_SYSTEM, TODO_EXTRACTION_SYSTEM
        from backend.routers.history import save_history
        from backend.models import MeetingRecord, TodoItem
        import re, json, datetime as dt

        _progress(JobStatus.TRANSCRIBING_SYSTEM, "正在转写系统音频...", 0.1)
        transcript = _transcribe_dual(system_wav, mic_wav)
        update_job(job_id, transcript=transcript, duration=duration)
        _progress(JobStatus.MERGING, "转写完成，正在生成摘要...", 0.7)

        summary = ""
        summary_error = None
        try:
            summary = llm_service.complete(MEETING_SUMMARY_SYSTEM, transcript)
        except Exception as e:
            summary_error = str(e)

        _progress(JobStatus.SUMMARIZING, "摘要完成，正在保存...", 0.9)

        # 保存数据库
        db = db_session_factory()
        try:
            audio_filename = f"{prefix}_system.wav"
            audio_url = f"/uploads/meetings/{audio_filename}"

            history_id = save_history(
                db, "meeting-recorder",
                f"线上会议: {prefix}",
                transcript[:500], summary or summary_error or "",
            )

            record = MeetingRecord(
                history_id=history_id,
                transcript=transcript,
                summary=summary or "",
                duration_seconds=int(duration),
                mode=mode,
                audio_path=audio_url,
                created_at=datetime.datetime.now(),
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            update_job(
                job_id,
                status=JobStatus.DONE,
                progress=1.0,
                status_message="完成",
                summary=summary or "",
                summary_error=summary_error or "",
                meeting_id=record.id,
                audio_url=audio_url,
                history_id=history_id,
            )

            # 提取待办事项
            _parse_todos_from_summary(db, summary or "", record.id)

        finally:
            db.close()

    except Exception as e:
        update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=0.0,
            status_message="转写失败",
            error=str(e),
        )


def _parse_todos_from_summary(db, summary: str, meeting_id: int):
    """从会议摘要的行动项表格中提取待办事项。"""
    if not summary:
        return
    # 匹配 Action Items / 行动项 表格行: | # | Task | Owner | Deadline |
    p = re.compile(r'\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|')
    month_key = dt.date.today().strftime("%Y-%m")
    for m in p.finditer(summary):
        task = m.group(2).strip()
        owner = m.group(3).strip()
        deadline = m.group(4).strip()
        if task and task.lower() not in ('task', '任务', 'owner', 'deadline', '-'):
            if owner in ('TBD', 'N/A', ''):
                owner = '待定'
            if deadline in ('unspecified', 'N/A', '', '-', '未指定'):
                deadline = '待定'
            exists = db.query(TodoItem).filter(
                TodoItem.task == task, TodoItem.source_id == meeting_id
            ).first()
            if not exists:
                t = TodoItem(task=task, owner=owner, deadline=deadline,
                             priority=2, source='meeting', source_id=meeting_id,
                             month_key=month_key)
                db.add(t)
    db.commit()


def start_transcription_thread(
    job_id: str,
    system_wav: str,
    mic_wav: str,
    duration: float,
    prefix: str,
    output_dir: str,
    mode: str,
    db_session_factory,
):
    """启动后台转写线程。"""
    t = threading.Thread(
        target=run_transcription_job,
        args=(job_id, system_wav, mic_wav, duration, prefix, output_dir, mode, db_session_factory),
        daemon=True,
    )
    t.start()
    return t
