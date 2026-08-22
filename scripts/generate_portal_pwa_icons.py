#!/usr/bin/env python3
"""RNOS-M2 — Generate PNG PWA icons for portal-web (192 + 512)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "services" / "portal-web" / "public" / "icons"
BG = "#1a3a5c"
FG = "#ffffff"
SUB = "#93c5fd"


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
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
        fill="#0f172a",
        outline="#334155",
        width=max(1, size // 256),
    )
    title = _font(max(16, size // 8), bold=True)
    subtitle = _font(max(10, size // 12), bold=True)
    draw.text((size // 2, int(size * 0.42)), "PTT", fill=FG, font=title, anchor="mm")
    draw.text((size // 2, int(size * 0.58)), "Portal", fill=SUB, font=subtitle, anchor="mm")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        path = OUT / f"icon-{size}.png"
        render(size).save(path, format="PNG", optimize=True)
        print(f"OK  {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
