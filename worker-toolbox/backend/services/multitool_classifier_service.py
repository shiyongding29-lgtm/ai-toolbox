"""Multi-Tool Detector — 判断用户请求是单步骤还是多步骤工作流。"""
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification

MODEL_PATH = '/Users/shijingying/my-ml-project/models/multitool_classifier'
_MODEL = None
_TOKENIZER = None
_DEVICE = None


def _load():
    global _MODEL, _TOKENIZER, _DEVICE
    if _MODEL is not None:
        return
    _DEVICE = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    _TOKENIZER = DistilBertTokenizer.from_pretrained(MODEL_PATH)
    _MODEL = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)
    _MODEL.to(_DEVICE); _MODEL.eval()
    print(f'✅ Multi-Tool 检测模型已加载 (设备: {_DEVICE})')


def predict_multi(text: str) -> dict:
    """返回 {'is_multi': bool, 'confidence': float}"""
    _load()
    inputs = _TOKENIZER(text, return_tensors='pt', truncation=True, padding=True, max_length=64)
    inputs = {k: v.to(_DEVICE) for k, v in inputs.items()}
    with torch.no_grad():
        scores = torch.softmax(_MODEL(**inputs).logits, dim=-1)[0]
        pred = torch.argmax(scores).item()
    return {'is_multi': pred == 1, 'confidence': round(scores[pred].item(), 4)}
