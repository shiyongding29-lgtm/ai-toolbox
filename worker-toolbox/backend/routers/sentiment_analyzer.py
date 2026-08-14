"""Sentiment Analyzer API — 情感分析（正面/负面/中性）。"""
import torch
from fastapi import APIRouter
from pydantic import BaseModel
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification

router = APIRouter(prefix="/api/sentiment", tags=["sentiment-analyzer"])

MODEL_NAME = "distilbert-base-multilingual-cased"
LABELS = ["negative", "neutral", "positive"]

_model = None; _tokenizer = None; _device = None

def _load():
    global _model, _tokenizer, _device
    if _model is not None: return
    _device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    _tokenizer = DistilBertTokenizer.from_pretrained(MODEL_NAME)
    _model = DistilBertForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=3)
    _model.to(_device); _model.eval()
    # Note: this loads untrained classification head. Train with sentiment data for better results.
    print(f"✅ Sentiment model loaded ({_device})")


class SentimentRequest(BaseModel):
    text: str = ""
    texts: list[str] = []


@router.post("/analyze")
def analyze(req: SentimentRequest):
    """分析单条或多条文本情感。"""
    _load()
    texts = req.texts if req.texts else [req.text] if req.text else []
    if not texts: return {"code": 400, "msg": "No text", "data": None}

    results = []
    for t in texts:
        inputs = _tokenizer(t, return_tensors='pt', truncation=True, padding=True, max_length=128)
        inputs = {k: v.to(_device) for k, v in inputs.items()}
        with torch.no_grad():
            scores = torch.softmax(_model(**inputs).logits, dim=-1)[0]
            pred = torch.argmax(scores).item()
        results.append({
            "text": t[:200],
            "sentiment": LABELS[pred],
            "confidence": round(scores[pred].item(), 4),
            "scores": {LABELS[i]: round(scores[i].item(), 4) for i in range(3)}
        })

    if len(results) == 1:
        return {"code": 0, "msg": "ok", "data": results[0]}
    return {"code": 0, "msg": "ok", "data": {"results": results, "summary": {
        "positive": sum(1 for r in results if r['sentiment']=='positive'),
        "negative": sum(1 for r in results if r['sentiment']=='negative'),
        "neutral": sum(1 for r in results if r['sentiment']=='neutral'),
    }}}
