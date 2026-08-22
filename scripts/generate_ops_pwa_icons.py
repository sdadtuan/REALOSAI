#!/usr/bin/env python3
"""RNOS-41.1 — Generate PNG PWA icons for ops-web (192 + 512)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "services" / "ops-web" / "public" / "icons"
BG = "#17692f"
FG = "#ffffff"
SUB = "#e8f5e9"


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def render(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    radius = int(size * 0.1875)
    inset = int(size * 0.08)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=radius,
        fill="#2d6b35",
        outline="#1a1f16",
        width=max(1, size // 256),
    )
    title = _font(max(18, size // 7), bold=True)
    subtitle = _font(max(12, size // 11), bold=True)
    draw.text((size // 2, int(size * 0.42)), "PTT", fill=FG, font=title, anchor="mm")
    draw.text((size // 2, int(size * 0.58)), "CRM", fill=SUB, font=subtitle, anchor="mm")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        path = OUT / f"icon-{size}.png"
        render(size).save(path, format="PNG", optimize=True)
        print(f"OK  {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
