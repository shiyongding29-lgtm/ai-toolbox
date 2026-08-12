"""
Whisper 模型单例服务 — 所有模块共享同一个模型实例，避免重复加载浪费内存。
"""

import threading
from typing import Optional

from faster_whisper import WhisperModel

from backend.config import config

_model: Optional[WhisperModel] = None
_lock = threading.Lock()


def get_whisper_model() -> WhisperModel:
    """线程安全地获取全局唯一的 WhisperModel 实例。"""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                print(f"加载 Whisper 模型: {config.whisper_model} ({config.whisper_compute_type}) ...")
                _model = WhisperModel(
                    config.whisper_model,
                    device="cpu",
                    compute_type=config.whisper_compute_type,
                )
                print("Whisper 模型就绪。")
    return _model
