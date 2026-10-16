"""Crew READABILITY variant renderer (stage 1; stage 2 is readability_sheet.py). Renders only a handful of frames
(SE idle 0, NW idle 0, SE walk 2) of an engineer and a plain crew member for every distinct render config in
readability_spec.py, with the real crew pipeline (CC0 base, layered holdout render, palette quantize, key colours).
Results are cached per config in <out>/cache/*.pkl so re-runs only render new configs.

  blender -b --factory-startup --python tools/blender/sprites/readability.py -- [outdir]

Env READABILITY_GLB overrides the base character (default public/assets/crew/human/base_cc0.glb, regenerate it
with tools/blender/crew/base_import.py). Knob -> pipeline default:
  hpx -> human_base.HEIGHT_UNITS; hs -> human_render.HEAD_SCALE; hf/sh -> bone scales in pose_frame / TORSO_W;
  bands -> post.SHADE_EDGES/KEY_LEVELS + palette ramp; outline -> human_render.render_item / post.ring_outline."""
import math
import os
import pickle
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose, core, post  # noqa: E402
from sprites import human_base as hb, human_render as hr  # noqa: E402
from sprites.human_base import Item  # noqa: E402
from sprites.rigid import RigidSet  # noqa: E402
from sprites import readability_spec as S  # noqa: E402

DEFAULT_OUT = "/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/a1"
hr.H, hr.ORIGIN = 130, (62, 112)          # taller canvas: the 72 px / heroic variants are taller than 108
ORIG_RING, ORIG_Q = post.ring_outline, post.quantize
_COL = {}
_ORIG = {}


def band_map(n):
    """PALETTE index -> index with the 5 shade steps of every ramp merged into `n` bands."""
    tab = {2: (1, 1, 1, 3, 3), 3: (1, 1, 2, 3, 3), 4: (0, 1, 2, 3, 3), "toon": (1, 1, 3, 3, 4)}[n]
    m = np.arange(len(post.PALETTE))
    i = 0
    for name, v in post.PAL.items():
        if name == "empty":
            continue
        if "emissive" in v:
            i += 4
            continue
        for lv in range(5):
            m[i + lv] = i + tab[lv]
        i += 5
    for k in range(len(post.TEAMS)):
        for lv in range(5):
            m[post.NB + k * 5 + lv] = post.NB + k * 5 + tab[lv]
    return m


def ring_coloured(rgb, opaque, full):
    """Like post.ring_outline but the ring is a darkened version of the neighbour's REAL (palette-swapped) colour."""
    a = np.dstack([rgb, np.full(opaque.shape, 255, np.uint8)])
    stand = compose.remap_keys(a, _COL)[..., :3]
    stand = np.pad(stand, ((1, 1), (1, 1), (0, 0)))
    rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
    op, fu = np.pad(opaque, 1), np.pad(full, 1)
    nsum, ncnt = np.zeros(rgb.shape, float), np.zeros(op.shape, float)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = np.roll(op, (dy, dx), (0, 1))
        nsum += np.roll(stand, (dy, dx), (0, 1)).astype(float) * o[..., None]
        ncnt += o
    ring = (~op) & (~fu) & (ncnt > 0)
    col = nsum / np.maximum(ncnt, 1)[..., None] * 0.42 + np.array([4, 5, 10.0])
    return np.where(ring[..., None], col, rgb).astype(np.uint8), op | ring


def build():
    arm, items = hr.build_items()
    by = {i.id: i for i in items}
    body = by["crew.human.body"]
    detail_full = body.objs[2:]
    rs = RigidSet(arm)
    h = rs.on("head")
    h.box((0, -0.122, 1.545), (0.035, 0.04, 0.055), "team.skin", bevel=0.006)
    for sx in (-1, 1):
        h.box((sx * 0.1, 0.0, 1.56), (0.025, 0.045, 0.06), "team.skin", bevel=0.006)
    detail_nomouth = rs.build()
    # simplified faces: 2px-ish dark eye blocks + a thick brow, no sclera
    for cyber in (False, True):
        rs = RigidSet(arm)
        h = rs.on("head")
        for sx in (1, -1):
            h.box((sx * 0.047, -0.124, 1.612), (0.1, 0.03, 0.036), "black")
            if not (cyber and sx == -1):
                h.box((sx * 0.046, -0.125, 1.563), (0.05, 0.02, 0.05), "black")
        if cyber:
            h.box((-0.044, -0.132, 1.566), (0.08, 0.024, 0.06), "gmD", bevel=0.006)
            h.box((-0.044, -0.147, 1.566), (0.06, 0.016, 0.05), "cyan")
        it = Item("eyes", ("cyber" if cyber else "organic") + "_simple", rs.build(), outline=False, glow=cyber)
        it.order = hr.ORDER["eyes"]
        items.append(it)
    for ob in detail_nomouth:
        ob.hide_render = True
    by = {i.id: i for i in items}
    return arm, items, by, body, detail_full, detail_nomouth


def skinned(items):
    return [ob for it in items for ob in it.objs if not ob.name.startswith("gear.")]


def set_surface(ctx, mode):
    """smooth*: interpolated normals on the skinned body/clothing/hair-cap meshes (rigid gear stays hard-surface).
    smooth_ng: also drops the secondary tone patches (shirt hem, pants pocket patch, sole/boot split)."""
    arm, items, by, *_ = ctx
    for ob in skinned(items):
        n = len(ob.data.polygons)
        ob.data.polygons.foreach_set("use_smooth", [mode != "base"] * n)
        ob.data.update()
    for lid, fn in (("crew.human.torso.work_shirt", lambda c: hb._shirt_col(c, "shirt").replace("team.cloth*0.8", "team.cloth")),
                    ("crew.human.legs.cargo_pants", lambda c: "boot" if c.z < 0.2 else "pants")):
        ob = by[lid].objs[0]
        if lid not in _ORIG:
            _ORIG[lid] = np.array([d.color[:3] for d in ob.data.color_attributes["Col"].data], np.float32)
        if mode == "smooth_ng":
            hb.paint(ob, lambda c, i, fn=fn: fn(c))  # noqa
        else:
            arr = _ORIG[lid]
            a = np.hstack([arr, np.ones((len(arr), 1), np.float32)])
            ob.data.color_attributes["Col"].data.foreach_set("color", a.ravel())


def pose(arm, cfg, char, d, clip, i, scale0):
    hr.HEAD_SCALE = 1.45 * cfg["hs"]
    hr.TORSO_W = 1.14 * cfg["sh"]
    arm.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
    arm.scale = (scale0 * (cfg["hpx"] and cfg["_hf"] or 1.0),) * 3
    name, f = next((n, fr) for c, k, n, fr in hr.clip_frames() if c == clip and k == i)
    hr.pose_frame(arm, clip, i, name, f)
    pb = arm.pose.bones
    for n in ("hand.L", "hand.R", "foot.L", "foot.R"):
        pb[n].scale = (cfg["hf"],) * 3
    if char == "eng" and cfg["arm"] != 1.0:
        pb["arm.L"].scale = (cfg["arm"],) * 3
    bpy.context.view_layer.update()
    hd, tl = pb["head"].head, pb["head"].tail
    mw = arm.matrix_world
    px = []
    for p in (hd, tl):
        sx, sy = core.screen_xy(np.array(mw @ p))
        px.append((hr.ORIGIN[0] + 1 + sx, hr.ORIGIN[1] + 1 - sy))
    return px


def render_cfg(ctx, cfg, char):
    arm, items, by, body, detail_full, detail_nomouth = ctx
    simple = cfg["face"] == "simple"
    for ob in detail_full + detail_nomouth:
        ob.hide_render, ob.is_holdout = True, False
    body.objs = body.objs[:2] + (detail_nomouth if simple else detail_full)
    by["crew.human.eyes.organic"].default = not simple
    by["crew.human.eyes.organic_simple"].default = simple
    for it in items:
        it.outline = cfg["outline"] != "none" and it.slot != "eyes" and it.slot != "implant.temple"
    _COL.clear()
    _COL.update(S.COLOURS[char])
    post.ring_outline = ring_coloured if cfg["outline"] == "colored" else ORIG_RING
    set_surface(ctx, cfg["surf"])
    nb = "toon" if cfg["surf"] == "toon" else cfg["bands"]
    if nb != 5:
        bm = band_map(nb)
        post.quantize = lambda rgb: bm[ORIG_Q(rgb)]
    else:
        post.quantize = ORIG_Q
    out = {}
    for fname, d, clip, i in S.FRAMES:
        head = pose(arm, cfg, char, d, clip, i, hb.SCALE)
        layers = []
        for lid in S.layer_ids(char, cfg["face"]):
            it = by["crew.human." + lid]
            rgba, g = hr.render_item(it, items)
            layers.append((lid, it.order, rgba, g))
        out[fname] = {"layers": sorted(layers, key=lambda t: t[1]), "head": head}
    post.quantize, post.ring_outline = ORIG_Q, ORIG_RING
    return out


def measure(res):
    ys = np.nonzero(np.any(np.stack([l[2][..., 3] > 0 for l in res["se_idle"]["layers"]]).any(0), axis=1))[0]
    return int(ys.max() - ys.min() + 1)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0] if argv else DEFAULT_OUT)
    (out / "cache").mkdir(parents=True, exist_ok=True)
    if os.environ.get("READABILITY_GLB"):
        hb.GLB = Path(os.environ["READABILITY_GLB"])
    ctx = build()
    base = dict(S.BASE, _hf=1.0)
    bfile = out / "cache" / "baseline_height.txt"
    if bfile.exists():
        h0 = int(bfile.read_text())
    else:
        h0 = measure(render_cfg(ctx, base, "crew"))
        bfile.write_text(str(h0))
    print("READABILITY baseline plain-crew height px (incl. outline):", h0)
    done = set()
    for v in S.ALL:
        cfg = dict(v["cfg"])
        cfg["_hf"] = (cfg["hpx"] / h0) if cfg["hpx"] else 1.0
        for char in ("eng", "crew"):
            key = S.render_key(v["cfg"], char)
            f = out / "cache" / f"{key}.pkl"
            if key in done or f.exists():
                continue
            done.add(key)
            f.write_bytes(pickle.dumps(render_cfg(ctx, cfg, char)))
            print("rendered", v["label"], char, key, flush=True)
    print("READABILITY done")


main()
