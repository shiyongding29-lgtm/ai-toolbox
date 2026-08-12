"""PDF Toolkit — 合并、拆分、提取、OCR。"""
import os, tempfile
from fastapi import APIRouter, UploadFile, File, Form
from backend.config import config

router = APIRouter(prefix="/api/pdf", tags=["pdf-toolkit"])

@router.post("/extract")
async def pdf_extract(file: UploadFile = File(...)):
    """提取 PDF 文字。"""
    try:
        import pdfplumber
        contents = await file.read()
        text_parts = []
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(contents); tmp_path = tmp.name
        try:
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t: text_parts.append(t)
        finally:
            os.unlink(tmp_path)
        return {"code": 0, "msg": "ok", "data": {"text": '\n\n'.join(text_parts), "pages": len(text_parts)}}
    except Exception as e:
        return {"code": 500, "msg": str(e)[:200], "data": None}

@router.post("/merge")
async def pdf_merge(files: list[UploadFile] = File(...)):
    """合并多个 PDF。"""
    try:
        from PyPDF2 import PdfMerger
        merger = PdfMerger()
        for f in files:
            merger.append(f.file)
        os.makedirs(config.upload_dir, exist_ok=True)
        out_name = f"merged_{os.urandom(4).hex()}.pdf"
        out_path = os.path.join(config.upload_dir, out_name)
        merger.write(out_path); merger.close()
        return {"code": 0, "msg": "ok", "data": {"url": f"/uploads/{out_name}"}}
    except Exception as e:
        return {"code": 500, "msg": str(e)[:200], "data": None}

@router.post("/split")
async def pdf_split(file: UploadFile = File(...), pages: str = Form("1")):
    """提取指定页面。pages=1,3,5-7"""
    try:
        from PyPDF2 import PdfReader, PdfWriter
        contents = await file.read()
        reader = PdfReader(tempfile.NamedTemporaryFile(suffix='.pdf', delete=False))
        # Write to temp then read
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(contents); tmp_path = tmp.name
        reader = PdfReader(tmp_path)
        writer = PdfWriter()
        page_nums = set()
        for p in pages.split(','):
            p = p.strip()
            if '-' in p:
                a, b = p.split('-')
                page_nums.update(range(int(a)-1, int(b)))
            else:
                page_nums.add(int(p)-1)
        for i in sorted(page_nums):
            if 0 <= i < len(reader.pages):
                writer.add_page(reader.pages[i])
        os.makedirs(config.upload_dir, exist_ok=True)
        out_name = f"split_{os.urandom(4).hex()}.pdf"
        out_path = os.path.join(config.upload_dir, out_name)
        with open(out_path, 'wb') as f:
            writer.write(f)
        os.unlink(tmp_path)
        return {"code": 0, "msg": "ok", "data": {"url": f"/uploads/{out_name}", "extracted": len(writer.pages)}}
    except Exception as e:
        return {"code": 500, "msg": str(e)[:200], "data": None}
