"""
ORM 数据模型。
"""

import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func

from backend.database import Base


class HistoryRecord(Base):
    """统一的历史记录表 — 所有工具模块共用。"""
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool_type = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    input_preview = Column(Text, nullable=True)
    output_preview = Column(Text, nullable=True)
    full_output = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)


class TodoItem(Base):
    """待办事项。"""
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task = Column(String(500), nullable=False)
    owner = Column(String(100), nullable=True)
    deadline = Column(String(100), nullable=True)
    priority = Column(Integer, nullable=False, default=2)
    completed = Column(Boolean, default=False)
    source = Column(String(100), nullable=True)
    source_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    month_key = Column(String(7), nullable=False, index=True)  # YYYY-MM


class MeetingRecord(Base):
    """会议记录。"""
    __tablename__ = "meeting_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("history.id"), nullable=True)
    transcript = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    mode = Column(String(20), nullable=False, default="live")
    audio_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now())


class DocumentRecord(Base):
    """上传的文档。"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("history.id"), nullable=True)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)
    extracted_text = Column(Text, nullable=True)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())


class RagDocument(Base):
    """RAG 知识库文档分块。"""
    __tablename__ = "rag_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())


class WeeklyReport(Base):
    """周报记录。"""
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("history.id"), nullable=True)
    week_start = Column(String(20), nullable=False)
    week_end = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())
