"""Livery mockup sheet (no Blender, no game): ship roofs composed from the real roof plating and livery mask sprites,
recoloured by the livery shader's model (roof_livery docstring; src/render/livery.ts), one row per scheme.

    python3 tools/blender/review/livery_mockup.py <assets dir> <out.png> [scheme,scheme,...] [--zoom N]

Ships are plain outlines (no hull walls or edge lips), bow at +x, so the sheet shows the paint and nothing else."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import roof_layout as rl  # noqa: E402
from sprites import roof_livery as lv  # noqa: E402

PATCH, INSET = (2, 1, 0, 1), (1, 2, 2, 0)                     # roof_variants / roofArt.ts
FAM_LUM = {"o": (0.299 * 0xb4 + 0.587 * 0x8a + 0.114 * 0x38) / 255, "b": (0.299 * 0x4a + 0.587 * 0x67 + 0.114 * 0x88) / 255}

SHIPS = {
    "corvette": ["....##############......",
                 "..##################....",
                 "######################..",
                 "########################",
                 "########################",
                 "######################..",
                 "..##################....",
                 "....##############......"],
    "frigate": ["......####################......",
                "....########################....",
                "..############################..",
                "################################",
                "################################",
                "################################",
                "################################",
                "..############################..",
                "....########################....",
                "......####################......"],
    "hauler": ["####..####..####....",
               "####################",
               "####################",
               "####################",
               "####################",
               "####################",
               "####################",
               "####..####..####...."],
}


def tile_id(x, y):
    """roofArt.roofTile: the plating sprite of roof tile (x, y) and its colour family."""
    mx, my, u, v = x // rl.M, y // rl.M, x % rl.M, y % rl.M
    L, col = rl.module_layout(mx, my), rl.module_colour(mx)
    base = f"roof.c{L}{col}.{u}{v}"
    p = next(i for i, q in enumerate(rl.LAYOUTS[L]) if q[0] <= u < q[0] + q[2] and q[1] <= v < q[1] + q[3])
    if rl._h(mx, my, 13) % 3 != 0 and p == INSET[L]:
        return f"{base}.inset", col
    if (mx + 2 * my) % 3 == 0 and p == PATCH[L]:
        return f"{base}.patch", col
    return base, col


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


class Atlas:
    def __init__(self, root):
        self.root, self.m, self.img = Path(root), json.loads((Path(root) / "manifest.json").read_text()), {}

    def get(self, aid):
        a = self.m["assets"].get(aid)
        if not a:
            return None
        sh = self.m["sheets"][a["sheet"]]["image"]
        if sh not in self.img:
            self.img[sh] = np.array(Image.open(self.root / sh).convert("RGBA")).astype(float)
        f = a["frame"]
        return self.img[sh][f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], a["anchor"]


def ship_image(atlas, outline, scheme):
    H, W = len(outline), len(outline[0])
    sc = lv.SCHEMES[scheme]
    plan = lv.plan(outline, scheme, seed=42)
    pad, lift = 40, 140                                              # roof sprites sit about 100 px above their anchor
    cw, chh = (W + H) * 32 + 2 * pad, (W + H) * 16 + 2 * pad + lift
    cv = np.zeros((chh, cw, 3))
    cv[:] = (12, 16, 22)
    ox, oy = H * 32 + pad, pad + lift
    tiles = sorted(((x, y) for y in range(H) for x in range(W) if outline[y][x] == "#"), key=lambda t: (t[0] + t[1], t[0]))
    plating = np.zeros(cv.shape[:2] + (4,))                          # the bare plating (relief reference) and its
    famlum = np.ones(cv.shape[:2])                                   # family's top-tone luminance, per pixel
    W3 = np.array([0.299, 0.587, 0.114])

    def blit(px, anchor, x, y):
        sx, sy = ox + (x - y) * 32 - anchor["x"], oy + (x + y) * 16 - anchor["y"]
        return (slice(sy, sy + px.shape[0]), slice(sx, sx + px.shape[1])), px[..., 3] > 127

    for x, y in tiles:                                               # plating, back to front
        bid, fam = tile_id(x, y)
        base = atlas.get(bid)
        if base is None:
            continue
        (ys, xs), on = blit(base[0], base[1], x, y)
        grad = 0.93 + 0.13 * (y - x + W) / (W + H)                   # roofArt.roofGradient
        cv[ys, xs][on] = np.clip(base[0][..., :3] * grad, 0, 255)[on]
        plating[ys, xs][on] = base[0][on]
        famlum[ys, xs][on] = FAM_LUM[fam]
    for x, y in tiles:                                               # paint, in plan order per tile
        grad = 0.93 + 0.13 * (y - x + W) / (W + H)
        for mask, motif in plan.get((x, y), []):
            mk = atlas.get(f"roof.lv.{mask}")
            if mk is None:
                continue
            (ys, xs), on = blit(mk[0], mk[1], x, y)
            mpx = mk[0]
            lum = (plating[ys, xs][..., :3] @ W3) / 255 / famlum[ys, xs]
            hint = np.where(plating[ys, xs][..., 3] < 128, 0.0, np.where(lum < lv.RELIEF_DARK, -lv.RELIEF_K_DARK,
                            np.where(lum > lv.RELIEF_LIGHT, lv.RELIEF_K_LIGHT, 0.0)))
            ca, cb = sc.get("remap", {}).get(motif, ("P", "S"))
            for sel, C in ((on & (mpx[..., 0] > 200) & (mpx[..., 1] < 60), rgb(sc.get(ca) or sc["P"])),
                           (on & (mpx[..., 1] > 200) & (mpx[..., 0] < 60), rgb(sc.get(cb) or sc["S"]))):
                paint = np.clip(C[None, None, :] * (1 + hint[..., None]) * grad, 0, 255)
                cv[ys, xs][sel] = paint[sel]
    rows_ = np.where((cv != (12, 16, 22)).any(-1).any(1))[0]          # crop to the roof
    return cv[max(0, rows_[0] - 12):rows_[-1] + 12].astype(np.uint8)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    zoom = int(sys.argv[sys.argv.index("--zoom") + 1]) if "--zoom" in sys.argv else 1
    if "--zoom" in sys.argv:
        args.remove(str(zoom))
    root, out = args[0], args[1]
    schemes = args[2].split(",") if len(args) > 2 else list(lv.SCHEMES)
    atlas = Atlas(root)
    rows = []
    for sc in schemes:
        ims = [ship_image(atlas, SHIPS[k], sc) for k in SHIPS]
        h = max(i.shape[0] for i in ims)
        row = np.zeros((h + 26, sum(i.shape[1] for i in ims), 3), np.uint8)
        row[:] = (12, 16, 22)
        x = 0
        for im in ims:
            row[26:26 + im.shape[0], x:x + im.shape[1]] = im
            x += im.shape[1]
        rows.append((sc, row))
    W = max(r.shape[1] for _, r in rows)
    sheet = Image.new("RGB", (W, sum(r.shape[0] for _, r in rows)), (12, 16, 22))
    y = 0
    for sc, r in rows:
        sheet.paste(Image.fromarray(r), (0, y))
        owner = next((k for k, v in lv.LIVERIES.items() if sc in v and k not in ("livery.scrapper", "livery.drone")), "")
        ImageDraw.Draw(sheet).text((10, y + 4), f"{sc}   ({owner.replace('livery.navy', 'classic: navy, civilian, scrapper, drone')})",
                                   fill=(170, 210, 230), font=ImageFont.load_default(size=16))
        y += r.shape[0]
    if zoom > 1:
        sheet = sheet.resize((sheet.width * zoom, sheet.height * zoom), Image.NEAREST)
    sheet.save(out)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
