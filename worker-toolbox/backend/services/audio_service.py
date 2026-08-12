"""
音频转写服务 — 使用 faster-whisper 进行语音转文字。
"""

from typing import Optional

from backend.config import config
from backend.services.whisper_service import get_whisper_model


def transcribe_audio(file_path: str) -> list[dict]:
    """转写音频文件，返回段落列表。"""
    model = get_whisper_model()
    segments, info = model.transcribe(
        file_path,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            threshold=0.3,
            min_speech_duration_ms=250,
            min_silence_duration_ms=100,
        ),
    )
    detected_lang = info.language if info else "unknown"
    results = [
        {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
        for seg in segments
    ]
    return results


def segments_to_text(segments: list[dict]) -> str:
    """将转写段落列表转换为带时间戳的文本。"""
    lines = []
    for seg in segments:
        ts = f"{int(seg['start'] // 60):02d}:{int(seg['start'] % 60):02d}"
        lines.append(f"[{ts}] {seg['text']}")
    return "\n\n".join(lines)


def transcribe_dual(system_wav: str, mic_wav: str) -> str:
    """
    分别转写系统音频和麦克风音频，使用统一的 merge_transcripts 合并。
    """
    from meeting_recorder.utils import merge_transcripts

    print("转写系统音频（BlackHole）...")
    system_segments = transcribe_audio(system_wav)
    print(f"  系统音频: {len(system_segments)} 段")

    print("转写麦克风音频...")
    mic_segments = transcribe_audio(mic_wav)
    print(f"  麦克风:   {len(mic_segments)} 段")

    return merge_transcripts(system_segments, mic_segments)
