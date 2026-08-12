"""
工具函数：设备查找、文件命名、输出目录管理等。
"""

import os
import datetime
from typing import Optional

import sounddevice as sd


class DeviceNotFoundError(Exception):
    """未找到指定音频设备。"""
    pass


class ConfigError(Exception):
    """配置错误（如缺少 API key）。"""
    pass


def list_audio_devices() -> str:
    """列出系统所有音频设备，用于调试。"""
    lines = []
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        in_ch = dev["max_input_channels"]
        out_ch = dev["max_output_channels"]
        lines.append(f"  [{i}] {dev['name']}  (in={in_ch}, out={out_ch})")
    return "\n".join(lines)


def find_audio_device(keyword: str, kind: str = "input") -> int:
    """
    通过关键词模糊匹配音频设备 ID。

    Args:
        keyword: 设备名称中包含的关键词（英文或中文）。
        kind: "input" 或 "output"，要求设备有对应通道。

    Returns:
        设备索引（int）。

    Raises:
        DeviceNotFoundError: 未找到匹配设备。
    """
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        ch_key = f"max_{kind}_channels"
        if dev.get(ch_key, 0) > 0 and keyword.lower() in dev["name"].lower():
            return i

    # 未找到，抛出带设备列表的异常
    raise DeviceNotFoundError(
        f"未找到包含 '{keyword}' 的{kind}设备。\n"
        f"可用设备：\n{list_audio_devices()}"
    )


def generate_filename() -> str:
    """生成基于当前时间的文件名前缀。"""
    now = datetime.datetime.now()
    return now.strftime("%Y-%m-%d_%H%M%S")


def ensure_output_dir(output_dir: str) -> None:
    """确保输出目录存在，不存在则创建。"""
    os.makedirs(output_dir, exist_ok=True)


def format_duration(seconds: float) -> str:
    """将秒数格式化为 HH:MM:SS。"""
    if seconds < 0:
        seconds = 0
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def merge_transcripts(
    system_segments: list[dict],
    mic_segments: list[dict],
) -> str:
    """
    合并两路转写结果，按时间戳交错排列。

    使用段中的 speaker 字段（来自说话人分离）或 fallback 到 "系统"/"发言"。
    """
    # 给每段打标签 — 优先使用 diarization 的 speaker 标签
    tagged = []
    for seg in system_segments:
        source = seg.get("speaker", "系统")
        tagged.append({
            "start": seg.get("start", 0),
            "text": seg.get("text", "").strip(),
            "source": source,
        })
    for seg in mic_segments:
        source = seg.get("speaker", "发言")
        tagged.append({
            "start": seg.get("start", 0),
            "text": seg.get("text", "").strip(),
            "source": source,
        })

    # 按时间戳排序
    tagged.sort(key=lambda x: x["start"])

    # 合并相邻相同来源的段落（skip 空文本）
    merged = []
    for item in tagged:
        if not item["text"]:
            continue
        if merged and merged[-1]["source"] == item["source"]:
            merged[-1]["text"] += " " + item["text"]
        else:
            merged.append(item)

    lines = []
    for item in merged:
        timestamp = format_duration(item["start"])
        lines.append(f"[{timestamp}] **{item['source']}**: {item['text']}")

    return "\n\n".join(lines)


def chunk_transcript(text: str, max_chars: int = 80000, overlap: int = 500) -> list[str]:
    """
    将长文本分段，段间有重叠。

    Args:
        text: 原始文本。
        max_chars: 每段最大字符数。
        overlap: 段间重叠字符数。

    Returns:
        分段文本列表。如果文本未超长，返回单元素列表。
    """
    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        start = end - overlap
    return chunks
