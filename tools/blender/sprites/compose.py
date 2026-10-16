"""numpy compositing helpers shared by the build and contact_sheet.py (no bpy)."""
import numpy as np


def over(dst, src, x, y):
    """Alpha-over `src` RGBA uint8 onto `dst` (H,W,4) at integer (x, y) (binary alpha art)."""
    h, w = src.shape[:2]
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + w, dst.shape[1]), min(y + h, dst.shape[0])
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    m = s[..., 3] > 0
    d = dst[y0:y1, x0:x1]
    d[m] = s[m]


def add(dst, src, x, y, gain=1.0):
    """Additive glow: `src` RGBA (alpha = on/off) added to dst RGB."""
    h, w = src.shape[:2]
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + w, dst.shape[1]), min(y + h, dst.shape[0])
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    m = s[..., 3] > 0
    d[..., :3][m] = np.minimum(255, d[..., :3][m].astype(int) + (s[..., :3][m] * gain).astype(int)).astype(np.uint8)
    d[..., 3][m] = 255


def shade(base, level):
    """Runtime ramp: shade step `level` (0..4) of a base colour (see post.SHADE_MULT; cooler shadows, warmer lights)."""
    from . import post
    m = post.SHADE_MULT[level]
    x = np.array(base, float) * m
    if m < 1:
        x = x * np.array([0.88, 0.96, 1.18]) ** ((1 - m) * 1.5)
    elif m > 1:
        x = x * np.array([1.04, 1.0, 0.92])
    return np.clip(x, 0, 255).astype(np.uint8)


def remap_keys(img, colours):
    """Palette swap, as the runtime shader does: a pixel that is s*K for team key K (s in 0.3..1.4, exactly one of
    the 5 ramp steps) becomes shade(colour, step). colours: {'team.skin': (r,g,b), ...}."""
    from . import post
    out = img.copy()
    rgb = img[..., :3].astype(float)
    for name, col in colours.items():
        k = np.array(post.TEAM_VEC[name], float) * 255
        nz = k > 0
        s = rgb[..., nz] / k[nz]
        sm = s.mean(-1)
        match = (np.abs(s - sm[..., None]).max(-1) < 0.04) & (sm > 0.25) & (sm < 1.45) & (img[..., 3] > 0)
        if (~nz).any():
            match &= np.all(rgb[..., ~nz] < 6, axis=-1)
        lvl = np.abs(sm[..., None] - np.array(post.KEY_LEVELS)).argmin(-1)
        for L in range(5):
            out[..., :3][match & (lvl == L)] = shade(col, L)
    return out
