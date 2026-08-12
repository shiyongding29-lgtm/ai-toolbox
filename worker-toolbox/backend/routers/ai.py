"""AI 意图解析 API — 本地模型识别意图 + multi-tool检测 + 工作流生成。"""
from fastapi import APIRouter, Request
from backend.services.llm_service import llm_service, LLMError
from backend.services.intent_classifier_service import predict as local_predict
from backend.services.multitool_classifier_service import predict_multi

router = APIRouter(prefix="/api/ai", tags=["ai"])

INTENT_SYSTEM_PROMPT = """You are an intent classifier for a productivity toolbox app. Given the user's natural language input, analyze what tool they want and return a JSON object.

Available tools and their params:
- "todo": create a todo item. Params: {{ task: string, deadline: string (YYYY-MM-DD or empty string), owner: string or empty string }}
  Example: "set timer 30 min" → {{"tool":"pomodoro","params":{{"work":30}}, "reply":"30 minute pomodoro timer set 🍅"}}
- "pomodoro": start a pomodoro timer. Params: {{ work: number (minutes, default 25) }}
- "email": write an email or document. Params: {{ to: string or empty string, hint: string, mode: "email"|"notice"|"report"|"official" }}
- "translation": translate or rewrite text. Params: {{ text: string, mode: "translate_zh_en"|"translate_en_zh"|"polish"|"rewrite"|"expand"|"summarize" }}
- "research": deep web research. Params: {{ topic: string }}
- "ppt": generate PPT outline. Params: {{ slides: number or 0, style: string or empty string }}
- "summary": document summary. Params: {{}}
- "mindmap": mind map. Params: {{}}
- "data": data analysis. Params: {{}}
- "spreadsheet": spreadsheet. Params: {{}}
- "meeting": meeting recorder. Params: {{}}
- "weekly-report": weekly report. Params: {{ auto: true or false }}
- "task-planning": task planning. Params: {{}}
- "none": no tool matched. Params: {{}}

Today date: {today}. Tomorrow: {tomorrow}. Day after: {day_after}. Use these to resolve relative dates.

Return ONLY valid JSON, no markdown, no explanation:
{{"tool":"...","params":{{...}},"reply":"..."}}"""


import json
import re
from datetime import date, timedelta


def _next_weekday(n: int):
    today = date.today()
    days_ahead = n - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return (today + timedelta(days=days_ahead)).isoformat()


# 上游 output 已覆盖的功能 → 不需要再调这些 tool
REDUNDANT_MAP = {
    'meeting_recorder.summary': ['document_summary'],
    'document_summary.summary': ['document_summary'],
    'meeting_recorder.transcript': [],
}


def _deduplicate_workflow(plan: dict) -> dict:
    """去掉被上游 output 覆盖的重复 tool。"""
    nodes = plan.get('nodes', [])
    edges = plan.get('edges', [])

    # 收集上游覆盖的 output
    covered = set()
    for e in edges:
        up = e.get('from', '')
        out = e.get('fromOutput', '')
        key = f'{up}.{out}'
        for dup_tool in REDUNDANT_MAP.get(key, []):
            covered.add(dup_tool)

    # 移除被覆盖的节点和边
    if covered:
        removed_ids = set()
        for n in nodes:
            if n.get('tool') in covered:
                removed_ids.add(n['id'])
        plan['nodes'] = [n for n in nodes if n['id'] not in removed_ids]
        plan['edges'] = [e for e in edges if e['to'] not in removed_ids and e['from'] not in removed_ids]

    return plan


@router.post("/parse-intent")
async def parse_intent(req: dict):
    text = req.get("text", "")
    if not text:
        return {"code": 400, "msg": "Missing text", "data": None}

    # ── 先用本地模型系列 ──
    try:
        # ① 先检测是否多步骤（不依赖单意图信心）
        mt_result = predict_multi(text)
        if mt_result['is_multi'] and mt_result['confidence'] >= 0.7:
            try:
                from backend.routers.workflow_engine import plan_workflow
                plan = plan_workflow(text)
                if 'error' not in plan:
                    plan = _deduplicate_workflow(plan)
                    reply = f'已生成工作流: {plan.get("title", "")}'
                    questions = plan.get('questions', [])
                    if questions:
                        reply += '\n\n' + '\n'.join(f'❓ {q}' for q in questions)
                    return {
                        "code": 0, "msg": "ok",
                        "data": {
                            "type": "workflow",
                            "plan": plan,
                            "reply": reply,
                            "questions": questions,
                            "source": "local_model",
                        }
                    }
            except Exception:
                pass  # workflow生成失败，继续走单tool

        # ② 单意图分类
        local_result = local_predict(text)
        if local_result['confidence'] >= 0.6:
            intent = local_result['intent']
            tool = local_result['tool']

            # ── 正则提取参数（不依赖 LLM，瞬间完成）──
            params = {}
            cn_num = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,
                      '两':2,'半':0.5,'十五':15,'二十':20,'二十五':25,'三十':30,'三十五':35,
                      '四十':40,'四十五':45,'五十':50,'五十五':55,'六十':60}
            pomo_m = re.search(r'(\d+|[一二三四五六七八九十两][十]?[一二三四五六七八九]?)\s*(分钟|分|min)', text, re.I)
            if pomo_m:
                try: params['work'] = int(pomo_m.group(1))
                except: params['work'] = cn_num.get(pomo_m.group(1), 25)

            ppt_m = re.search(r'(\d+|[一二三四五六七八九十两][十]?)\s*(页|张|slides?|pages?)', text, re.I)
            if ppt_m:
                try: params['slides'] = int(ppt_m.group(1))
                except: params['slides'] = cn_num.get(ppt_m.group(1), 12)
            ppt_s = re.search(r'(\S{1,6})(?:风|风格|style)', text)
            if ppt_s: params['style'] = ppt_s.group(1) + '风'

            deadline = ''
            if re.search(r'后天', text):
                d = today + timedelta(days=2); deadline = d.isoformat()
            elif re.search(r'明天', text):
                d = today + timedelta(days=1); deadline = d.isoformat()
            elif re.search(r'今天', text):
                deadline = today.isoformat()
            if deadline:
                params['deadline'] = deadline
                task = re.sub(r'提醒我|记得|别忘了|帮我记|帮我记录|明天|后天|今天', '', text).strip().lstrip('：:，,。.').strip() or text
                params['task'] = task

            reply_map = {
                'meeting': '帮你打开会议记录', 'translation': '帮你打开翻译', 'ppt': '帮你生成PPT',
                'summary': '帮你总结文档', 'todo': '帮你添加待办', 'research': '帮你调研',
                'email': '帮你写邮件', 'pomodoro': f'帮你设置{params.get("work", 25)}分钟番茄钟',
                'mindmap': '帮你生成思维导图', 'data': '帮你分析数据',
                'spreadsheet': '帮你打开智能表格', 'weekly_report': '帮你生成周报',
                'task_planning': '帮你规划任务', 'image-analyzer': '帮你分析图片',
                'chart-generator': '帮你生成图表', 'doc-compare': '帮你对比文档',
                'multi-source': '帮你多源阅读', 'rag-qa': '帮你查询知识库', 'info-extraction': '帮你提取信息',
                'table_generator': '帮你生成表格', 'pdf_toolkit': '帮你处理PDF',
                'sentiment_analyzer': '帮你分析情感',
                'file_converter': '帮你转换文件格式', 'todo_add': '帮你添加待办',
                'web_scraper': '帮你抓取网页', 'qr_generator': '帮你生成QR码',
            }

            return {
                "code": 0, "msg": "ok",
                "data": {
                    "tool": tool, "params": params,
                    "reply": reply_map.get(intent, f'→ {intent}'),
                    "source": "local_model",
                }
            }
    except Exception:
        pass  # 本地模型挂了，回退到 LLM

    # ── 回退：用 LLM 解析 ──
    today = date.today()
    # Build context with today and next few relative dates
    tomorrow = (today + timedelta(days=1)).isoformat()
    day_after = (today + timedelta(days=2)).isoformat()

    context = INTENT_SYSTEM_PROMPT.format(
        today=today.isoformat(), tomorrow=tomorrow, day_after=day_after
    )

    try:
        raw = llm_service.complete(context, text, task_type="default")
    except LLMError as e:
        return {"code": 503, "msg": e.message, "data": None}

    # Parse JSON from LLM response
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```\w*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Try to find JSON anywhere
        m = re.search(r'\{[^{}]*"tool"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*,\s*"reply"\s*:\s*"[^"]*"\s*\}', raw, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except json.JSONDecodeError:
                parsed = {"tool": "none", "params": {}, "reply": "不太确定你要做什么，能再说一遍吗？"}
        else:
            parsed = {"tool": "none", "params": {}, "reply": "不太确定你要做什么，能再说一遍吗？"}

    tool = parsed.get("tool", "none")
    params = parsed.get("params", {})
    reply = parsed.get("reply", "")

    return {"code": 0, "msg": "ok", "data": {"tool": tool, "params": params, "reply": reply}}
