"""
Derives the web assets of the 2026-10 header and hero redesign from their
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

3. The hero's three step icons. docs/design/landing-2026-10/tre-steg-tryggare.png
   is the design of the steps under the hero laptop; the cards themselves are
   HTML, only their 3D icons come from the picture. Each icon is taken off its
   card with "colour to alpha" against the card's own colour: every pixel gets
   the smallest opacity that still reproduces it exactly on that colour, so
   soft shadows and highlights survive. The number badge beside it is left
   out (the page draws it). Output: public/images/steg-hitta.png,
   steg-analysera.png, steg-besluta.png.

    python frontend/scripts/make-brand-assets.py [logo] [hero] [steps]

With no argument it makes all three. Needs Pillow and NumPy.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO_SRC = ROOT / "frontend/public/kopanalys-bostad-logo.png"
LOGO_OUT = ROOT / "frontend/public/images/kopanalys-logo-mark.png"
HERO_SRC = ROOT / "docs/design/landing-2026-10/New-Landingpage-BK.png"
HERO_OUT = ROOT / "frontend/public/images/hero-stockholm.jpg"
STEPS_SRC = ROOT / "docs/design/landing-2026-10/tre-steg-tryggare.png"
STEPS_OUT_DIR = ROOT / "frontend/public/images"

LOGO_SIZE = 512
DISC_MAX_LUMINANCE = 128  # the disc is near black, the background near white
EDGE_BAND_PX = 1.6  # width of the anti-aliased rim, in source pixels
INNER_BAND_PX = 4  # band inside the rim repainted in the disc colour
HERO_JPEG_QUALITY = 88

# Per step icon: the area around it in tre-steg-tryggare.png (x0, y0, x1, y1,
# stopping short of the divider), the colour of its card, and the number
# badge to leave out (centre, radius) - all measured on the picture.
STEP_ICONS = {
    "hitta": ((60, 268, 335, 500), (0xF7, 0xF6, 0xF2), ((112, 293), 43)),
    "analysera": ((780, 268, 1040, 500), (0xF7, 0xF6, 0xF2), ((832, 290), 43)),
    "besluta": ((1540, 268, 1750, 500), (0x06, 0x3C, 0x2A), ((1524, 296), 46)),
}
STEP_NOISE_ALPHA = 0.06  # weaker than this is the card's own grain, not the icon
STEP_CONTENT_ALPHA = 0.3  # the icon's extent is measured on clearly visible pixels
STEP_MARGIN_PX = 10  # kept around that extent, for the soft shadows
STEP_EDGE_FADE_PX = 6  # alpha ramps in from the crop edge, so a cut shadow has no seam


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


def colour_to_alpha(rgb: np.ndarray, background: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """GIMP's colour to alpha: the least opaque colour that, over `background`, gives `rgb`."""
    diff = rgb - background
    lighter = np.where(diff > 0, diff / np.maximum(1 - background, 1e-6), 0)
    darker = np.where(diff < 0, -diff / np.maximum(background, 1e-6), 0)
    alpha = np.maximum(lighter, darker).max(axis=2)
    with np.errstate(divide="ignore", invalid="ignore"):
        colour = np.where(alpha[..., None] > 1e-6, diff / alpha[..., None] + background, 0)
    return np.clip(colour, 0, 1), np.clip(alpha, 0, 1)


def make_step_icons() -> None:
    reference = np.asarray(Image.open(STEPS_SRC).convert("RGB")).astype(np.float64) / 255
    for name, ((x0, y0, x1, y1), card, ((bx, by), badge_radius)) in STEP_ICONS.items():
        colour, alpha = colour_to_alpha(reference[y0:y1, x0:x1], np.array(card) / 255)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        alpha[np.hypot(xx - bx, yy - by) < badge_radius] = 0
        alpha[alpha < STEP_NOISE_ALPHA] = 0

        ys, xs = np.nonzero(alpha > STEP_CONTENT_ALPHA)
        top, left = max(ys.min() - STEP_MARGIN_PX, 0), max(xs.min() - STEP_MARGIN_PX, 0)
        bottom = min(ys.max() + 1 + STEP_MARGIN_PX, alpha.shape[0])
        right = min(xs.max() + 1 + STEP_MARGIN_PX, alpha.shape[1])
        colour, alpha = colour[top:bottom, left:right], alpha[top:bottom, left:right]

        h, w = alpha.shape
        ramp_y = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
        ramp_x = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
        alpha = alpha * np.clip(np.minimum(ramp_y, ramp_x) / STEP_EDGE_FADE_PX, 0, 1)

        out = STEPS_OUT_DIR / f"steg-{name}.png"
        rgba = np.dstack([colour, alpha]) * 255
        Image.fromarray(rgba.round().astype(np.uint8), "RGBA").save(out, optimize=True)
        print(f"{out.relative_to(ROOT)}: {w}x{h}, {out.stat().st_size // 1024} kB")


if __name__ == "__main__":
    import sys

    jobs = {"logo": make_logo_mark, "hero": make_hero_photo, "steps": make_step_icons}
    for job in sys.argv[1:] or jobs:
        jobs[job]()
