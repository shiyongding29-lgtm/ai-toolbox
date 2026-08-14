"""
统一 LLM 网关 — 支持模型路由，多任务类型自动选择最优模型。
"""

import os
import asyncio
from typing import AsyncGenerator, Optional

from backend.config import config

# 模型路由配置：task_type → (model_name, base_url, api_key)
# 优先级：环境变量 → config 默认值 → 主 LLM 配置
MODEL_ROUTING = {
    "default": {"model": config.llm_model},
    "summary": {"model": config.llm_model},
    "translation": {"model": os.getenv("TRANSLATION_MODEL", config.llm_model)},
    "coding": {"model": os.getenv("CODING_MODEL", config.llm_model)},
    "creative": {"model": config.llm_model},
}


class LLMError(Exception):
    """LLM 调用错误，包含用户友好的消息。"""
    def __init__(self, message: str, code: str = "llm_error"):
        self.message = message
        self.code = code
        super().__init__(message)


class LLMService:
    """统一 LLM 调用层，支持多模型路由。"""

    def __init__(self):
        self.base_url = config.llm_base_url
        self.max_tokens = config.llm_max_tokens
        self.temperature = config.llm_temperature
        self.api_key = config.llm_api_key
        self._use_anthropic = "anthropic" in (self.base_url or "").lower()
        self._client = None
        self._backend_label = ""
        self._available = None  # None=未检测, True=可用, False=不可用

    @property
    def is_available(self) -> bool:
        """检查 LLM 是否可用（API key 是否已配置）。"""
        if self._available is None:
            self._available = bool(self.api_key and self.api_key.strip() and
                                   self.api_key != "placeholder-key")
        return self._available

    @property
    def client(self):
        if self._client is None:
            if self._use_anthropic:
                from anthropic import Anthropic
                self._client = Anthropic(api_key=self.api_key, base_url=self.base_url)
                self._backend_label = "Anthropic"
            else:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key, base_url=self.base_url or None)
                self._backend_label = "OpenAI"
        return self._client

    @property
    def backend(self) -> str:
        if self._backend_label:
            return f"{self.model} ({self._backend_label})"
        return f"{self.model}"

    @property
    def model(self) -> str:
        return config.llm_model

    def complete(self, system_prompt: str, user_message: str, task_type: str = "default") -> str:
        """非流式 LLM 调用，按任务类型自动路由模型。"""
        if not self.is_available:
            raise LLMError(
                "LLM 未配置，请设置 OPENAI_API_KEY 环境变量。",
                code="llm_not_configured"
            )
        try:
            if self._use_anthropic:
                return self._complete_anthropic(system_prompt, user_message)
            return self._complete_openai(system_prompt, user_message, task_type)
        except Exception as e:
            msg = str(e)
            if "401" in msg or "Authentication" in msg or "auth" in msg.lower():
                raise LLMError(
                    "LLM API Key 无效，请检查 OPENAI_API_KEY 是否正确配置。",
                    code="llm_auth_error"
                )
            raise LLMError(f"LLM 调用失败: {msg[:200]}", code="llm_call_error")

    def _complete_openai(self, system: str, user: str, task_type: str = "default") -> str:
        model = MODEL_ROUTING.get(task_type, MODEL_ROUTING["default"])["model"]
        if task_type == "html":
            model = "deepseek-reasoner"
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        resp = self.client.chat.completions.create(
            model=model, messages=messages,
            max_tokens=self.max_tokens, temperature=self.temperature,
        )
        return resp.choices[0].message.content

    def _complete_anthropic(self, system: str, user: str) -> str:
        from anthropic.types import TextBlock
        resp = self.client.messages.create(
            model=self.model, max_tokens=self.max_tokens,
            system=system, messages=[{"role": "user", "content": user}],
        )
        for block in resp.content:
            if isinstance(block, TextBlock):
                return block.text
        return ""

    async def complete_async(self, system_prompt: str, user_message: str) -> str:
        """在线程池中执行同步 complete，避免阻塞事件循环。"""
        return await asyncio.to_thread(self.complete, system_prompt, user_message)

    async def stream(self, system_prompt: str, user_message: str) -> AsyncGenerator[str, None]:
        """流式输出。如果 LLM 不可用，yield 错误信息并结束。"""
        if not self.is_available:
            yield "⚠️ LLM 未配置。请在启动命令前设置 OPENAI_API_KEY 环境变量。"
            return
        try:
            if self._use_anthropic:
                async for chunk in self._stream_anthropic(system_prompt, user_message):
                    yield chunk
            else:
                async for chunk in self._stream_openai(system_prompt, user_message):
                    yield chunk
        except Exception as e:
            msg = str(e)
            if "401" in msg or "Authentication" in msg:
                yield "⚠️ LLM API Key 无效，请检查配置。"
            else:
                yield f"⚠️ LLM 调用失败: {msg[:200]}"

    async def _stream_openai(self, system: str, user: str):
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=self.max_tokens, temperature=self.temperature, stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else ""
            if delta:
                yield delta

    async def _stream_anthropic(self, system: str, user: str):
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, self._complete_anthropic, system, user)
        for i in range(0, len(text), 10):
            yield text[i:i + 10]
            await asyncio.sleep(0.01)


llm_service = LLMService()
