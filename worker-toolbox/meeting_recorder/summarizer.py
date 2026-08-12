"""
LLM 摘要模块。

支持两种 API 格式：
- OpenAI 兼容 API（通过 OPENAI_API_KEY / OPENAI_BASE_URL）
- Anthropic 兼容 API（当 base_url 包含 "anthropic" 时自动切换）
"""

import os

from anthropic.types import TextBlock

from meeting_recorder.prompts import (
    MEETING_SUMMARY_SYSTEM_PROMPT,
    CHUNK_SUMMARY_PROMPT,
    MERGE_SUMMARIES_PROMPT,
)
from meeting_recorder.utils import chunk_transcript, ConfigError


def _extract_text(content) -> str:
    """从 Anthropic content 列表中提取文本，跳过 ThinkingBlock。"""
    for block in content:
        if isinstance(block, TextBlock):
            return block.text
    # 如果全是 thinking 没有 text（极少见），返回空
    return ""


class Summarizer:
    """使用 LLM API 生成会议摘要，自动适配 OpenAI / Anthropic 格式。"""

    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY", "")
        self.base_url = os.environ.get("OPENAI_BASE_URL", "")
        self.model = os.environ.get("OPENAI_MODEL", "claude-sonnet-4-20250514")
        self.max_tokens = int(os.environ.get("CLAUDE_MAX_TOKENS", "4096"))

        if not api_key:
            raise ConfigError(
                "未设置 OPENAI_API_KEY 环境变量。\n"
                "请在终端执行: export OPENAI_API_KEY='...'"
            )

        # 根据 base_url 判断协议类型
        self._use_anthropic = "anthropic" in self.base_url.lower()

        if self._use_anthropic:
            from anthropic import Anthropic
            self.client = Anthropic(api_key=api_key, base_url=self.base_url)
            self._backend = "Anthropic"
        else:
            from openai import OpenAI
            self.client = OpenAI(api_key=api_key, base_url=self.base_url or None)
            self._backend = "OpenAI"

        print(f"LLM: {self.model} (backend: {self._backend}, base_url: {self.base_url or '默认'})")

    def summarize(self, transcript: str) -> str:
        if not transcript.strip():
            return "# 会议纪要\n\n(转写稿为空，无法生成摘要。)\n"

        if len(transcript) > 80000:
            return self._summarize_long(transcript)

        return self._summarize_single(transcript)

    def _summarize_single(self, text: str) -> str:
        print(f"发送给 LLM ({self.model})，文本长度: {len(text)} 字符 ...")

        if self._use_anthropic:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=MEETING_SUMMARY_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
            )
            return _extract_text(response.content)
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[
                    {"role": "system", "content": MEETING_SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
            )
            return response.choices[0].message.content

    def _summarize_long(self, transcript: str) -> str:
        chunks = chunk_transcript(transcript, max_chars=80000, overlap=500)
        print(f"转写稿较长 ({len(transcript)} 字符)，分为 {len(chunks)} 段处理。")

        chunk_summaries = []
        for i, chunk in enumerate(chunks, 1):
            print(f"  摘要第 {i}/{len(chunks)} 段 ({len(chunk)} 字符) ...")
            prompt = CHUNK_SUMMARY_PROMPT.format(chunk_text=chunk)

            if self._use_anthropic:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens // 2,
                    system="You are a meeting assistant. Summarize concisely.",
                    messages=[{"role": "user", "content": prompt}],
                )
                text = _extract_text(response.content)
            else:
                response = self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=self.max_tokens // 2,
                    messages=[
                        {"role": "system", "content": "You are a meeting assistant. Summarize concisely."},
                        {"role": "user", "content": prompt},
                    ],
                )
                text = response.choices[0].message.content

            chunk_summaries.append(f"## 第 {i} 段\n{text}")

        print(f"  合并 {len(chunk_summaries)} 段摘要 ...")
        merge_prompt = MERGE_SUMMARIES_PROMPT.format(
            chunk_summaries="\n\n---\n\n".join(chunk_summaries)
        )

        if self._use_anthropic:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system="You are a meeting assistant. Produce a structured meeting summary.",
                messages=[{"role": "user", "content": merge_prompt}],
            )
            return _extract_text(response.content)
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[
                    {"role": "system", "content": "You are a meeting assistant. Produce a structured meeting summary."},
                    {"role": "user", "content": merge_prompt},
                ],
            )
            return response.choices[0].message.content
