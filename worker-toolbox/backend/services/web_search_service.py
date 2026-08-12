"""
网络搜索服务 — 提供 DuckDuckGo 搜索，返回标题/URL/摘要。
"""

import httpx
from bs4 import BeautifulSoup


class WebSearchService:
    """通过 DuckDuckGo HTML 搜索获取结果。"""

    BASE_URL = "https://html.duckduckgo.com/html/"

    def search(self, query: str, num_results: int = 5) -> list[dict]:
        """搜索并返回结果列表。"""
        try:
            resp = httpx.post(
                self.BASE_URL,
                data={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; WorkerToolbox/1.0)"},
                timeout=15,
                follow_redirects=True,
            )
            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            for item in soup.select(".result")[:num_results]:
                title_el = item.select_one(".result__title a")
                snippet_el = item.select_one(".result__snippet")
                if title_el:
                    results.append({
                        "title": title_el.get_text(strip=True),
                        "url": title_el.get("href", ""),
                        "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                    })
            return results
        except Exception:
            return []

    def fetch_page(self, url: str) -> str:
        """抓取网页文本内容。"""
        try:
            resp = httpx.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; WorkerToolbox/1.0)"},
                timeout=15,
                follow_redirects=True,
            )
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            # 去空行
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            return "\n".join(lines)[:15000]
        except Exception:
            return ""


web_search = WebSearchService()
