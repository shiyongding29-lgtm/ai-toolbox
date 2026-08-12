"""
多 Agent 协作编排器。
将多个 LLM 调用链接为管道，每个阶段扮演不同角色，
前一阶段的输出作为上下文传入下一阶段。
"""

from backend.services.llm_service import llm_service


class AgentOrchestrator:
    """顺序执行多步骤 LLM 管道。"""

    def run_pipeline(self, stages: list[dict], input_text: str, extra_context: dict = None) -> dict:
        """
        执行 agent 管道。

        Args:
            stages: [{"name": "researcher", "system_prompt": "...", "task": "..."}, ...]
            input_text: 初始输入文本
            extra_context: 注入到每个阶段的额外上下文变量

        Returns:
            {"results": {"stage1_name": "output", ...}, "final": "最终输出"}
        """
        context = extra_context or {}
        context["input"] = input_text
        results = {}

        for i, stage in enumerate(stages):
            name = stage["name"]
            system_prompt = stage["system_prompt"]
            task_template = stage.get("task", "{input}")

            # 渲染 task 模板中的上下文变量
            task = task_template.format(**context)
            # 把之前阶段的结果也注入
            task = task.replace("{previous_results}", self._format_previous(results))

            print(f"  Agent 阶段 [{i + 1}/{len(stages)}]: {name}")
            output = llm_service.complete(system_prompt, task)
            results[name] = output
            context[f"{name}_output"] = output

        return {
            "results": results,
            "final": results[stages[-1]["name"]] if stages else "",
        }

    @staticmethod
    def _format_previous(results: dict) -> str:
        """格式化之前的阶段输出。"""
        if not results:
            return "(无)"
        lines = []
        for name, output in results.items():
            lines.append(f"### {name} 输出:\n{output[:2000]}")
        return "\n\n".join(lines)


# 全局单例
orchestrator = AgentOrchestrator()
