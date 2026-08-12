"""
全局配置 — 所有可配置项通过环境变量覆盖。
"""

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    # ── LLM ──
    llm_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "deepseek-chat"))
    llm_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    llm_base_url: str = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL", ""))
    llm_max_tokens: int = int(os.getenv("CLAUDE_MAX_TOKENS", "4096"))
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))

    # ── 数据库 ──
    db_url: str = field(default_factory=lambda: f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'toolbox.db')}")

    # ── 文件存储 ──
    upload_dir: str = field(default_factory=lambda: os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "uploads"
    ))

    # ── Whisper ──
    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    # ── RAG ──
    knowledge_base_dir: str = field(default_factory=lambda: os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "knowledge_base"
    ))
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-zh-v1.5")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "5"))


# 全局单例
config = Config()
