"""图表生成 API — LLM 设计 + 生成专业图表。"""
import os, re
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from backend.config import config
from backend.services.llm_service import llm_service

router = APIRouter(prefix="/api/chart", tags=["chart-generator"])


class ChartRequest(BaseModel):
    data: str = ""
    chart_type: str = "bar"
    title: str = ""


CHART_PROMPT = """You are a professional data visualization designer. Create a publication-quality matplotlib chart.

## Data
{data}

## Requirements
- Chart type: {chart_type}
- Title: {title}
- Style: modern, clean, professional. Use `plt.style.use('seaborn-v0_8-whitegrid')`.
- Colors: use a professional color palette (e.g. '#2196F3','#FF5722','#4CAF50','#FFC107','#9C27B0','#00BCD4')
- Figure size: (12, 6), dpi=120
- Font sizes: title 16pt bold, axis labels 12pt, ticks 10pt, data labels 9pt
- Always add value labels on bars and pie slices
- Add legend if multiple series
- Rotate x-axis labels 30 degrees if needed
- Add subtle grid lines
- Use tight_layout()

## CRITICAL RULES
1. Parse the data intelligently — detect CSV, TSV, or natural language
2. Strip non-numeric suffixes (B, M, K, 亿, 万, %, $, etc.) before converting to float
3. Choose the BEST visualization for this data, not just the requested type
4. If data has 2+ value columns, use grouped/stacked bars or multi-line chart
5. Add annotations for key insights (max, min, trends)
6. Output ONLY valid Python code, no markdown, no explanation
7. Save to: plt.savefig(output_path, bbox_inches='tight', dpi=120, facecolor='white')
8. The variable `output_path` is pre-defined — use it directly

## Output format
```python
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import numpy as np

# ... your chart code here ...

plt.savefig(output_path, bbox_inches='tight', dpi=120, facecolor='white')
plt.close()
```"""


def _save_chart(data_text: str, chart_type: str, title: str):
    if not data_text.strip():
        return {"code": 400, "msg": "No data provided", "data": None}
    os.makedirs(config.upload_dir, exist_ok=True)
    chart_name = f"chart_{os.urandom(4).hex()}.png"
    output_path = os.path.join(config.upload_dir, chart_name)
    try:
        _generate_chart(data_text.strip(), chart_type, title, output_path)
    except Exception as e:
        return {"code": 500, "msg": f"Chart error: {str(e)[:300]}", "data": None}
    if not os.path.exists(output_path):
        return {"code": 500, "msg": "Chart not created", "data": None}
    return {"code": 0, "msg": "ok", "data": {"chart_url": f"/uploads/{chart_name}", "result": f"Chart: {title}"}}


@router.post("/upload")
async def chart_upload(file: UploadFile = File(...), chart_type: str = Form("bar"), title: str = Form("")):
    text = (await file.read()).decode('utf-8')
    return _save_chart(text, chart_type, title or file.filename.rsplit('.', 1)[0])


@router.post("/generate")
async def chart_generate(req: ChartRequest):
    return _save_chart(req.data, req.chart_type, req.title or "Data Chart")


def _translate_if_chinese(text: str) -> str:
    """如果文本含中文，翻译成英文。"""
    if not re.search(r'[一-鿿]', text):
        return text  # 纯英文，不用翻译
    try:
        result = llm_service.complete(
            "Translate to English. Only output the translation, nothing else. Keep numbers and CSV format intact.",
            text[:2000]
        )
        return result.strip()
    except Exception:
        return text  # 翻译失败，用原文


def _generate_chart(data_text: str, chart_type: str, title: str, output_path: str):
    """LLM 设计 + 生成专业图表。中文自动翻译为英文。"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np

    # 翻译中文为英文
    data_text = _translate_if_chinese(data_text)
    title = _translate_if_chinese(title)

    # ── 方法 1：LLM 生成专业图表代码 ──
    try:
        prompt = CHART_PROMPT.format(data=data_text[:4000], chart_type=chart_type, title=title)
        code = llm_service.complete(
            "You are a matplotlib expert. Output ONLY valid Python code. No markdown, no explanation.",
            prompt
        )
        code = re.sub(r'^```\w*\n?', '', code.strip())
        code = re.sub(r'\n?```$', '', code)

        # 强制使用 output_path
        code = re.sub(r"plt\.savefig\([^)]+\)", f"plt.savefig('{output_path}', bbox_inches='tight', dpi=120, facecolor='white')", code)
        if 'plt.savefig' not in code:
            code += f"\nplt.savefig('{output_path}', bbox_inches='tight', dpi=120, facecolor='white')"

        ns = {'output_path': output_path, '__builtins__': __builtins__}
        exec(code, ns)
        if os.path.exists(output_path):
            return
    except Exception:
        pass  # LLM 方法失败，回退

    # ── 方法 2：简单回退图表 ──
    _simple_chart(data_text, chart_type, title, output_path)


def _simple_chart(data_text: str, chart_type: str, title: str, output_path: str):
    """简单直接的数据解析 + 绘图（LLM 失败时的兜底方案）。"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np

    lines = [l.strip() for l in data_text.split('\n') if l.strip()]
    sep = ',' if ',' in lines[0] else '\t'
    header = [h.strip() for h in lines[0].split(sep)]
    labels, all_vals = [], []
    for line in lines[1:]:
        parts = [p.strip() for p in line.split(sep)]
        if len(parts) >= 2:
            try:
                vals = [float(re.sub(r'[BMK亿万千%$,€£¥\s]', '', v)) for v in parts[1:]]
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

    plt.figure(figsize=(12, 6), dpi=120)
    colors = ['#2196F3','#FF5722','#4CAF50','#FFC107','#9C27B0','#00BCD4','#795548','#607D8B']
    x = np.arange(len(labels))
    n = len(all_vals)

    if chart_type == 'bar' and n > 1:
        w = 0.8 / n
        for i, vals in enumerate(all_vals):
            plt.bar(x + (i - n/2 + 0.5) * w, vals, w, label=header[i+1] if i+1 < len(header) else f'S{i+1}', color=colors[i%8], edgecolor='white')
        plt.legend(fontsize=10)
    elif chart_type == 'bar':
        plt.bar(labels, all_vals[0], color=colors[:len(labels)], edgecolor='white')
    elif chart_type == 'line':
        for i, vals in enumerate(all_vals):
            plt.plot(labels, vals, 'o-', color=colors[i%8], linewidth=2.5, markersize=8, label=header[i+1] if i+1 < len(header) else None)
        if n > 1: plt.legend(fontsize=10)
    elif chart_type == 'pie':
        plt.pie(all_vals[0], labels=labels, autopct='%1.1f%%', colors=colors[:len(labels)], startangle=90); plt.axis('equal')
    elif chart_type == 'scatter':
        for i, vals in enumerate(all_vals):
            plt.scatter(labels, vals, s=100, c=[colors[i%8]], label=header[i+1] if i+1 < len(header) else None)
        if n > 1: plt.legend(fontsize=10)

    plt.title(title, fontsize=16, fontweight='bold', pad=15)
    plt.xticks(x, labels, rotation=30, ha='right', fontsize=10)
    plt.tight_layout()
    plt.savefig(output_path, bbox_inches='tight', dpi=120, facecolor='white')
    plt.close()
