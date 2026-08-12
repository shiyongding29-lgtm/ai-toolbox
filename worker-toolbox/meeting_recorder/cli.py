#!/usr/bin/env python3
"""
Meeting Recorder CLI — 本地 AI 会议记录工具。

用法:
    python cli.py start          开始录制（Ctrl+C 停止并自动生成纪要）
    python cli.py stop           停止录制并生成纪要
    python cli.py status         查看录制状态
    python cli.py summarize FILE 对已有转写稿重新生成摘要
"""

import argparse
import os
import signal
import sys
import time

from meeting_recorder.config import OUTPUT_DIR, DIARIZATION_ENABLED
from meeting_recorder.utils import (
    generate_filename,
    ensure_output_dir,
    format_duration,
    ConfigError,
    DeviceNotFoundError,
    list_audio_devices,
)
from meeting_recorder.recorder import DualRecorder
from meeting_recorder.transcriber import Transcriber, segments_to_text
from meeting_recorder.summarizer import Summarizer

# ── 全局状态（供信号处理）──
_recorder: DualRecorder | None = None
_output_dir: str = OUTPUT_DIR
_prefix: str = ""
_no_diarization: bool = False


def handle_signal(signum, frame):
    """Ctrl+C 信号处理：停止录制并生成纪要。"""
    print("\n收到停止信号...")
    if _recorder and _recorder.is_recording:
        _finish_recording(_recorder, _output_dir, _prefix, _no_diarization)
    sys.exit(0)


def _finish_recording(recorder: DualRecorder, output_dir: str, prefix: str, no_diarization: bool = False) -> None:
    """停止录制、转写、摘要的完整流程。"""
    # Step 1: 停止录制，保存 WAV
    system_wav, mic_wav = recorder.stop(output_dir, prefix)
    duration = recorder.duration

    if duration < 1.0:
        print("警告: 录制时长不足 1 秒，跳过转写和摘要。")
        return

    # Step 2: 转写
    print("\n" + "=" * 50)
    print("开始转写（Whisper 本地模型）...")
    print("=" * 50)

    # 说话人分离（可选）
    diarizer = None
    if not no_diarization and DIARIZATION_ENABLED:
        try:
            from meeting_recorder.diarizer import Diarizer
            diarizer = Diarizer()
        except Exception as e:
            print(f"说话人分离初始化失败: {e}，跳过分离。")

    try:
        transcriber = Transcriber(diarizer=diarizer)
        merged = transcriber.transcribe_dual(system_wav, mic_wav, diarize=diarizer is not None)
    except Exception as e:
        print(f"转写失败: {e}")
        return

    # 保存转写稿
    transcript_path = os.path.join(output_dir, f"{prefix}_transcript.txt")
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(merged)
    print(f"\n转写稿已保存: {transcript_path}")

    # Step 3: 摘要
    print("\n" + "=" * 50)
    print("开始生成会议摘要（Claude API）...")
    print("=" * 50)
    try:
        summarizer = Summarizer()
        summary = summarizer.summarize(merged)
    except ConfigError as e:
        print(f"配置错误: {e}")
        print("跳过摘要生成。转写稿已保存，可稍后用 'summarize' 命令重新生成。")
        return
    except Exception as e:
        print(f"摘要生成失败: {e}")
        print("转写稿已保存，可稍后用 'summarize' 命令重新生成。")
        return

    # 保存摘要
    summary_path = os.path.join(output_dir, f"{prefix}_summary.md")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary)
    print(f"\n会议纪要已保存: {summary_path}")

    # 清理临时 WAV 文件
    for tmp in [system_wav, mic_wav]:
        try:
            os.remove(tmp)
        except OSError:
            pass

    print("\n✅ 完成！")


def cmd_start(args):
    """start 子命令。"""
    global _recorder, _output_dir, _prefix, _no_diarization

    ensure_output_dir(OUTPUT_DIR)
    _output_dir = OUTPUT_DIR
    _prefix = generate_filename()
    _no_diarization = args.no_diarization

    try:
        _recorder = DualRecorder()
    except DeviceNotFoundError as e:
        print(f"设备错误: {e}")
        sys.exit(1)

    # 注册信号处理
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    _recorder.start()

    # 持续显示录制时长
    try:
        while _recorder.is_recording:
            dur = _recorder.duration
            print(f"\r  录制中... {format_duration(dur)}", end="", flush=True)
            time.sleep(1)
    except KeyboardInterrupt:
        pass

    if _recorder.is_recording:
        _finish_recording(_recorder, _output_dir, _prefix, _no_diarization)


def cmd_stop(_args):
    """stop 子命令：查找正在运行的录制进程并停止。"""
    # 简化实现：stop 只能在同一进程中通过 Ctrl+C 触发
    # 这里作为独立命令，直接尝试停止全局 recorder（如果有）
    global _recorder
    if _recorder and _recorder.is_recording:
        _finish_recording(_recorder, _output_dir, _prefix)
    else:
        print("没有正在进行的录制。使用 'start' 开始录制。")


def cmd_status(_args):
    """status 子命令。"""
    global _recorder
    if _recorder and _recorder.is_recording:
        dur = _recorder.duration
        print(f"状态: 录制中 | 时长: {format_duration(dur)}")
    else:
        print("状态: 未在录制。")

    # 列出最近的输出文件
    ensure_output_dir(OUTPUT_DIR)
    files = sorted(
        [f for f in os.listdir(OUTPUT_DIR) if f.endswith((".txt", ".md"))],
        reverse=True,
    )
    if files:
        print(f"\n最近的输出文件 ({OUTPUT_DIR}):")
        for f in files[:5]:
            print(f"  {f}")


def cmd_summarize(args):
    """summarize 子命令：对已有转写稿重新生成摘要。"""
    transcript_path = args.transcript_file
    if not os.path.exists(transcript_path):
        print(f"文件不存在: {transcript_path}")
        sys.exit(1)

    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript = f.read()

    print(f"读取转写稿: {transcript_path} ({len(transcript)} 字符)")
    try:
        summarizer = Summarizer()
    except ConfigError as e:
        print(f"配置错误: {e}")
        sys.exit(1)

    summary = summarizer.summarize(transcript)

    summary_path = transcript_path.replace("_transcript.txt", "_summary.md")
    # 如果文件名不匹配，用新路径
    if summary_path == transcript_path:
        summary_path = transcript_path + "_summary.md"

    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary)
    print(f"会议纪要已保存: {summary_path}")


def cmd_devices(_args):
    """devices 子命令：列出所有音频设备。"""
    print("可用音频设备：")
    print(list_audio_devices())


def main():
    parser = argparse.ArgumentParser(
        description="Meeting Recorder — 本地 AI 会议记录工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # start
    start_parser = subparsers.add_parser("start", help="开始录制（Ctrl+C 停止）")
    start_parser.add_argument("--no-diarization", action="store_true", help="跳过说话人分离")

    # stop
    subparsers.add_parser("stop", help="停止录制并生成纪要")

    # status
    subparsers.add_parser("status", help="查看录制状态")

    # summarize
    summarize_parser = subparsers.add_parser("summarize", help="对已有转写稿重新生成摘要")
    summarize_parser.add_argument("transcript_file", help="转写稿文件路径")

    # devices
    subparsers.add_parser("devices", help="列出可用音频设备")

    args = parser.parse_args()

    match args.command:
        case "start":
            cmd_start(args)
        case "stop":
            cmd_stop(args)
        case "status":
            cmd_status(args)
        case "summarize":
            cmd_summarize(args)
        case "devices":
            cmd_devices(args)
        case _:
            parser.print_help()


if __name__ == "__main__":
    main()
