"""
双设备并行录音模块。

同时从 BlackHole 2ch（系统音频）和 MacBook Air 内建麦克风（人声）
录制音频，分别保存为 WAV 文件。
"""

import os
import tempfile
import wave
import threading
from typing import Optional

import numpy as np
import sounddevice as sd

from meeting_recorder.config import (
    SAMPLE_RATE,
    CHANNELS_SYSTEM,
    CHANNELS_MIC,
    BLOCK_SIZE,
)
from meeting_recorder.utils import find_audio_device, DeviceNotFoundError


class DualRecorder:
    """同时录制系统音频（BlackHole）和麦克风音频。

    长会议通过周期性 flush 缓冲区到磁盘来控制内存增长。
    """

    def __init__(self, buffer_flush_seconds: int = 60):
        self.system_device_id: int = find_audio_device("BlackHole 2ch", kind="input")
        self.mic_device_id: int = find_audio_device("MacBook Air", kind="input")

        # 内存音频缓冲区（存储 numpy float32 数组）
        self._system_buffer: list[np.ndarray] = []
        self._mic_buffer: list[np.ndarray] = []

        # 每个流用于周期性 flush 的临时文件
        self._system_temp_file: Optional[str] = None
        self._mic_temp_file: Optional[str] = None
        self._buffer_flush_frames = buffer_flush_seconds * SAMPLE_RATE

        # 流对象
        self._system_stream: Optional[sd.InputStream] = None
        self._mic_stream: Optional[sd.InputStream] = None

        # 录制时长统计
        self._system_frames: int = 0
        self._mic_frames: int = 0

        # 独立锁 — 消除两个独立缓冲区之间的不必要竞争
        self._lock_system = threading.Lock()
        self._lock_mic = threading.Lock()

        # 对于长会议进行周期性 flush
        self._handled_flush = False  # 如果任何流接近阈值则设置为 True
        self._flushed_system_frames = 0
        self._flushed_mic_frames = 0

        # ── 回调函数 ──

    def _system_callback(self, indata: np.ndarray, frames: int, time, status):
        """BlackHole 系统音频回调。"""
        if status:
            print(f"[系统音频警告] {status}")
        with self._lock_system:
            self._system_buffer.append(indata.copy())
            self._system_frames += frames
            # 如果缓冲区超过 flush 间隔则触发 flush
            if len(self._system_buffer) * BLOCK_SIZE >= self._buffer_flush_frames:
                self._handled_flush = True

    def _mic_callback(self, indata: np.ndarray, frames: int, time, status):
        """麦克风音频回调。"""
        if status:
            print(f"[麦克风警告] {status}")
        with self._lock_mic:
            self._mic_buffer.append(indata.copy())
            self._mic_frames += frames
            if len(self._mic_buffer) * BLOCK_SIZE >= self._buffer_flush_frames:
                self._handled_flush = True

    # ── 缓冲管理 ──

    def _maybe_flush_buffers(self):
        """如果任一缓冲区超过大小限制，将两个缓冲区都 flush 到临时文件。"""
        if not self._handled_flush:
            return
        self._handled_flush = False

        # Flush 系统缓冲区
        with self._lock_system:
            if self._system_buffer:
                data = np.concatenate(self._system_buffer)
                self._system_buffer.clear()
                if self._system_temp_file is None:
                    tmp = tempfile.NamedTemporaryFile(suffix=".npy", delete=False)
                    self._system_temp_file = tmp.name
                    np.save(self._system_temp_file, data)
                else:
                    existing = np.load(self._system_temp_file)
                    np.save(self._system_temp_file, np.concatenate([existing, data]))
                self._flushed_system_frames += data.shape[0]

        # Flush 麦克风缓冲区
        with self._lock_mic:
            if self._mic_buffer:
                data = np.concatenate(self._mic_buffer)
                self._mic_buffer.clear()
                if self._mic_temp_file is None:
                    tmp = tempfile.NamedTemporaryFile(suffix=".npy", delete=False)
                    self._mic_temp_file = tmp.name
                    np.save(self._mic_temp_file, data)
                else:
                    existing = np.load(self._mic_temp_file)
                    np.save(self._mic_temp_file, np.concatenate([existing, data]))
                self._flushed_mic_frames += data.shape[0]

    def _collect_audio_data(self, buffer: list[np.ndarray], temp_file: Optional[str]) -> np.ndarray:
        """将内存缓冲区与已 flush 的磁盘数据合并。"""
        mem_data = np.concatenate(buffer) if buffer else np.array([], dtype=np.float32)
        if temp_file and os.path.exists(temp_file):
            disk_data = np.load(temp_file)
            if mem_data.size > 0:
                return np.concatenate([disk_data, mem_data])
            return disk_data
        return mem_data

    def _cleanup_temp_files(self):
        """删除临时文件。"""
        for tmp in [self._system_temp_file, self._mic_temp_file]:
            if tmp and os.path.exists(tmp):
                os.unlink(tmp)
        self._system_temp_file = None
        self._mic_temp_file = None

    # ── 公共接口 ──

    @property
    def duration(self) -> float:
        """当前录制时长（秒）。"""
        return self._system_frames / SAMPLE_RATE

    @property
    def is_recording(self) -> bool:
        """是否正在录制。"""
        return (
            self._system_stream is not None
            and self._system_stream.active
            and self._mic_stream is not None
            and self._mic_stream.active
        )

    def start(self) -> None:
        """开始双设备录制。"""
        if self.is_recording:
            print("录制已在进行中。")
            return

        self._system_buffer.clear()
        self._mic_buffer.clear()
        self._system_frames = 0
        self._mic_frames = 0
        self._flushed_system_frames = 0
        self._flushed_mic_frames = 0
        self._cleanup_temp_files()
        self._handled_flush = False

        self._system_stream = sd.InputStream(
            device=self.system_device_id,
            channels=CHANNELS_SYSTEM,
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            callback=self._system_callback,
            dtype="float32",
        )
        self._mic_stream = sd.InputStream(
            device=self.mic_device_id,
            channels=CHANNELS_MIC,
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            callback=self._mic_callback,
            dtype="float32",
        )

        self._system_stream.start()
        self._mic_stream.start()
        print(f"录制已开始。")
        print(f"  系统音频: 设备 #{self.system_device_id}")
        print(f"  麦克风:   设备 #{self.mic_device_id}")
        print(f"  按 Ctrl+C 停止录制。")

    def stop(self, output_dir: str, prefix: str) -> tuple[str, str]:
        """停止录制并保存为两个 WAV 文件。

        Args:
            output_dir: 输出目录。
            prefix: 文件名前缀（如时间戳）。

        Returns:
            (system_wav_path, mic_wav_path) 两个 WAV 文件的路径。
        """
        if self._system_stream is not None:
            self._system_stream.stop()
            self._system_stream.close()
            self._system_stream = None

        if self._mic_stream is not None:
            self._mic_stream.stop()
            self._mic_stream.close()
            self._mic_stream = None

        duration = self.duration
        print(f"录制停止。总时长: {duration:.1f} 秒")

        # 最后一次 flush，然后收集所有音频数据（内存 + 磁盘）
        self._maybe_flush_buffers()

        system_data = self._collect_audio_data(self._system_buffer, self._system_temp_file)
        mic_data = self._collect_audio_data(self._mic_buffer, self._mic_temp_file)

        # 保存 WAV
        system_path = os.path.join(output_dir, f"{prefix}_system.wav")
        mic_path = os.path.join(output_dir, f"{prefix}_mic.wav")

        self._save_wav(system_path, system_data, CHANNELS_SYSTEM)
        self._save_wav(mic_path, mic_data, CHANNELS_MIC)

        print(f"  系统音频: {system_path}")
        print(f"  麦克风:   {mic_path}")

        self._cleanup_temp_files()

        return system_path, mic_path

    # ── 内部方法 ──

    @staticmethod
    def _save_wav(filepath: str, data: np.ndarray, channels: int) -> None:
        """将 numpy 数组保存为 16-bit PCM WAV 文件。"""
        if data.size == 0:
            data = np.zeros((SAMPLE_RATE, channels), dtype=np.float32)

        # float32 [-1, 1] → int16 (clip to prevent wrap-around artifacts)
        int_data = (np.clip(data, -1.0, 1.0) * 32767).astype(np.int16)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(int_data.tobytes())
