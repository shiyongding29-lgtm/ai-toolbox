"""QR Code Generator — 生成二维码图片。"""
import os
from fastapi import APIRouter
from pydantic import BaseModel
from backend.config import config

router = APIRouter(prefix="/api/qr", tags=["qr-generator"])

class QRRequest(BaseModel):
    text: str = ""
    size: int = 300


@router.post("/generate")
async def generate_qr(req: QRRequest):
    if not req.text.strip():
        return {"code": 400, "msg": "No text", "data": None}
    try:
        import qrcode
        from qrcode.image.styledpil import StyledPilImage
        from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
        qr = qrcode.QRCode(box_size=10, border=2)
        qr.add_data(req.text.strip())
        qr.make(fit=True)
        img = qr.make_image(image_factory=StyledPilImage, module_drawer=RoundedModuleDrawer())
        img = img.resize((req.size, req.size))
        os.makedirs(config.upload_dir, exist_ok=True)
        fname = f"qr_{os.urandom(4).hex()}.png"
        path = os.path.join(config.upload_dir, fname)
        img.save(path)
        return {"code": 0, "msg": "ok", "data": {"url": f"/uploads/{fname}"}}
    except Exception as e:
        return {"code": 500, "msg": str(e)[:200], "data": None}
