"""
数据分析服务 — pandas 解析 + matplotlib 图表生成。
"""

import os
import tempfile

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from backend.config import config


def parse_file(file_path: str) -> dict:
    """解析 Excel/CSV 文件，返回预览信息。"""
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path, engine="openpyxl")

    preview = df.head(10).to_dict(orient="records")
    columns = [
        {"name": col, "dtype": str(df[col].dtype)}
        for col in df.columns
    ]
    stats = {}
    for col in df.select_dtypes(include=["number"]).columns:
        stats[col] = {
            "mean": round(float(df[col].mean()), 2),
            "min": round(float(df[col].min()), 2),
            "max": round(float(df[col].max()), 2),
            "count": int(df[col].count()),
        }

    return {
        "columns": columns,
        "row_count": len(df),
        "preview": preview,
        "stats": stats,
    }


def generate_chart(df: pd.DataFrame, chart_type: str, x_col: str, y_col: str) -> str:
    """生成图表并返回文件路径。"""
    os.makedirs(os.path.join(config.upload_dir, "charts"), exist_ok=True)

    plt.figure(figsize=(10, 6))
    if chart_type == "bar":
        plt.bar(df[x_col].astype(str), df[y_col])
    elif chart_type == "line":
        plt.plot(df[x_col].astype(str), df[y_col])
    elif chart_type == "pie":
        plt.pie(df[y_col], labels=df[x_col].astype(str), autopct="%1.1f%%")
    elif chart_type == "hist":
        plt.hist(df[y_col].dropna(), bins=20)

    plt.title(f"{y_col} by {x_col}" if chart_type not in ["hist"] else f"Distribution of {y_col}")
    plt.xticks(rotation=45)
    plt.tight_layout()

    import time
    filename = f"chart_{int(time.time())}.png"
    filepath = os.path.join(config.upload_dir, "charts", filename)
    plt.savefig(filepath, dpi=100)
    plt.close()

    return f"/uploads/charts/{filename}"
