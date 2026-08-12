"""
Whisper 语音转写模块。

使用 faster-whisper（CTranslate2 后端）进行本地语音识别，
支持 VAD 过滤静音，可分别转写系统音频和麦克风音频后合并。
支持可选的说话人分离。
"""

from typing import Optional

from faster_whisper import WhisperModel

from meeting_recorder.config import (
    WHISPER_MODEL,
    WHISPER_COMPUTE_TYPE,
    WHISPER_LANGUAGE,
    WHISPER_VAD_FILTER,
    DIARIZATION_ENABLED,
)
from meeting_recorder.utils import merge_transcripts


class Transcriber:
    """faster-whisper 转写器。"""

    def __init__(
        self,
        model_size: str = WHISPER_MODEL,
        compute_type: str = WHISPER_COMPUTE_TYPE,
        diarizer: Optional["Diarizer"] = None,
    ):
        print(f"加载 Whisper 模型: {model_size} ({compute_type}) ...")
        self.model = WhisperModel(
            model_size,
            device="cpu",
            compute_type=compute_type,
        )
        self.diarizer = diarizer
        print("模型就绪。")

    def transcribe(self, audio_path: str) -> list[dict]:
        """
        转写单个音频文件。

        Args:
            audio_path: WAV 文件路径。

        Returns:
            转写段落列表，每段包含 start, end, text。
        """
        segments, info = self.model.transcribe(
            audio_path,
            beam_size=5,
            language=WHISPER_LANGUAGE,
            vad_filter=WHISPER_VAD_FILTER,
        )

        detected_lang = info.language if info else "unknown"
        print(f"  检测到语言: {detected_lang}")

        results = []
        for seg in segments:
            results.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })

        return results

    def transcribe_dual(
        self,
        system_wav: str,
        mic_wav: str,
        diarize: bool = False,
    ) -> str:
        """
        转写系统音频和麦克风音频，合并为带标签的会议转写稿。

        Args:
            system_wav: 系统音频 WAV 文件路径。
            mic_wav: 麦克风音频 WAV 文件路径。
            diarize: 是否对系统音频启用说话人分离。

        Returns:
            格式化的会议转写稿文本。
        """
        print("转写系统音频（BlackHole）...")
        system_segments = self.transcribe(system_wav)
        print(f"  系统音频: {len(system_segments)} 段")

        print("转写麦克风音频...")
        mic_segments = self.transcribe(mic_wav)
        print(f"  麦克风:   {len(mic_segments)} 段")

        # 可选：对系统音频进行说话人分离
        if diarize and self.diarizer:
            try:
                print("运行说话人分离（系统音频）...")
                diarization = self.diarizer.diarize(system_wav)
                self.diarizer.assign_speakers(system_segments, diarization)
                print(f"  检测到 {len(set(d['speaker'] for d in diarization))} 个远场说话人")
            except Exception as e:
                print(f"  说话人分离失败: {e}，继续使用默认标签")

        # 麦克风轨永远是本地用户
        for seg in mic_segments:
            seg["speaker"] = "Speaker: User"

        return merge_transcripts(system_segments, mic_segments)


def segments_to_text(segments: list[dict]) -> str:
    """将转写段落列表转换为纯文本。"""
    return "\n".join(
        f"[{seg['start']:.1f}s] {seg['text']}" for seg in segments
    )
