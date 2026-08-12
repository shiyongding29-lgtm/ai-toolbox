"""数据分析助手 API。"""
import os, json, tempfile
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
import pandas as pd

from backend.database import get_db
from backend.config import config
from backend.services.llm_service import llm_service
from backend.services.data_analysis_service import parse_file, generate_chart
from backend.services.prompt_library import DATA_ANALYSIS_CODE_SYSTEM, DATA_ANALYSIS_INSIGHTS_SYSTEM
from backend.routers.history import save_history

router = APIRouter(prefix="/api/data-analysis", tags=["data-analysis"])

_user_files: dict[str, pd.DataFrame] = {}


@router.post("/upload")
async def data_upload(file: UploadFile = File(...)):
    """上传数据文件，返回预览。"""
    suffix = os.path.splitext(file.filename or "data.csv")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        preview = parse_file(tmp_path)
        df = pd.read_csv(tmp_path) if tmp_path.endswith(".csv") else pd.read_excel(tmp_path, engine="openpyxl")
        file_id = file.filename or "data"
        _user_files[file_id] = df
        return {"code": 0, "msg": "ok", "data": {"file_id": file_id, "preview": preview}}
    finally:
        os.unlink(tmp_path)


@router.post("/query")
async def data_query(req: dict, db: Session = Depends(get_db)):
    """自然语言查询数据。输入 {"file_id": "...", "question": "..."}"""
    file_id = req.get("file_id", "")
    question = req.get("question", "")
    df = _user_files.get(file_id)
    if df is None:
        return {"code": 404, "msg": "文件未找到，请先上传", "data": None}

    cols = ", ".join(f"{c}({df[c].dtype})" for c in df.columns)
    sample = df.head(5).to_string()

    prompt = DATA_ANALYSIS_CODE_SYSTEM.format(columns_info=cols)
    prompt += f"\nSample data:\n{sample}\n\nQuestion: {question}"

    code = llm_service.complete("You are a data analyst. Write Python code.", prompt)
    chart_url = None
    result = None
    error = None

    try:
        code = code.strip()
        if code.startswith("```"):
            code = code.split("```")[1]
            if code.startswith("python"):
                code = code[6:]

        local_vars = {"df": df, "result": None, "chart_config": None}
        exec(code, {}, local_vars)
        result = local_vars.get("result")
        chart_config = local_vars.get("chart_config")

        if chart_config and isinstance(chart_config, dict):
            chart_url = generate_chart(df, chart_config.get("type", "bar"),
                                       chart_config.get("x", df.columns[0]),
                                       chart_config.get("y", df.columns[-1]))
    except Exception as e:
        error = str(e)

    return {"code": 0, "msg": "ok", "data": {"result": str(result) if result is not None else None, "chart_url": chart_url, "error": error}}


@router.post("/insights")
async def data_insights(req: dict, db: Session = Depends(get_db)):
    """生成 AI 数据洞察。"""
    file_id = req.get("file_id", "")
    df = _user_files.get(file_id)
    if df is None:
        return {"code": 404, "msg": "文件未找到", "data": None}

    summary = f"Rows: {len(df)}, Columns: {list(df.columns)}\n" + df.describe().to_string()
    result = llm_service.complete(DATA_ANALYSIS_INSIGHTS_SYSTEM, summary)
    return {"code": 0, "msg": "ok", "data": {"result": result}}
