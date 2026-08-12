"""智能表格 AI API — 上传表格，自然语言操作。"""
import json
import tempfile
import os
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import pandas as pd

from backend.database import get_db
from backend.services.llm_service import llm_service
from backend.routers.history import save_history

router = APIRouter(prefix="/api/spreadsheet", tags=["spreadsheet"])

# In-memory store: file_id → DataFrame
_sheets: dict[str, pd.DataFrame] = {}

SPREADSHEET_SYSTEM = """You are a data manipulation assistant. The user has uploaded a spreadsheet and wants to apply a natural language command to it.

The data has these columns: {columns}
First 5 rows:
{preview}

The user command: {command}

Write Python/pandas code to execute this command on the DataFrame.
Rules:
- The DataFrame variable is named `df`
- Do NOT reassign df to a new variable (use inplace operations or assign back to df)
- After executing, assign the result back to `result_df`
- Keep code under 15 lines
- Use only pandas/numpy operations — no file I/O, no external APIs
- Be defensive: handle missing values, use .copy() when needed

Output ONLY valid Python code, nothing else. No markdown fences, no explanation."""


class SpreadsheetCommandRequest(BaseModel):
    file_id: str = Field(...)
    command: str = Field(...)


@router.post("/upload")
async def upload_sheet(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "data.csv")[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # Try UTF-8 first, then fallback encodings
        try:
            if suffix in ('.xlsx', '.xls'):
                df = pd.read_excel(tmp_path, engine='openpyxl')
            else:
                df = pd.read_csv(tmp_path, encoding='utf-8-sig')
        except (UnicodeDecodeError, Exception):
            if suffix not in ('.xlsx', '.xls'):
                for enc in ['utf-8-sig', 'gbk', 'gb2312', 'latin-1', 'cp1252']:
                    try:
                        df = pd.read_csv(tmp_path, encoding=enc)
                        break
                    except:
                        continue
                else:
                    df = pd.read_csv(tmp_path, encoding='latin-1')

        file_id = file.filename or "sheet"
        df = df.fillna('')
        _sheets[file_id] = df

        # JSON-serializable preview
        preview_data = df.head(20).to_dict(orient='records')
        columns = [{"name": str(c), "dtype": str(df[c].dtype)} for c in df.columns]

        return {
            "code": 0, "msg": "ok",
            "data": {
                "file_id": file_id,
                "columns": columns,
                "row_count": len(df),
                "col_count": len(df.columns),
                "preview": preview_data,
                "all_data": df.to_dict(orient='records'),
            },
        }
    except Exception as e:
        return {"code": 500, "msg": f"Parse failed: {e}", "data": None}
    finally:
        try: os.unlink(tmp_path)
        except: pass


@router.post("/command")
async def execute_command(req: SpreadsheetCommandRequest, db: Session = Depends(get_db)):
    df = _sheets.get(req.file_id)
    if df is None:
        return {"code": 404, "msg": "Sheet not found, please upload first", "data": None}

    columns = ", ".join(f"{c}({df[c].dtype})" for c in df.columns)
    preview = df.head(5).to_string()
    prompt = SPREADSHEET_SYSTEM.format(columns=columns, preview=preview, command=req.command)

    code = llm_service.complete("You write Python code. Output ONLY code.", prompt)
    code = code.strip()
    if code.startswith("```"):
        code = code.split("```")[1]
        if code.startswith("python"):
            code = code[6:]

    error = None
    result_df = None
    try:
        local_vars = {"df": df.copy(), "result_df": None, "pd": pd}
        exec(code, {}, local_vars)
        result_df = local_vars.get("result_df")
        if result_df is not None and isinstance(result_df, pd.DataFrame):
            _sheets[req.file_id] = result_df.fillna('')
    except Exception as e:
        error = str(e)
        result_df = df

    if result_df is not None and isinstance(result_df, pd.DataFrame):
        preview_data = result_df.head(20).to_dict(orient='records')
        all_data = result_df.to_dict(orient='records')
        row_count = len(result_df)
    else:
        preview_data = df.head(20).to_dict(orient='records')
        all_data = df.to_dict(orient='records')
        row_count = len(df)

    history_id = save_history(db, "spreadsheet", f"Command: {req.command[:60]}", "", str(result_df.head(3).to_string() if result_df is not None else ""))

    return {
        "code": 0, "msg": "ok",
        "data": {
            "command": req.command,
            "code": code,
            "preview": preview_data,
            "all_data": all_data,
            "row_count": row_count,
            "error": error,
        },
        "history_id": history_id,
    }
