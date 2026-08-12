"""
说话人分离模块 — 使用 pyannote.audio 对系统音频进行说话人分离。

仅在系统轨上运行分离（麦克风轨始终是本地用户），利用已有的物理声道分离优势。
"""

import os
from typing import Optional


class Diarizer:
    """pyannote-audio 说话人分离器。"""

    def __init__(self, hf_token: Optional[str] = None):
        token = hf_token or os.environ.get("HF_TOKEN", "")
        if not token:
            raise ValueError(
                "HF_TOKEN 环境变量未设置。说话人分离需要 HuggingFace token。\n"
                "请访问 https://huggingface.co/pyannote/speaker-diarization-3.1 同意条款，\n"
                "然后在终端执行: export HF_TOKEN='hf_...'\n"
                "或使用 --no-diarization 跳过说话人分离。"
            )
        from pyannote.audio import Pipeline
        print("加载 pyannote 说话人分离模型...")
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token,
        )
        print("说话人分离模型就绪。")

    def diarize(self, wav_path: str) -> list[dict]:
        """
        对音频文件运行说话人分离。

        Returns:
            [{start, end, speaker}, ...]
        """
        diarization = self.pipeline(wav_path)
        results = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            results.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
            })
        return results

    def assign_speakers(
        self,
        segments: list[dict],
        diarization: list[dict],
    ) -> list[dict]:
        """
        按时间重叠为转写段分配说话人标签。
        每段取重叠最多的说话人。
        """
        import numpy as np

        for seg in segments:
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", seg_start + 5)  # 默认 5s 窗口
            seg_mid = (seg_start + seg_end) / 2

            best_speaker = None
            best_overlap = 0

            for turn in diarization:
                overlap_start = max(seg_start, turn["start"])
                overlap_end = min(seg_end, turn["end"])
                overlap = max(0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = turn["speaker"]

            if best_speaker:
                seg["speaker"] = best_speaker
            else:
                # 无匹配时用最近的时间点
                nearest = min(
                    diarization,
                    key=lambda t: abs(t["start"] - seg_mid),
                    default=None,
                )
                if nearest:
                    seg["speaker"] = nearest["speaker"]

        return segments
