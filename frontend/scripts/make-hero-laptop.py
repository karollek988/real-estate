"""
Cuts the landing-page laptop out of its white studio background.

The source render (docs/design/landing-2026-10/kopanalys-new-design-laptoppicture.png)
is an RGB image on white, so placed over the hero photo it would show as a
white box. Every pixel of the laptop itself is kept as it is; only the
background and the soft contact shadow under the laptop become transparent
(the shadow turns into black at the matching opacity, so it still reads as a
shadow on any background). The result is cropped to the laptop.

    python frontend/scripts/make-hero-laptop.py

Needs Pillow and NumPy. Output: frontend/public/images/hero-laptop.png
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/design/landing-2026-10/kopanalys-new-design-laptoppicture.png"
OUT = ROOT / "frontend/public/images/hero-laptop.png"

# Darkness = 255 - the lightest channel: 0 for white, 255 for black.
BACKGROUND_MAX_DARKNESS = 60  # flood-fill limit from the border (white + light shadow)
BODY_MIN_DARKNESS = 150  # the laptop's bottom edge is at least this dark
PADDING = 6


def main() -> None:
    rgb = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
    height, width, _ = rgb.shape
    darkness = 255 - rgb.min(axis=2)

    # 1. Background: everything light that is connected to the image border.
    outside = np.zeros((height, width), dtype=bool)
    queue = deque()
    for x in range(width):
        queue.extend([(0, x), (height - 1, x)])
    for y in range(height):
        queue.extend([(y, 0), (y, width - 1)])
    while queue:
        y, x = queue.popleft()
        if outside[y, x] or darkness[y, x] >= BACKGROUND_MAX_DARKNESS:
            continue
        outside[y, x] = True
        if y > 0:
            queue.append((y - 1, x))
        if y < height - 1:
            queue.append((y + 1, x))
        if x > 0:
            queue.append((y, x - 1))
        if x < width - 1:
            queue.append((y, x + 1))

    # 2. The darker core of the shadow sits directly below the laptop's base:
    #    in every column, everything below the base's bottom edge is shadow.
    for x in range(width):
        column = darkness[:, x]
        y = height - 1
        while y >= 0 and column[y] < BODY_MIN_DARKNESS:
            outside[y, x] = True
            y -= 1

    # 3. Grow the outside by one pixel so the anti-aliased rim is softened too.
    grown = outside.copy()
    grown[1:, :] |= outside[:-1, :]
    grown[:-1, :] |= outside[1:, :]
    grown[:, 1:] |= outside[:, :-1]
    grown[:, :-1] |= outside[:, 1:]
    outside = grown

    # 4. Colour-to-alpha against white for everything outside the laptop.
    alpha = np.where(outside, np.clip((darkness - 2) / 253, 0, 1), 1.0)
    safe = np.maximum(alpha, 1e-6)[..., None]
    unmixed = np.clip((rgb - 255 * (1 - alpha[..., None])) / safe, 0, 255)
    colour = np.where(outside[..., None], unmixed, rgb)

    rgba = np.dstack([colour, alpha * 255]).round().astype(np.uint8)
    image = Image.fromarray(rgba, "RGBA")

    ys, xs = np.nonzero(rgba[..., 3] > 8)
    box = (
        max(int(xs.min()) - PADDING, 0),
        max(int(ys.min()) - PADDING, 0),
        min(int(xs.max()) + PADDING + 1, width),
        min(int(ys.max()) + PADDING + 1, height),
    )
    image = image.crop(box)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, optimize=True)
    print(f"{OUT.relative_to(ROOT)}: {image.size[0]}x{image.size[1]} (crop {box})")


if __name__ == "__main__":
    main()
