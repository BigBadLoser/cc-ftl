"""Trims crew clip sheets to the opaque pixels they actually use.

Crew cells are drawn in one fixed frame (crew_spec.FRAME_W x FRAME_H) so the layers stack, but a clip only covers a
small part of it: decoded at 4 bytes a pixel the untrimmed sheets are ~10 GiB for the human set, ~0.7 GiB trimmed. Each
clip sheet is cropped to the union box of every opaque pixel of its image and glow over all 8 directions and frames, so
every cell stays the same size and the renderer's column/row maths is unchanged. The manifest clip records the cell
(`cw`, `ch`) and where it sits in the layer frame (`ox`, `oy`); the renderer draws at `ox - anchor.x, oy - anchor.y`
(src/render/assets/manifest.ts `ClipDef`). The layer's `frameW`/`frameH`/`anchor` and the weapon muzzle offsets (px from the
anchor) are untouched. Idempotent: a trimmed sheet's box is its whole cell.

  python3 -m sprites.crew_trim [assets dir]      # retrofit an existing sprite output (default: public/assets/1x)
"""
import json
import sys
from pathlib import Path

import numpy as np

from . import post


def cell_geom(asset, clip):
    """(cw, ch, ox, oy) of a clip sheet's cells inside the layer frame."""
    return clip.get("cw", asset["frameW"]), clip.get("ch", asset["frameH"]), clip.get("ox", 0), clip.get("oy", 0)


def union_cell_box(sheets, cw, ch):
    """Box (x0, y0, x1, y1) in cell coordinates holding every opaque pixel of every cell of the sheets (same size, 8 rows
    of cw x ch cells), or None if they are empty."""
    op = None
    for s in sheets:
        if s is None:
            continue
        a = s[..., 3] > 0
        op = a if op is None else op | a
    if op is None:
        return None
    rows, cols = op.shape[0] // ch, op.shape[1] // cw
    fold = op.reshape(rows, ch, cols, cw).any(axis=(0, 2))
    if not fold.any():
        return None
    ys, xs = np.where(fold)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop_cells(sheet, cw, ch, box):
    """The sheet with every cell cut to box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    rows, cols = sheet.shape[0] // ch, sheet.shape[1] // cw
    cells = sheet.reshape(rows, ch, cols, cw, 4)[:, y0:y1, :, x0:x1, :]
    return np.ascontiguousarray(cells.reshape(rows * (y1 - y0), cols * (x1 - x0), 4))


def trim_sheet(image, glow, cw, ch):
    """-> (image, glow, (x0, y0, x1, y1)): the sheets cropped to their union box. An empty sheet keeps one transparent
    pixel per cell. glow may be None."""
    box = union_cell_box([image, glow], cw, ch) or (0, 0, 1, 1)
    return crop_cells(image, cw, ch, box), (crop_cells(glow, cw, ch, box) if glow is not None else None), box


def full_cell(img, asset, clip, d, col):
    """Cell `col` of direction `d` as a full layer frame (frameH, frameW, 4), re-padded: for review tools that stack cells."""
    cw, ch, ox, oy = cell_geom(asset, clip)
    out = np.zeros((asset["frameH"], asset["frameW"], 4), np.uint8)
    out[oy:oy + ch, ox:ox + cw] = img[d * ch:(d + 1) * ch, col * cw:(col + 1) * cw]
    return out


def apply_trim(clip, asset, box):
    """Record a trim box (in the clip's current cells) on its manifest clip."""
    cw, ch, ox, oy = cell_geom(asset, clip)
    x0, y0, x1, y1 = box
    clip.update(cw=x1 - x0, ch=y1 - y0, ox=ox + x0, oy=oy + y0)


def _load(path):
    from PIL import Image
    return np.array(Image.open(path).convert("RGBA"))


def retrofit(outdir, log=print):
    """Trim every per-clip crew sheet listed in outdir/manifest.json in place (idempotent). Glow sheets that turn out empty
    are dropped. -> (bytes before, bytes after) of decoded pixels."""
    outdir = Path(outdir)
    mp = outdir / "manifest.json"
    m = json.loads(mp.read_text())
    before = after = 0
    for a in m["assets"].values():
        if a.get("kind") != "crew.layer":
            continue
        by_sheet = {}
        for c in a["clips"].values():
            if c.get("sheet"):
                by_sheet.setdefault(c["sheet"], []).append(c)
        for sid, clips in by_sheet.items():
            if len(clips) != 1:                          # several clips share it: leave it as it is
                continue
            clip = clips[0]
            sh = m["sheets"][sid]
            cw, ch, ox, oy = cell_geom(a, clip)
            img = _load(outdir / sh["image"])
            gl = _load(outdir / sh["glow"]) if sh.get("glow") else None
            if gl is not None and not (gl[..., 3] > 0).any():
                (outdir / sh["glow"]).unlink()
                del sh["glow"]
                gl = None
            before += img.size + (gl.size if gl is not None else 0)
            ni, ng, box = trim_sheet(img, gl, cw, ch)
            if box != (0, 0, cw, ch):
                post.write_png(outdir / sh["image"], ni)
                if ng is not None:
                    post.write_png(outdir / sh["glow"], ng)
                apply_trim(clip, a, box)
            after += ni.size + (ng.size if ng is not None else 0)
        if a.get("glow") and not any("glow" in m["sheets"][c.get("sheet", a.get("sheet"))] for c in a["clips"].values()):
            del a["glow"]
    mp.write_text(json.dumps(m, indent=1))
    log(f"crew sheets trimmed: {before / 2**20:.0f} MiB -> {after / 2**20:.0f} MiB decoded")
    return before, after


if __name__ == "__main__":
    retrofit(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[3] / "public" / "assets" / "1x")
