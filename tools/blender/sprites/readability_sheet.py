"""Crew readability sheets, stage 2 (plain python3 + numpy + PIL): composites the cached renders of readability.py
with each variant's post options onto a deck background, labelled, at 1x and 2x (nearest). Also writes
outline-diagnosis.png (shipped layer composite vs one composite outline, 4x).

  python3 -I tools/blender/sprites/readability_sheet.py [outdir]"""
import json
import pickle
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose, post  # noqa: E402
from sprites import readability_spec as S  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUT = "/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/a1"
CW, CH, FEET = 78, 124, (39, 100)
BG = (14, 17, 22)
ORIGIN = (62 + 2, 112 + 2)      # feet in the (padded by 1 more) character canvas
PX = 64 / 2 ** 0.5
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


def n4(m):
    return [SHIFT(m, dy, dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]


def n8(m):
    return [SHIFT(m, dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]


def smooth_sil(rgb, op):
    """One pass: drop spur pixels (<=2 of 8 neighbours), fill notches (>=5 of 8), filled pixels copy a neighbour."""
    cnt = sum(m.astype(int) for m in n8(op))
    cnt4 = sum(m.astype(int) for m in n4(op))
    rem = op & ((cnt <= 2) | (cnt4 <= 1))
    fill = ~op & (cnt >= 5) & (cnt4 >= 2)
    out = rgb.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        src = SHIFT(rgb, dy, dx)
        sm = SHIFT(op, dy, dx)
        take = fill & sm & (out.sum(-1) == 0)
        out[take] = src[take]
    return out, (op & ~rem) | fill


def outline(rgb, op, mode):
    cnt = np.zeros(op.shape)
    ns = np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx).astype(float) * o[..., None]
        cnt += o
    ring = ~op & (cnt > 0)
    mean = ns / np.maximum(cnt, 1)[..., None]
    if mode == "colored":
        col = mean * 0.42 + np.array([4, 5, 10.0])
    else:
        col = post.snap_base(mean * 0.165 + np.array([3.6, 4.5, 8.1]))
    out = np.where(ring[..., None], col, rgb).astype(np.uint8)
    return out, op | ring, ring


def lighten_skin(rgb, a, head):
    (x0, y0), (x1, y1) = head
    x0, x1, y0, y1 = x0 + 1, x1 + 1, y0 + 1, y1 + 1       # canvas padded by 1
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ry = abs(y1 - y0) * 0.62 + 2
    yy, xx = np.mgrid[:rgb.shape[0], :rgb.shape[1]]
    inside = (((xx - cx) / 11.0) ** 2 + ((yy - cy) / ry) ** 2) < 1
    keys = post.KEYS.astype(np.uint8)
    out = rgb.copy()
    k = post.TEAMS.index("team.skin")
    for lv in range(4):
        m = inside & (a > 0) & (rgb == keys[k * 5 + lv]).all(-1)
        out[m] = keys[k * 5 + min(lv + 1, 4)]
    return out


def sat(rgb, f):
    g = rgb.astype(float) @ np.array([0.3, 0.59, 0.11])
    return np.clip(g[..., None] + (rgb - g[..., None]) * f, 0, 255)


def build_sprite(res, char, v):
    """-> (rgba canvas, glow canvas) in the padded character frame (feet at ORIGIN), for one frame result."""
    P = v["post"]
    cols = dict(S.COLOURS[char])
    if P["vcon"]:
        cols["team.skin"] = tuple(min(255, int(c * 1.12)) for c in cols["team.skin"])
    H, W = res["layers"][0][2].shape[:2]
    cv = np.zeros((H + 2, W + 2, 4), np.uint8)
    glows = []
    for lid, order, rgba, g in res["layers"]:
        rgba = np.pad(rgba, ((1, 1), (1, 1), (0, 0)))
        if P["skinhl"] and lid == "body":
            rgba[..., :3] = lighten_skin(rgba[..., :3], rgba[..., 3], res["head"])
        rgba = compose.remap_keys(rgba, cols)
        tag = lid.split(".")[0] + "." + lid.split(".")[1] if "." in lid else lid
        if tag in ("torso.work_shirt", "torso.tee", "legs.cargo_pants", "gear.belt"):
            rgb = rgba[..., :3].astype(float)
            if P["sat"] != 1.0:
                rgb = sat(rgb, P["sat"])
            if P["vcon"]:
                rgb = rgb * (1.3 if tag.startswith("torso") else 0.72 if tag.startswith("legs") else 1.0)
            rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
        compose.over(cv, rgba, 0, 0)
        if g is not None:
            glows.append(np.pad(g, ((1, 1), (1, 1), (0, 0))))
    gl = np.zeros_like(cv)
    for g in glows:
        compose.over(gl, g, 0, 0)
    op = cv[..., 3] > 0
    ring = None
    if P["smooth"]:
        rgb, op = smooth_sil(cv[..., :3], op)
        cv[..., :3], cv[..., 3] = rgb, op * 255
    if P["sil"]:
        rgb, op, ring = outline(cv[..., :3], op, P["sil"])
        cv[..., :3], cv[..., 3] = rgb, op * 255
    if P["rim"]:
        core = op & ~ring if ring is not None else op
        if ring is None and v["cfg"]["outline"] != "none":
            core = op & np.logical_and.reduce(n4(op))
        rim = core & ~SHIFT(core, 0, 1)
        c = np.array((120, 205, 255) if P["rim"] == "cool" else (255, 185, 110), float)
        cv[..., :3][rim] = np.clip(cv[..., :3][rim] * 0.35 + c * 0.75, 0, 255).astype(np.uint8)
    if P["cyan"]:
        r, g_, b = (cv[..., i].astype(int) for i in range(3))
        m = (op & (b > 190) & (g_ > 160) & (r < 150) & (b - r > 90))
        cv[..., :3][m] = (110, 255, 255)
    return cv, gl


def tile():
    man = json.loads((ROOT / "public/assets/manifest.json").read_text())
    a = man["assets"]["tile.floor.a"]
    f = a["frame"]
    img = np.array(Image.open(ROOT / "public/assets" / man["sheets"][a["sheet"]]["image"]).convert("RGBA"))
    return img[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], a["anchor"]


def cell_bg():
    t, an = tile()
    cv = np.zeros((CH, CW, 4), np.uint8)
    cv[..., :3], cv[..., 3] = BG, 255
    for gx in (-1, 0, 1):
        for gy in (-1, 0, 1):
            compose.over(cv, t, FEET[0] + (gx - gy) * 32 - an["x"], FEET[1] + (gx + gy) * 16 - an["y"])
    return cv


def halo(cell, gl, x, y):
    gm = gl[..., 3] > 0
    for ring, k in ((1, 0.55), (2, 0.2)):
        cur = gm.copy()
        col = gl[..., :3].astype(float)
        acc = np.zeros_like(col)
        for _ in range(ring):
            new = cur.copy()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                s = SHIFT(cur, dy, dx)
                acc = np.where((s & ~cur)[..., None], np.maximum(acc, SHIFT(col, dy, dx)), acc)
                new |= s
            col = np.where((new & ~cur)[..., None], acc, col)
            ring_mask, cur = new & ~cur, new
        m = ring_mask
        patch = np.zeros(cell.shape, float)
        h, w = m.shape
        x0, y0 = max(x, 0), max(y, 0)
        x1, y1 = min(x + w, cell.shape[1]), min(y + h, cell.shape[0])
        mm = m[y0 - y:y1 - y, x0 - x:x1 - x]
        cc = col[y0 - y:y1 - y, x0 - x:x1 - x]
        sub = cell[y0:y1, x0:x1, :3].astype(float)
        sub[mm] = np.minimum(255, sub[mm] + cc[mm] * k)
        cell[y0:y1, x0:x1, :3] = sub.astype(np.uint8)


def render_cell(res, char, v, bg):
    cell = bg.copy()
    cv, gl = build_sprite(res, char, v)
    x, y = FEET[0] - ORIGIN[0], FEET[1] - ORIGIN[1]
    compose.over(cell, cv, x, y)
    if v["post"]["halo"]:
        halo(cell, gl, x, y)
    compose.add(cell, gl, x, y, 1.5 if v["post"]["cyan"] else 1.0)
    return cell


def load_res(out, v):
    return {c: pickle.loads((out / "cache" / f"{S.render_key(v['cfg'], c)}.pkl").read_bytes()) for c in ("eng", "crew")}


def sheet(out, variants, title, name):
    font = ImageFont.load_default()
    bg = cell_bg()
    BW, GAP, M, LINE = 6 * CW + 10, 14, 12, 12 + 12 + CH + 10
    per = 4
    rows = {}
    for v in variants:
        rows.setdefault(v["row"], []).append(v)
    height = M + 16 + sum(28 + ((len(vs) + per - 1) // per) * LINE for vs in rows.values())
    W = M * 2 + per * BW + (per - 1) * GAP
    im = Image.new("RGB", (W, height), (6, 8, 11))
    d = ImageDraw.Draw(im)
    d.text((M, M - 2), title, fill=(150, 160, 170), font=font)
    y = M + 16
    for r, vs in rows.items():
        d.rectangle([M, y + 9, W - M, y + 9], fill=(60, 66, 74))
        d.rectangle([M, y, M + 8 * len(S.ROW_TITLES[r]) + 6, y + 12], fill=(6, 8, 11))
        d.text((M + 2, y), S.ROW_TITLES[r], fill=(255, 214, 90), font=font)
        y += 28
        for n, v in enumerate(vs):
            bx, by = M + (n % per) * (BW + GAP), y + (n // per) * LINE
            res = load_res(out, v)
            d.text((bx, by), v["label"], fill=(255, 255, 255), font=font)
            for k, (char, fname) in enumerate([(c, f[0]) for c in ("eng", "crew") for f in S.FRAMES]):
                cell = render_cell(res[char][fname], char, v, bg)
                cx = bx + k * (CW + 2)
                im.paste(Image.fromarray(cell[..., :3]), (cx, by + 24))
                tag = ("ENG " if char == "eng" else "CREW ") + {"se_idle": "SE", "nw_idle": "NW", "se_walk": "WALK"}[fname]
                d.text((cx + 1, by + 12), tag, fill=(130, 190, 150) if char == "eng" else (150, 160, 210), font=font)
        y += ((len(vs) + per - 1) // per) * LINE
    im.save(out / f"{name}.png")
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(out / f"{name.replace('1x', '2x')}.png")
    print("wrote", out / f"{name}.png", im.size)


def shipped(man, assets, layers, d, clip, frame, colours):
    cv = np.zeros((134, 110, 4), np.uint8)
    cv[..., :3] = BG
    cv[..., 3] = 255
    ax = ay = None
    for lid in sorted(layers, key=lambda i: man["assets"]["crew.human." + i]["order"]):
        a = man["assets"]["crew.human." + lid]
        img = np.array(Image.open(assets / man["sheets"][a["sheet"]]["image"]).convert("RGBA"))
        c = a["clips"][clip]
        col = c["start"] + frame
        fw, fh = a["frameW"], a["frameH"]
        sl = compose.remap_keys(img[d * fh:(d + 1) * fh, col * fw:(col + 1) * fw], colours)
        compose.over(cv, sl, 55 - a["anchor"]["x"], 110 - a["anchor"]["y"])
    return cv


def diagnosis(out):
    """Shipped per-layer-outline composite vs one composite outline, 4x on a mid-grey ground so the rings show, plus the
    dark-pixel (ring) masks. Counts: dark pixels, and 'orphans' = dark pixels with <2 dark 4-neighbours (broken ring)."""
    global BG
    assets = ROOT / "public/assets"
    man = json.loads((assets / "manifest.json").read_text())
    nov = next(v for v in S.ALL if v["label"] == "composite dark")
    resn = load_res(out, nov)["eng"]
    old, BG = BG, (96, 108, 120)
    flat = np.dstack([np.full((CH, CW, 3), BG, np.uint8), np.full((CH, CW), 255, np.uint8)])
    panels, stats = [], []
    for fname, d in (("se_idle", 0), ("nw_idle", 4)):
        a = shipped(man, assets, S.layer_ids("eng", "base"), d, "idle", 0, S.COLOURS["eng"])[8:132, 20:98, :3]
        b = render_cell(resn[fname], "eng", nov, flat)[..., :3]
        for im in (a, b):
            dk = (im < 48).all(-1)
            nb = sum(SHIFT(dk, dy, dx).astype(int) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            stats.append((int(dk.sum()), int((dk & (nb < 2)).sum())))
        panels += [a, b, np.where((a < 48).all(-1)[..., None], 255, 0).astype(np.uint8).repeat(3, -1) if False else
                   np.repeat(np.where((a < 48).all(-1), 255, 30).astype(np.uint8)[..., None], 3, -1),
                   np.repeat(np.where((b < 48).all(-1), 255, 30).astype(np.uint8)[..., None], 3, -1)]
    row = np.hstack([np.pad(p, ((0, 0), (0, 4), (0, 0))) for p in panels])
    im = Image.fromarray(row).resize((row.shape[1] * 3, row.shape[0] * 3), Image.NEAREST)
    dr = ImageDraw.Draw(im)
    for i, t in enumerate(["SE shipped", "SE composite ring", "ring mask shipped", "ring mask composite"] * 2):
        dr.text((6 + i * 82 * 3, 4), t, fill=(255, 255, 255))
    im.crop((0, 0, im.width // 2, im.height)).save(out / "outline-diagnosis.png")
    im.crop((im.width // 2, 0, im.width, im.height)).save(out / "outline-diagnosis-nw.png")
    BG = old
    print("dark px (total, orphan) SE shipped/composite, NW shipped/composite:", stats)


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
    a = [v for v in S.VARIANTS if v["row"] <= 4]
    b = [v for v in S.VARIANTS if v["row"] > 4] + S.COMBO
    sheet(out, a, "readability sheet A: knobs 1-4 (one knob per variant vs baseline). Per variant: engineer SE | NW | walk SE, plain crew SE | NW | walk SE", "readability-1x-a")
    sheet(out, b, "readability sheet B: knobs 5-9 and COMBO", "readability-1x-b")
    diagnosis(out)


main()
