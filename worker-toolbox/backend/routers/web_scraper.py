"""Web Scraper — 提取网页正文内容。"""
import re
from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.llm_service import llm_service

router = APIRouter(prefix="/api/scraper", tags=["web-scraper"])

class ScrapeRequest(BaseModel):
    url: str = ""
    urls: list[str] = []


@router.post("/scrape")
async def scrape(req: ScrapeRequest):
    urls = req.urls if req.urls else [req.url] if req.url else []
    if not urls: return {"code": 400, "msg": "No URL provided", "data": None}

    results = []
    for url in urls[:5]:
        try:
            import httpx
            resp = httpx.get(url.strip(), timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            text = resp.text
            # Strip HTML tags
            text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            results.append({"url": url, "text": text[:10000], "length": len(text)})
        except Exception as e:
            results.append({"url": url, "text": "", "error": str(e)[:100]})

    combined = '\n\n---\n\n'.join(r.get('text', '') for r in results if r.get('text'))
    return {"code": 0, "msg": "ok", "data": {"results": results, "combined_text": combined}}
