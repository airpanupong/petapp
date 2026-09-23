from __future__ import annotations

import io
import logging

from PIL import Image, ImageDraw, ImageFont

from app.services.storage import get_storage

logger = logging.getLogger(__name__)


def _font(size: int):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", size)
    except Exception:  # noqa: BLE001
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
        except Exception:  # noqa: BLE001
            return ImageFont.load_default()


def generate_share_card(
    *,
    kind: str,
    title: str,
    subtitle: str,
    location: str,
    date_text: str,
    key_suffix: str,
) -> str:
    """Create a simple share card PNG and upload to S3. Returns public URL."""
    width, height = 1080, 1350
    bg = (253, 233, 233) if kind == "lost" else (230, 246, 243)
    accent = (216, 64, 64) if kind == "lost" else (15, 118, 110)
    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((60, 60, width - 60, height - 60), radius=48, fill=(255, 255, 255))
    badge = "LOST PET" if kind == "lost" else "FOUND PET"
    draw.rounded_rectangle((120, 140, 460, 230), radius=24, fill=accent)
    draw.text((150, 160), badge, fill=(255, 255, 255), font=_font(42))

    draw.text((120, 300), title[:40], fill=(28, 40, 36), font=_font(72))
    draw.text((120, 420), subtitle[:60], fill=(90, 110, 104), font=_font(40))
    draw.text((120, 560), "Last seen / Found at", fill=(140, 150, 146), font=_font(28))
    draw.text((120, 620), (location or "—")[:70], fill=(28, 40, 36), font=_font(44))
    draw.text((120, 760), date_text[:40], fill=(90, 110, 104), font=_font(36))
    draw.text((120, 1100), "PetApp · Help pets get home", fill=accent, font=_font(32))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    key = f"share-cards/{key_suffix}.png"
    return get_storage().upload_bytes(key=key, data=buf.getvalue(), content_type="image/png")
