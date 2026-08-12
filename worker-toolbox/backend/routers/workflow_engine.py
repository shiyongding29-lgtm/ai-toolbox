import json
import re
import threading
import time
import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from backend.database import SessionLocal
from backend.models import TodoItem
from backend.services.llm_service import llm_service, LLMError
from backend.routers.tools_registry import TOOLS, TOOLS_BY_ID
from backend.services.prompt_library import (
    MEETING_SUMMARY_SYSTEM, TODO_EXTRACTION_SYSTEM,
    EMAIL_GENERATION_SYSTEM, WEEKLY_REPORT_SYSTEM,
    DOCUMENT_SUMMARY_SYSTEM, DOCUMENT_COMPARISON_SYSTEM,
    TASK_PLANNING_SYSTEM, MULTI_SOURCE_SYNTHESIS_SYSTEM,
    TRANSLATION_SYSTEM, PPT_OUTLINE_SYSTEM,
    DEEP_RESEARCH_REPORT_SYSTEM,
    DEEP_RESEARCH_PLAN_SYSTEM, DEEP_RESEARCH_ANALYZE_SYSTEM,
)

MINDMAP_SYSTEM = """You are an expert knowledge organizer. Convert the user's input into a hierarchical mind map structure in Markdown format.

Rules:
- Use ## for main topics (level 1 nodes)
- Use ### for subtopics (level 2 nodes)
- Use #### for details (level 3 nodes)
- Use - for leaf items under any heading
- Keep each node concise (under 15 words)
- Organize logically: group related ideas, use clear hierarchy
- Cover ALL key points from the input — be thorough
- Use the same language as the input

Output ONLY the markdown structure, no preamble or explanation."""

DEEP_RESEARCH_SIMPLE_SYSTEM = """You are a research writer. Write a comprehensive report about the given topic.
Include: Executive Summary, Background, Key Findings (3-5), Detailed Analysis, Conclusions & Recommendations.
Use the same language as the input. Output in Markdown."""


# ── 节点执行器 — 调用原有 tool 的服务逻辑 ──

def _exec_meeting_recorder(inputs: dict) -> dict:
    text = inputs.get("text", inputs.get("transcript", ""))
    if text:
        summary = llm_service.complete(MEETING_SUMMARY_SYSTEM, text)
        return {"transcript": text, "summary": summary}
    return {"transcript": "", "summary": "需要录音输入"}


def _exec_document_summary(inputs: dict) -> dict:
    text = inputs.get("text", "")
    if not text: return {"error": "no text"}
    result = llm_service.complete(DOCUMENT_SUMMARY_SYSTEM, text[:50000])
    return {"summary": result}


def _exec_mindmap(inputs: dict) -> dict:
    text = inputs.get("text", "")
    if not text: return {"error": "no text"}
    mode = inputs.get("mode", "auto")
    prefix_map = {
        "meeting": "Convert this meeting transcript into a structured mind map. Capture decisions, action items, discussion topics, and key points:\n\n",
        "ideas": "Convert these brainstorm ideas into an organized mind map. Group related concepts, identify themes, and create a clear hierarchy:\n\n",
        "document": "Convert this document into a knowledge mind map. Extract the main topics, key concepts, and important details:\n\n",
        "auto": "",
    }
    user_message = prefix_map.get(mode, "") + text
    result = llm_service.complete(MINDMAP_SYSTEM, user_message)
    return {"markdown": result}


def _exec_todo_extraction(inputs: dict) -> dict:
    text = inputs.get("text", "")
    if not text: return {"error": "no text"}
    raw = llm_service.complete(TODO_EXTRACTION_SYSTEM, text)
    items = _parse_json_array(raw)
    normalized = []
    for item in items:
        p = item.get("priority", "medium")
        normalized.append({
            "task": item.get("task", ""),
            "owner": item.get("owner", "TBD"),
            "deadline": item.get("deadline", ""),
            "priority": 1 if str(p).lower() in ("high", "高") else 2 if str(p).lower() in ("medium", "中") else 3,
        })
    return {"todos": normalized}


def _exec_todo_add(inputs: dict) -> dict:
    todos = inputs.get("todos", [])
    if isinstance(todos, str):
        todos = _parse_json_array(todos)
    if not todos: return {"added_count": 0}
    db = SessionLocal()
    try:
        month = datetime.datetime.now().strftime("%Y-%m")
        added = 0
        for t in todos:
            if isinstance(t, dict) and t.get("task", "").strip():
                db.add(TodoItem(
                    task=t["task"], owner=t.get("owner", "TBD"),
                    deadline=t.get("deadline", ""),
                    priority=int(t.get("priority", 2)) if str(t.get("priority", 2)).isdigit() else 2,
                    source="workflow", month_key=month,
                ))
                added += 1
        db.commit()
        return {"added_count": added}
    finally:
        db.close()


def _exec_email_doc(inputs: dict) -> dict:
    text = inputs.get("text", "") or inputs.get("hint", "")
    mode = inputs.get("doc_mode", inputs.get("mode", "email"))
    prompt = f"Generate a {mode}. The user said: {text}"
    result = llm_service.complete(EMAIL_GENERATION_SYSTEM, prompt)
    return {"document": result}


def _exec_translation(inputs: dict) -> dict:
    text = inputs.get("text", "")
    mode = inputs.get("mode", "translate_zh_en")
    mode_prefixes = {
        "translate_zh_en": "Translate the following Chinese text to English:\n\n",
        "translate_en_zh": "Translate the following English text to Chinese:\n\n",
        "polish": "Polish and improve the following text:\n\n",
        "rewrite": "Rewrite the following text.",
        "style_casual": "Rewrite the following text in a casual, conversational tone:\n\n",
        "style_formal": "Rewrite the following text in a formal, professional tone:\n\n",
        "expand": "Expand the following text with more details and examples while keeping the core meaning:\n\n",
        "summarize": "Condense the following text to its key points. Make it shorter:\n\n",
    }
    user_message = mode_prefixes.get(mode, "") + text
    result = llm_service.complete(TRANSLATION_SYSTEM, user_message)
    return {"translated_text": result}


def _exec_ppt_outline(inputs: dict) -> dict:
    text = inputs.get("text", "") or inputs.get("topic", "")
    slides = inputs.get("slides", 12)
    style = inputs.get("style", "")
    prompt = f"Topic: {text}\nSlides: {slides}"
    if style:
        prompt += f"\n\nRequirements: Style: {style}"
    result = llm_service.complete(PPT_OUTLINE_SYSTEM, prompt)
    return {"outline": result}


def _exec_deep_research(inputs: dict) -> dict:
    text = inputs.get("text", "") or inputs.get("topic", "")
    try:
        from backend.services.web_search_service import web_search
        search_results = web_search.search(text, num_results=5)
        if not search_results:
            report = llm_service.complete(DEEP_RESEARCH_SIMPLE_SYSTEM, f"Research topic: {text}")
            return {"report": report, "sources": []}

        sources_text = []
        for i, r in enumerate(search_results, 1):
            page_text = web_search.fetch_page(r["url"])
            sources_text.append(f"=== Source {i}: {r['title']} ===\n{page_text[:5000]}")
        all_sources = "\n\n".join(sources_text)

        analysis = llm_service.complete(DEEP_RESEARCH_ANALYZE_SYSTEM, f"Topic: {text}\n\nSources:\n{all_sources}")
        report = llm_service.complete(DEEP_RESEARCH_REPORT_SYSTEM, f"Topic: {text}\n\nAnalysis:\n{analysis}")
        return {"report": report, "sources": [{"title": r["title"], "url": r["url"]} for r in search_results]}
    except Exception:
        report = llm_service.complete(DEEP_RESEARCH_SIMPLE_SYSTEM, f"Research topic: {text}")
        return {"report": report, "sources": []}


def _exec_weekly_report(inputs: dict) -> dict:
    text = inputs.get("text", "") or "auto"
    report = llm_service.complete(WEEKLY_REPORT_SYSTEM, f"Generate weekly report from: {text}")
    return {"report": report}


def _exec_task_planning(inputs: dict) -> dict:
    text = inputs.get("text", "") or inputs.get("tasks", "")
    constraints = inputs.get("constraints", "无")
    prompt = f"Tasks:\n{text}\n\nConstraints: {constraints}\n\nDecompose each task with subtasks, time estimates, and dependencies."
    result = llm_service.complete(TASK_PLANNING_SYSTEM, prompt)
    return {"plan": result}


def _exec_document_comparison(inputs: dict) -> dict:
    text_a = inputs.get("text_a", inputs.get("text", ""))
    text_b = inputs.get("text_b", "")
    prompt = f"Document A:\n{text_a[:8000]}\n\n---\n\nDocument B:\n{text_b[:8000]}"
    result = llm_service.complete(DOCUMENT_COMPARISON_SYSTEM, prompt)
    return {"diff": result}


def _exec_multi_source_reader(inputs: dict) -> dict:
    text = inputs.get("text", "") or inputs.get("urls", "")
    result = llm_service.complete(MULTI_SOURCE_SYNTHESIS_SYSTEM, f"Sources: {text[:30000]}")
    return {"report": result}


def _make_llm_executor(system_prompt: str, output_key: str):
    def fn(inputs: dict) -> dict:
        text = inputs.get("text", "")
        if not text: return {"error": "no text"}
        return {output_key: llm_service.complete(system_prompt, text)}
    return fn


def _exec_image_analyzer(inputs: dict) -> dict:
    """Workflow executor: 图片分析通过 text 描述实现。"""
    text = inputs.get("text", inputs.get("description", ""))
    if not text:
        return {"description": "需要上传图片或提供图片描述", "objects": [], "style": "", "text_in_image": ""}
    from backend.services.prompt_library import IMAGE_ANALYSIS_SYSTEM
    import json, re
    raw = llm_service.complete(IMAGE_ANALYSIS_SYSTEM, f"Analyze this image description: {text}")
    cleaned = re.sub(r'^```\w*\n?', '', raw.strip())
    cleaned = re.sub(r'\n?```$', '', cleaned)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r'\{[\s\S]*\}', cleaned)
        result = json.loads(m.group(0)) if m else {"description": raw[:500]}
    return result


def _exec_chart_generator(inputs: dict) -> dict:
    """Workflow executor: 直接调用独立 chart_generator 的图表生成函数。"""
    text = inputs.get("table_csv") or inputs.get("text", "")
    chart_type = inputs.get("chart_type", "bar")
    title = inputs.get("title", "Chart")
    if not text:
        return {"chart_url": "", "result": "需要数据输入"}
    import os
    from backend.config import config
    from backend.routers.chart_generator import _generate_chart
    os.makedirs(config.upload_dir, exist_ok=True)
    chart_name = f"wf_chart_{os.urandom(4).hex()}.png"
    output_path = os.path.join(config.upload_dir, chart_name)
    try:
        _generate_chart(text, chart_type, title, output_path)
        if os.path.exists(output_path):
            return {"chart_url": f"/uploads/{chart_name}", "result": f"{title} generated"}
        return {"chart_url": "", "result": "Chart file not created"}
    except Exception as e:
        return {"chart_url": "", "result": f"Error: {str(e)[:200]}"}


def _generate_chart_direct(data_text: str, chart_type: str, title: str, output_path: str):
    """解析 CSV/文本数据并直接用 matplotlib 生成图表（支持多列）。"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np
    import re

    lines = [l.strip() for l in data_text.split('\n') if l.strip()]
    if not lines: raise ValueError("No data")

    sep = ',' if ',' in lines[0] else '\t'
    header = [h.strip() for h in lines[0].split(sep)]
    labels = []  # x-axis labels
    series_names = header[1:]  # column names
    all_vals = []  # list of lists, one per series

    for line in lines[1:]:
        parts = [p.strip() for p in line.split(sep)]
        if len(parts) >= 2:
            try:
                # Strip non-numeric suffixes: B, M, K, 亿, 万, %, etc.
                vals = []
                for v in parts[1:]:
                    v_clean = re.sub(r'[BMK亿万千%$,€£¥\s]', '', v)
                    vals.append(float(v_clean))
                labels.append(parts[0])
                while len(all_vals) < len(vals):
                    all_vals.append([])
                for i, v in enumerate(vals):
                    all_vals[i].append(v)
            except ValueError: continue

    if not labels:
        nums = re.findall(r'(\d+(?:\.\d+)?)', data_text)
        vals = [float(n) for n in nums[:20]]
        labels = [f'Item {i+1}' for i in range(len(vals))]
        all_vals = [vals]

    if not labels: raise ValueError("No numeric data")

    plt.figure(figsize=(12, 6), dpi=100)
    colors = ['#00e5ff','#7c3aed','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#14b8a6']
    x = np.arange(len(labels))
    n_series = len(all_vals)
    bar_w = 0.8 / n_series if n_series > 1 else 0.6

    if chart_type == 'bar' and n_series > 1:
        for i, vals in enumerate(all_vals):
            offset = (i - n_series/2 + 0.5) * bar_w
            plt.bar(x + offset, vals, bar_w, label=series_names[i] if i < len(series_names) else f'Series {i+1}',
                    color=colors[i % len(colors)], edgecolor='white', linewidth=0.5)
        plt.legend(fontsize=9)
    elif chart_type == 'bar':
        vals = all_vals[0] if all_vals else []
        plt.bar(labels, vals, color=colors[:len(vals)], edgecolor='white', linewidth=0.5)
    elif chart_type == 'line':
        for i, vals in enumerate(all_vals):
            plt.plot(labels, vals, 'o-', color=colors[i % len(colors)], linewidth=2, markersize=6,
                     label=series_names[i] if i < len(series_names) else None)
        if n_series > 1: plt.legend(fontsize=9)
    elif chart_type == 'pie':
        vals = all_vals[0] if all_vals else []
        plt.pie(vals, labels=labels, autopct='%1.1f%%', colors=colors[:len(vals)], startangle=90)
        plt.axis('equal')
    elif chart_type == 'scatter':
        for i, vals in enumerate(all_vals):
            plt.scatter(labels, vals, c=[colors[i % len(colors)]], s=80, label=series_names[i] if i < len(series_names) else None)
        if n_series > 1: plt.legend(fontsize=9)

    plt.title(title, fontsize=16, fontweight='bold', pad=15)
    plt.xticks(x, labels, rotation=30, ha='right', fontsize=9)
    plt.tight_layout()
    plt.savefig(output_path, bbox_inches='tight', dpi=100, facecolor='white')
    plt.close()


def _exec_table_generator(inputs: dict) -> dict:
    """Workflow executor: 从报告文本中提取结构化CSV表格。"""
    text = inputs.get("text", "")
    columns = inputs.get("columns", "")
    hint = inputs.get("hint", "")
    if not text:
        return {"error": "no text", "table_csv": "", "table_result": "需要文本输入"}
    prompt = f"""Extract structured data from the following report into a CSV table.
{ 'Columns: ' + columns if columns else 'Auto-detect appropriate columns.' }
{ 'Hint: ' + hint if hint else '' }

Report:
{text[:8000]}

Return ONLY the CSV data (comma-separated, with header row). No markdown, no explanation.
Example output:
Year,Anta Revenue,Li-Ning Revenue
2020,35.5B,26.8B
2021,41.2B,29.3B
..."""
    try:
        csv_text = llm_service.complete(
            "You are a data extraction specialist. Extract structured CSV data from reports. Return ONLY raw CSV, no markdown, no explanation.",
            prompt
        )
        csv_text = csv_text.strip().strip('`').strip()
        # Remove markdown code fences if present
        csv_text = csv_text.replace('```csv', '').replace('```', '').strip()
        return {"table_csv": csv_text, "table_result": f"提取了 {len(csv_text.split(chr(10)))-1} 行數據"}
    except Exception as e:
        return {"error": str(e)[:200], "table_csv": "", "table_result": "提取失敗"}


def _exec_pdf_toolkit(inputs: dict) -> dict:
    """Workflow executor: PDF 文字提取。"""
    text = inputs.get("text", "")
    if text:
        return {"text": text, "url": ""}
    return {"text": "需要上传PDF文件", "url": ""}


def _exec_sentiment_analyzer(inputs: dict) -> dict:
    """Workflow executor: 情感分析。"""
    text = inputs.get("text", "")
    if not text: return {"sentiment": "neutral", "confidence": 0, "scores": {}}
    try:
        from backend.routers.sentiment_analyzer import _load, _tokenizer, _model, _device, LABELS
        _load()
        import torch
        inputs_t = _tokenizer(text, return_tensors='pt', truncation=True, padding=True, max_length=128)
        inputs_t = {k: v.to(_device) for k, v in inputs_t.items()}
        with torch.no_grad():
            scores = torch.softmax(_model(**inputs_t).logits, dim=-1)[0]
            pred = torch.argmax(scores).item()
        return {"sentiment": LABELS[pred], "confidence": round(scores[pred].item(), 4),
                "scores": {LABELS[i]: round(scores[i].item(), 4) for i in range(3)}}
    except Exception as e:
        return {"sentiment": "neutral", "confidence": 0, "scores": {}, "error": str(e)[:100]}


EXECUTORS: dict[str, Callable] = {
    "user_input": lambda inputs: {"text": inputs.get("text", inputs.get("input", ""))},
    "meeting_recorder": _exec_meeting_recorder,
    "document_summary": _exec_document_summary,
    "mindmap": _exec_mindmap,
    "todo_extraction": _exec_todo_extraction,
    "todo_add": _exec_todo_add,
    "email_doc": _exec_email_doc,
    "translation": _exec_translation,
    "ppt_outline": _exec_ppt_outline,
    "deep_research": _exec_deep_research,
    "document_comparison": _exec_document_comparison,
    "task_planning": _exec_task_planning,
    "weekly_report": _exec_weekly_report,
    "multi_source_reader": _exec_multi_source_reader,
    "image_analyzer": _exec_image_analyzer,
    "chart_generator": _exec_chart_generator,
    "table_generator": _exec_table_generator,
    "pdf_toolkit": _exec_pdf_toolkit,
    "sentiment_analyzer": _exec_sentiment_analyzer,
}

# ── JSON 解析 ──

def _parse_llm_json(raw: str):
    cleaned = raw.strip()
    cleaned = re.sub(r"^```\w*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    for pat in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
        m = re.search(pat, cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                continue
    return None

def _parse_json_array(raw: str) -> list:
    result = _parse_llm_json(raw)
    if isinstance(result, list):
        return result
    return []

def _parse_json_object(raw: str) -> dict:
    result = _parse_llm_json(raw)
    if isinstance(result, dict):
        return result
    return {}


# ── 输入解析 ──

def _resolve_inputs(node_id: str, edges: list[dict], node_results: dict, user_input: dict) -> dict:
    tool = TOOLS_BY_ID.get(node_results.get(f"__tool_{node_id}", ""), {})
    inputs = {**user_input}
    node_configs = user_input.get("node_configs", {})
    if isinstance(node_configs, dict):
        node_cfg = node_configs.get(node_id, {})
        if isinstance(node_cfg, dict):
            inputs = {**inputs, **node_cfg}
    for edge in edges:
        if edge["to"] == node_id:
            prev_id = edge["from"]
            prev_outputs = node_results.get(prev_id, {})
            data_label = edge.get("fromOutput") or edge.get("data", "")
            if data_label and data_label in prev_outputs:
                inputs[data_label] = prev_outputs[data_label]
            else:
                for k, v in prev_outputs.items():
                    if k not in inputs:
                        inputs[k] = v
    if not inputs.get("text"):
        for k in ["transcript", "summary", "markdown", "hint", "topic", "question", "tasks", "document", "translated_text", "outline", "report", "diff", "plan"]:
            if k in inputs and inputs[k]:
                inputs["text"] = inputs[k]
                break
    return inputs


# ── 工作流存储 ──

_workflows: dict[str, dict] = {}
_wf_lock = threading.Lock()


def _exec_workflow(workflow_id: str, nodes: list[dict], edges: list[dict], user_input: dict):
    node_results = {}
    for n in nodes:
        node_results[f"__tool_{n['id']}"] = n["tool"]
    with _wf_lock:
        _workflows[workflow_id] = {
            "status": "running", "nodes": [{"id": n["id"], "tool": n["tool"], "label": n["label"], "status": "pending"} for n in nodes],
            "edges": edges, "results": {}, "error": None, "user_input": user_input,
        }
    node_map = {n["id"]: n for n in nodes}
    in_degree = {n["id"]: 0 for n in nodes}
    adj = {n["id"]: [] for n in nodes}
    for e in edges:
        in_degree[e["to"]] = in_degree.get(e["to"], 0) + 1
        adj.setdefault(e["from"], []).append(e["to"])
    queue = [nid for nid, d in in_degree.items() if d == 0]
    completed = set()
    failed = False
    error_msg = ""
    pool = ThreadPoolExecutor(max_workers=4)
    try:
        while queue:
            ready_nodes = [nid for nid in queue if nid not in completed]
            if not ready_nodes:
                break
            def run_node(nid):
                node = node_map[nid]
                tool_id = node["tool"]
                with _wf_lock:
                    for wn in _workflows[workflow_id]["nodes"]:
                        if wn["id"] == nid: wn["status"] = "running"
                executor = EXECUTORS.get(tool_id)
                if not executor:
                    return (nid, {"error": f"Unknown tool: {tool_id}"}, False)
                resolved_inputs = _resolve_inputs(nid, edges, node_results, user_input)
                try:
                    result = executor(resolved_inputs)
                    return (nid, result, True)
                except Exception as e:
                    return (nid, {"error": str(e)}, False)
            futures = {pool.submit(run_node, nid): nid for nid in ready_nodes}
            for f in futures:
                nid, result, ok = f.result()
                node_results[nid] = result
                completed.add(nid)
                with _wf_lock:
                    for wn in _workflows[workflow_id]["nodes"]:
                        if wn["id"] == nid:
                            wn["status"] = "done" if ok else "error"
                            if not ok and result.get("error"):
                                wn["error"] = result["error"]
                if not ok:
                    failed = True
                    error_msg = result.get("error", f"Node {nid} failed")
            if failed:
                break
            queue = []
            for n in nodes:
                if n["id"] not in completed:
                    indeg = sum(1 for e in edges if e["to"] == n["id"] and e["from"] not in completed)
                    if indeg == 0:
                        queue.append(n["id"])
            if not queue:
                remaining = [n["id"] for n in nodes if n["id"] not in completed]
                if remaining:
                    queue = remaining
    finally:
        pool.shutdown(wait=False)
    with _wf_lock:
        if failed:
            _workflows[workflow_id]["status"] = "error"
            _workflows[workflow_id]["error"] = error_msg
        else:
            _workflows[workflow_id]["status"] = "done"
        _workflows[workflow_id]["results"] = node_results


# ── API handlers ──

PLANNER_SYSTEM_PROMPT = """You are a workflow planner for a productivity toolbox. Given a user's request, design a pipeline using available tools.

## Available Tools
{tools_json}

## Rules
1. Each tool has "id", "inputs", "outputs". Connect them: tool B's input comes from tool A's output.
2. Every input must come from either: user-provided data, or a previous tool's output.
3. Fill in node "config" from the tool's config_schema ONLY if the user explicitly specified them.
   Example: "线上会议" → mode:"online", "现场会议" → mode:"live", "10页科技风PPT" → slides:10, style:"科技风"
4. If a tool has a required config that the user did NOT specify, DO NOT guess — add it to "questions" array.
   Example: user says "记录会议" without specifying mode → questions:["会议模式：现场🎤还是线上💻？"]
5. Return a valid JSON workflow definition:

{{
  "title": "Short workflow title",
  "description": "What this workflow does in one sentence",
  "nodes": [
    {{"id":"rec","tool":"meeting_recorder","label":"录音转写","config":{{"mode":"live"}}}}
  ],
  "edges": [
    {{"from":"node_id","to":"node_id","fromOutput":"what_data_flows"}}
  ],
  "input": "what_user_input_is_needed (record_audio | paste_text | url | file)",
  "reply": "brief explanation in user's language",
  "questions": ["string questions to ask user for missing required configs"]
}}

## Example
User: "记录会议然后总结并提取待办"
→ {{
  "title": "Meeting → Summary → Todos",
  "description": "Record meeting, generate summary, extract action items and add to list",
  "nodes": [
    {{"id":"rec","tool":"meeting_recorder","label":"录音转写","config":{{"mode":"live"}}}},
    {{"id":"sum","tool":"document_summary","label":"AI 总结"}},
    {{"id":"todo","tool":"todo_extraction","label":"提取待办"}},
    {{"id":"add","tool":"todo_add","label":"添加到列表"}}
  ],
  "edges": [
    {{"from":"rec","to":"sum","fromOutput":"transcript"}},
    {{"from":"rec","to":"todo","fromOutput":"transcript"}},
    {{"from":"todo","to":"add","fromOutput":"todos"}}
  ],
  "input": "record_audio",
  "reply": "好的！会议录制默认使用现场模式🎤，你可以更改为线上模式💻。会自动做：AI总结 + 提取待办 + 添加到列表。",
  "questions": ["会议模式已默认为「现场模式🎤」，需要改为「线上模式💻」吗？"]
}}

User: "帮我做一个10页的科技风PPT"
→ node config: {{"slides":10,"style":"科技风"}}

Return ONLY the JSON object, no markdown, no explanation."""


def plan_workflow(user_text: str) -> dict:
    tools_desc = json.dumps([
        {"id": t["id"], "name": t["name"], "inputs": t["inputs"], "outputs": t["outputs"], "config_schema": t.get("config_schema", [])}
        for t in TOOLS
    ], ensure_ascii=False, indent=2)
    prompt = PLANNER_SYSTEM_PROMPT.format(tools_json=tools_desc)
    try:
        raw = llm_service.complete(prompt, user_text)
    except LLMError as e:
        return {"error": e.message}
    plan = _parse_json_object(raw)
    if not plan:
        return {"error": "AI returned invalid JSON", "raw": raw[:500]}
    if not plan.get("nodes"):
        return {"error": "AI did not generate valid workflow nodes", "raw": raw[:500]}
    for n in plan["nodes"]:
        if n["tool"] not in TOOLS_BY_ID:
            return {"error": f"Unknown tool: {n['tool']}", "raw": raw[:500]}
    return plan


def run_workflow(plan: dict, user_input: dict) -> str:
    workflow_id = f"wf_{int(time.time() * 1000)}"
    t = threading.Thread(
        target=_exec_workflow,
        args=(workflow_id, plan["nodes"], plan.get("edges", []), user_input),
        daemon=True,
    )
    t.start()
    return workflow_id


def get_workflow_status(workflow_id: str) -> dict | None:
    with _wf_lock:
        return _workflows.get(workflow_id)
