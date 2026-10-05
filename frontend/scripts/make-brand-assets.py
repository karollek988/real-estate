"""
Derives the two web assets of the 2026-10 header and hero redesign from their
sources, without redrawing anything:

1. The logo mark. public/kopanalys-bostad-logo.png is the real Köpanalys logo,
   a dark disc on a white square (RGB, no transparency), so on the cream header
   it would show as a white box. The disc is cut out with an anti-aliased
   ellipse mask fitted to its dark pixels; every pixel inside it is kept as it
   is. Output: public/images/kopanalys-logo-mark.png (512 x 512, transparent).

2. The hero photo. docs/design/landing-2026-10/New-Landingpage-BK.png is a
   2.8 MB PNG of a photograph; the same pixels as a high-quality progressive
   JPEG are a fraction of that. next/image then serves resized AVIF/WebP from
   it. Output: public/images/hero-stockholm.jpg (same 1672 x 941 size).

    python frontend/scripts/make-brand-assets.py

Needs Pillow and NumPy.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO_SRC = ROOT / "frontend/public/kopanalys-bostad-logo.png"
LOGO_OUT = ROOT / "frontend/public/images/kopanalys-logo-mark.png"
HERO_SRC = ROOT / "docs/design/landing-2026-10/New-Landingpage-BK.png"
HERO_OUT = ROOT / "frontend/public/images/hero-stockholm.jpg"

LOGO_SIZE = 512
DISC_MAX_LUMINANCE = 128  # the disc is near black, the background near white
EDGE_BAND_PX = 1.6  # width of the anti-aliased rim, in source pixels
INNER_BAND_PX = 4  # band inside the rim repainted in the disc colour
HERO_JPEG_QUALITY = 88


def make_logo_mark() -> None:
    rgb = np.asarray(Image.open(LOGO_SRC).convert("RGB")).astype(np.float64)
    dark = rgb.mean(axis=2) < DISC_MAX_LUMINANCE
    ys, xs = np.nonzero(dark)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0 + 1) / 2, (y1 - y0 + 1) / 2

    h, w = dark.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    # Distance from the ellipse edge in (approximate) pixels: negative inside.
    norm = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    edge_distance = (norm - 1) * min(rx, ry)
    alpha = np.clip(0.5 - edge_distance / EDGE_BAND_PX, 0, 1)

    # The source's own edge is a blend of disc and white a few pixels wide;
    # paint the rim and a thin band inside it in the disc's own colour (the
    # artwork stays well clear of the edge) so no light fringe shows on a dark
    # background.
    rim = (alpha > 0) & (edge_distance > -INNER_BAND_PX)
    disc_colour = np.median(rgb[dark & (edge_distance < -8)], axis=0)
    rgb[rim] = disc_colour

    rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    pad = 2
    crop = Image.fromarray(rgba, "RGBA").crop((int(x0) - pad, int(y0) - pad, int(x1) + 1 + pad, int(y1) + 1 + pad))
    side = max(crop.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    square.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS).save(LOGO_OUT, optimize=True)
    print(f"{LOGO_OUT.relative_to(ROOT)}: {LOGO_SIZE}x{LOGO_SIZE}, {LOGO_OUT.stat().st_size // 1024} kB")


def make_hero_photo() -> None:
    photo = Image.open(HERO_SRC).convert("RGB")
    photo.save(HERO_OUT, "JPEG", quality=HERO_JPEG_QUALITY, optimize=True, progressive=True, subsampling="4:4:4")
    print(f"{HERO_OUT.relative_to(ROOT)}: {photo.width}x{photo.height}, {HERO_OUT.stat().st_size // 1024} kB")


if __name__ == "__main__":
    make_logo_mark()
    make_hero_photo()
