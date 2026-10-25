#!/usr/bin/env python3
"""Makes small WebP copies of the PNG card artwork for the shop shelves (res/thumbs/<occasion>/<n>.webp).
Run after adding PNG cards:  python3 scripts/make-thumbs.py     (needs Pillow: pip install pillow)
Optional: if a thumbnail is missing the shop falls back to the full-size image. SVG cards need no thumbnail."""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
WIDTH = 720
made = saved = 0
for src in sorted((ROOT / "res").glob("*/*.png")):
    if src.parent.name == "thumbs":
        continue
    dst = ROOT / "res" / "thumbs" / src.parent.name / (src.stem + ".webp")
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=82, method=6)
    made += 1; saved += src.stat().st_size - dst.stat().st_size
    print(f"{dst.relative_to(ROOT)}  {dst.stat().st_size // 1024} KB")
print(f"{made} thumbnails written, {saved // 1024} KB lighter")
