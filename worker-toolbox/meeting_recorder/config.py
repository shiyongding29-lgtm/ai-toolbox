"""
Meeting Recorder — 全局配置
可通过环境变量覆盖的常量集中管理。
"""

import os

# ── 音频采样配置 ──
SAMPLE_RATE = 48000          # BlackHole 和 Mac 麦克风都是 48kHz
CHANNELS_SYSTEM = 2          # BlackHole 2ch 立体声
CHANNELS_MIC = 1             # 内建麦克风单声道
BLOCK_SIZE = 1024            # 每次回调读取的帧数

# ── 设备查找关键词 ──
BLACKHOLE_DEVICE_KEYWORD = "BlackHole 2ch"
MIC_DEVICE_KEYWORD = "MacBook Air"

# ── Whisper 模型配置 ──
WHISPER_MODEL = "small"            # tiny / small / medium / large-v3
WHISPER_COMPUTE_TYPE = "int8"      # CPU 上用 int8 最快
WHISPER_LANGUAGE = None            # None = 自动检测语言
WHISPER_VAD_FILTER = True          # 过滤静音段

# ── LLM API 配置 ──
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "deepseek-chat")
CLAUDE_MAX_TOKENS = int(os.environ.get("CLAUDE_MAX_TOKENS", "4096"))
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ── 输出目录 ──
OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "meeting_notes"
)

# ── 说话人分离配置 ──
DIARIZATION_ENABLED = os.environ.get("DIARIZATION_ENABLED", "1") == "1"
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# ── 长文本分段阈值 ──
MAX_CHARS_PER_CHUNK = 80000   # 超过此长度自动分段摘要
CHUNK_OVERLAP = 500            # 分段间重叠字符数
