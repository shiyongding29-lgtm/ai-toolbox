"""
Pydantic 请求/响应模型。
"""

from pydantic import BaseModel, Field
from typing import Optional
import datetime


# ── 通用 ──
class ApiResponse(BaseModel):
    code: int = 0
    msg: str = "ok"
    data: Optional[dict] = None


class PaginatedResponse(BaseModel):
    code: int = 0
    msg: str = "ok"
    data: dict = {}
    total: int = 0
    page: int = 1
    page_size: int = 20


# ── History ──
class HistoryItem(BaseModel):
    id: int
    tool_type: str
    title: str
    input_preview: Optional[str] = None
    output_preview: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    code: int = 0
    msg: str = "ok"
    data: list[HistoryItem] = []
    total: int = 0


# ── LLM 通用请求 ──
class LlmRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=100000)
    mode: Optional[str] = None       # 子模式（如翻译的 zh->en / en->zh）
    extra_context: Optional[str] = None


class LlmResponse(BaseModel):
    code: int = 0
    msg: str = "ok"
    data: dict = {}
    history_id: Optional[int] = None


# ── 文档 ──
class DocumentSummaryRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    file_id: Optional[int] = None


# ── 会议记录 ──
class MeetingSummarizeRequest(BaseModel):
    transcript: str = Field(..., min_length=1)


class MeetingSummarizeResponse(BaseModel):
    code: int = 0
    msg: str = "ok"
    data: dict = {}
