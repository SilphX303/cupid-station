"""Cut candidate photos out of dating-app screenshots.

Deterministic, model-free: app chrome is flat (near-uniform white/black plus
text), photos are large blocks with dense colour/texture. We score each pixel
row and column by saturation + local variance, then segment contiguous
high-score bands into rectangles.

Tuned against Hinge screenshots; the thresholds are deliberately generous —
the reviewer picks which crops to keep, so a false positive costs one click.
"""
from pathlib import Path

import numpy as np
from PIL import Image

# Thresholds are relative to the image WIDTH, never the height: a scrolling
# capture can be arbitrarily tall, which would dilute any height-based
# fraction until every photo is rejected (the bug that shipped first).
# Dating-app photos are near-full-width and roughly square-to-portrait.
MIN_H_FRAC_OF_W = 0.35  # a photo is at least 35% of the image width tall
MIN_W_FRAC = 0.35       # ...and at least 35% of the image width wide
ROW_SCORE_T = 0.25      # fraction of "photo-like" pixels for a row to count
ANALYSIS_W = 480        # analysis runs on a width-normalised copy


def _photo_mask(img: Image.Image) -> np.ndarray:
    """Boolean mask of pixels that look photographic rather than UI chrome."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = mx - mn                      # colourfulness
    gray = rgb.mean(axis=2)
    # local texture: absolute difference from a 1px-shifted copy, both axes
    tex = np.zeros_like(gray)
    tex[1:, :] += np.abs(gray[1:, :] - gray[:-1, :])
    tex[:, 1:] += np.abs(gray[:, 1:] - gray[:, :-1])
    return (sat > 0.12) | (tex > 0.06)


def _bands(scores: np.ndarray, min_len: int, threshold: float) -> list[tuple[int, int]]:
    """Contiguous index ranges where scores exceed threshold, gaps <=8px bridged."""
    hot = scores > threshold
    bands: list[tuple[int, int]] = []
    start = None
    gap = 0
    for i, h in enumerate(hot):
        if h:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap > 8:
                if i - gap - start >= min_len:
                    bands.append((start, i - gap))
                start, gap = None, 0
    if start is not None and len(hot) - start >= min_len:
        bands.append((start, len(hot)))
    return bands


def find_photos(path: Path) -> list[tuple[int, int, int, int]]:
    """Return candidate photo boxes as (left, top, right, bottom) in original pixels."""
    orig = Image.open(path)
    if orig.width > ANALYSIS_W:
        img = orig.resize((ANALYSIS_W, max(1, round(orig.height * ANALYSIS_W / orig.width))))
    else:
        img = orig.copy()
    scale = orig.width / img.width
    mask = _photo_mask(img)
    h, w = mask.shape
    min_h = int(w * MIN_H_FRAC_OF_W)
    min_w = int(w * MIN_W_FRAC)

    boxes = []
    for top, bottom in _bands(mask.mean(axis=1), min_h, ROW_SCORE_T):
        strip = mask[top:bottom]
        col_bands = _bands(strip.mean(axis=0), min_w, ROW_SCORE_T)
        for left, right in col_bands:
            # refine vertical extent within the column range
            sub = mask[top:bottom, left:right]
            rows = np.where(sub.mean(axis=1) > ROW_SCORE_T)[0]
            if rows.size == 0:
                continue
            t, b = top + rows.min(), top + rows.max() + 1
            if (b - t) >= min_h and (right - left) >= min_w:
                boxes.append(tuple(int(v * scale) for v in (left, t, right, b)))
    return boxes


def crop_photos(src: Path, out_dir: Path, stem: str) -> list[str]:
    """Crop detected photos from src into out_dir; returns created file names."""
    boxes = find_photos(src)
    if not boxes:
        return []
    img = Image.open(src).convert("RGB")
    names = []
    for i, box in enumerate(boxes):
        name = f"{stem}-crop{i}.jpg"
        img.crop(box).save(out_dir / name, "JPEG", quality=92)
        names.append(name)
    return names
