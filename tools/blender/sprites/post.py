"""numpy post-processing: palette quantization, mode downsample, outline, PNG writer. No bpy imports."""
import hashlib
import json
import struct
import zlib
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
PAL = json.loads((ROOT / "palette.json").read_text())
EXTRA = json.loads((ROOT / "tools/blender/palette_extra.json").read_text())   # neon extras, only for sprites that ask (select)
_BASE_PAL = dict(PAL)
SHADES = (0.42, 0.62, 0.82, 1.0, 1.22)


def _rgb(name):
    h = PAL[name]["hex"].lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def build_palette():
    """Palette colours expanded into shade ramps (cooler shadows, warmer highlights). Neon: lit + dim."""
    cols = []
    for name, v in PAL.items():
        if name == "empty":
            continue
        c = _rgb(name)
        if "emissive" in v:
            cols += [c, c * 0.18 + np.array([6, 8, 12]), c * 0.6, np.minimum(c * 1.0 + 60, 255)]
            continue
        for m in SHADES:
            x = c * m
            if m < 1:
                x = x * np.array([0.88, 0.96, 1.18]) ** ((1 - m) * 1.5)
            elif m > 1:
                x = x * np.array([1.04, 1.0, 0.92])
            cols.append(x)
    return np.clip(np.array(cols), 0, 255)


BASE = build_palette()
NB = len(BASE)

# ---- team (palette-swap) key colours ------------------------------------------------------------------------
# team.* materials are rendered with a pure key albedo; lighting scales it, so a lit pixel is (s*k) for a key
# vector k. Classification is exact-ish on the zeroed channels (no palette colour has them), then the scalar s is
# binned into 5 shade steps (0 = darkest). The output pixels are exact key colours the runtime can match.
TEAMS = ("team.skin", "team.hair", "team.cloth", "team.accent")
TEAM_VEC = {"team.skin": (1, 0, 1), "team.hair": (0, 1, 0), "team.cloth": (1, 1, 0), "team.accent": (0, 1, 1)}
KEY_LEVELS = (0.30, 0.47, 0.64, 0.82, 1.0)       # key channel value (0..1) of shade step 0..4
SHADE_EDGES = (0.32, 0.50, 0.68, 0.90)           # lit scalar s thresholds between steps (calibrated)
SHADE_MULT = (0.42, 0.62, 0.82, 1.0, 1.22)       # runtime: target = base colour * mult (see SHADES)


def key_color(team, level):
    v = round(KEY_LEVELS[level] * 255)
    return tuple(v * c for c in TEAM_VEC[team])


KEYS = np.array([key_color(t, l) for t in TEAMS for l in range(5)], float)
PALETTE = np.vstack([BASE, KEYS])


def _lut():
    g = (np.arange(32) * 8 + 4).astype(float)
    r, gg, b = np.meshgrid(g, g, g, indexing="ij")
    q = np.stack([r, gg, b], -1).reshape(-1, 3)
    out = np.empty(len(q), np.int32)
    w = np.array([2.0, 4.0, 3.0])
    for i in range(0, len(q), 2048):
        d = (((q[i:i + 2048, None, :] - BASE[None]) ** 2) * w).sum(-1)
        out[i:i + 2048] = d.argmin(1)
    return out.reshape(32, 32, 32)


LUT = _lut()

# 4 shade bands: the top two of the 5 ramp steps merge (steps 0..3 are used; step 4, the lightest key, is only produced
# by the skin highlight in human_render).
BAND = (0, 1, 2, 3, 3)


def _band_map():
    m = np.arange(len(PALETTE))
    i = 0
    for name, v in PAL.items():
        if name == "empty":
            continue
        if "emissive" in v:
            i += 4
            continue
        for lv in range(5):
            m[i + lv] = i + BAND[lv]
        i += 5
    for k in range(len(TEAMS)):
        for lv in range(5):
            m[NB + k * 5 + lv] = NB + k * 5 + BAND[lv]
    return m


BAND_MAP = _band_map()
MERGE_BANDS = False        # set while rendering crew (environment keeps the 5-step ramps)


def quantize(rgb):
    """rgb: (...,3) floats 0..255 -> palette index array."""
    rgb = np.clip(rgb, 0, 255)
    q = (rgb / 8).astype(int).clip(0, 31)
    idx = LUT[q[..., 0], q[..., 1], q[..., 2]]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lo = 4.0
    for t, team in enumerate(TEAMS):
        v = TEAM_VEC[team]
        zero = [c for c, k in zip((r, g, b), v) if k == 0]
        full = [c for c, k in zip((r, g, b), v) if k == 1]
        m = full[0] >= 14
        for z in zero:
            m = m & (z <= lo)
        if len(full) == 2:      # the cool ambient tint skews the two lit channels a little: allow a ratio band
            m = m & (full[1] >= 14) & (full[0] / np.maximum(full[1], 1) > 0.55) & (full[0] / np.maximum(full[1], 1) < 1.8)
        s = sum(full) / len(full) / 255.0
        lvl = np.searchsorted(SHADE_EDGES, s)
        idx = np.where(m, NB + t * 5 + lvl, idx)
    return BAND_MAP[idx] if MERGE_BANDS else idx


def scaled(thresh, S):
    """A coverage threshold written for 16 samples per pixel (SS 4), scaled to S*S samples (identical at S = 4)."""
    return max(1, -(-thresh * S * S // 16))


def blocks(a, S):
    h, w = a.shape[0] // S, a.shape[1] // S
    return a.reshape(h, S, w, S, *a.shape[2:]).swapaxes(1, 2).reshape(h, w, S * S, *a.shape[2:])


def _block_modes(idx, n):
    """idx (h*w, S*S) palette indices, n = 'not covered'. -> (h*w,) most frequent index, the lowest index on a tie
    (what a bincount().argmax() gives); n when a block has no covered pixel. Sorts each block and counts equal
    neighbours, so it never builds an (h*w, palette) histogram."""
    s = np.sort(idx, axis=1)
    eq = (s[:, :, None] == s[:, None, :]).sum(-1)
    eq[s == n] = 0
    return np.take_along_axis(s, eq.argmax(1)[:, None], 1)[:, 0]


def downsample(rgb, alpha, S, thresh, quant):
    """rgb (H*S,W*S,3) 0..255, alpha bool. Returns (rgb (h,w,3) uint8, opaque bool (h,w))."""
    am = blocks(alpha, S)
    cnt = am.sum(-1)
    opaque = cnt >= scaled(thresh, S)
    h, w = opaque.shape
    if quant:
        n = len(PALETTE)
        full = np.full(alpha.shape, n, np.int32)
        full[alpha] = quantize(rgb[alpha])                  # only covered pixels: most of a frame is empty
        sel = (cnt > 0).ravel()
        mode = np.zeros(h * w, np.int64)                    # empty blocks: PALETTE[0], as the histogram argmax gave
        mode[sel] = _block_modes(blocks(full, S).reshape(h * w, S * S)[sel], n)
        out = PALETTE[mode].reshape(h, w, 3)
    else:
        rb = blocks(rgb, S)
        wgt = am[..., None]
        out = (rb * wgt).sum(2) / np.maximum(wgt.sum(2), 1)
    return np.clip(out, 0, 255).astype(np.uint8), opaque


def _is_key(rgb):
    m = np.zeros(rgb.shape[:2], bool)
    for k in KEYS.astype(np.uint8):
        m |= (rgb == k).all(-1)
    return m


def snap_base(col):
    """Nearest BASE palette colour (never a team key)."""
    q = (np.clip(col, 0, 255) / 8).astype(int).clip(0, 31)
    return BASE[LUT[q[..., 0], q[..., 1], q[..., 2]]]


def outline(rgb, opaque, quant, vertical_only=False):
    """1px outer outline, darkened neighbour colour. Returns padded (rgb, opaque)."""
    rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
    op = np.pad(opaque, 1)
    nsum = np.zeros(rgb.shape, float)
    ncnt = np.zeros(op.shape, float)
    for dy, dx in ((1, 0), (-1, 0)) if vertical_only else ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = np.roll(op, (dy, dx), (0, 1))
        c = np.roll(rgb, (dy, dx), (0, 1)).astype(float)
        nsum += c * o[..., None]
        ncnt += o
    ring = (~op) & (ncnt > 0)
    mean = nsum / np.maximum(ncnt, 1)[..., None]
    col = mean * 0.3 * 0.55 + np.array([8, 10, 18.0]) * 0.45
    if quant:
        col = snap_base(col)
    rgb = np.where(ring[..., None], col, rgb).astype(np.uint8)
    return rgb, op | ring


def glow_down(rgb, S, thresh=3):
    """rgb (H*S,W*S,3) 0..255 emission render. Returns (h,w,4) uint8, premultiplied-friendly (black = nothing)."""
    lit = rgb.max(-1) > 40
    lb, rb = blocks(lit, S), blocks(rgb, S)
    cnt = lb.sum(-1)
    mean = (rb * lb[..., None]).sum(2) / np.maximum(cnt, 1)[..., None]
    on = cnt >= scaled(thresh, S)
    out = np.zeros(on.shape + (4,), np.uint8)
    out[..., :3] = np.where(on[..., None], np.clip(mean, 0, 255), 0)
    out[..., 3] = np.where(on, 255, 0)
    return out


def write_png(path, rgba):
    h, w = rgba.shape[:2]
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def to_rgba(rgb, op):
    return np.dstack([rgb, (op * 255).astype(np.uint8)])


def crop_box(op, extra=None):
    ys, xs = np.where(op if extra is None else (op | extra))
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


_STATES = {}


def _palette(sel):
    """A selection's palette entries: the game palette (False), it plus the extras that name no "set" (True), or those
    plus the extras of a named set (a family's own colours: adding them changes no other family's palette), or
    "only:<set>": that set's extras alone, so every pixel lands on one of the family's own ramps (no stray hue from
    another family's colours)."""
    if isinstance(sel, str) and sel.startswith("only:"):
        return {k: v for k, v in EXTRA.items() if v.get("set") == sel[5:]}
    if not sel:
        return dict(_BASE_PAL)
    out = {**_BASE_PAL, **{k: v for k, v in EXTRA.items() if not v.get("set")}}
    if isinstance(sel, str):
        out.update({k: v for k, v in EXTRA.items() if v.get("set") == sel})
    return out


def palette_digest(sel):
    """What a selection's quantisation depends on in the palette files: its entries, in order (the render cache's
    palette key: a colour added to another set leaves it unchanged)."""
    return hashlib.sha1(json.dumps(list(_palette(sel).items())).encode()).hexdigest()


def select(extra):
    """Switch the quantisation palette (_palette): the game palette (default), it plus the neon extras (True), or
    plus a named set's too. Existing sprites keep the plain one so their pixels never change when a colour is
    added."""
    global PAL, BASE, NB, PALETTE, LUT, BAND_MAP
    key = extra if isinstance(extra, str) else bool(extra)
    if key not in _STATES:
        PAL = _palette(key)
        BASE = build_palette()
        NB = len(BASE)
        PALETTE = np.vstack([BASE, KEYS])
        LUT = _lut()
        BAND_MAP = _band_map()
        _STATES[key] = (PAL, BASE, NB, PALETTE, LUT, BAND_MAP)
    PAL, BASE, NB, PALETTE, LUT, BAND_MAP = _STATES[key]
