"""Compare two builds of the human crew sheets cell by cell (plain python3 + numpy + PIL).

  python3 -I tools/blender/review/crew_sheet_compare.py <old assets dir> <new assets dir>

The old dir may hold the pre-per-clip format (one sheet per item, `clips.<c>.start` columns, a union-box frame) and the new one
the per-clip format with a fixed frame; either side may use either format. Every old cell is placed into the new frame
by aligning the anchors and compared byte for byte (RGBA and glow). Anything the new frame holds outside the old cell
counts as a difference. Columns: alpha diff = pixels whose silhouette differs, colour diff = pixels opaque in both with a
different colour. The RGB of fully transparent image pixels is ignored (it is invisible junk and differs outside the
old crop). Prints one line per item and a verdict."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import crew_trim  # noqa: E402


class Set:
    def __init__(self, d):
        self.d = Path(d)
        self.m = json.loads((self.d / "manifest.json").read_text())
        self._img = {}

    def layers(self):
        return {k: a for k, a in self.m["assets"].items() if a["kind"] == "crew.layer" and a.get("species") == "human"}

    def img(self, rel):
        if rel not in self._img:
            self._img[rel] = np.array(Image.open(self.d / rel).convert("RGBA"))
        return self._img[rel]

    def cell(self, a, clip, d, i, glow):
        """-> RGBA cell (frameH, frameW, 4) or None if the layer has no such clip / no glow sheet."""
        c = a["clips"].get(clip)
        if c is None:
            return None
        sh = self.m["sheets"][c.get("sheet", a.get("sheet"))]
        rel = sh.get("glow") if glow else sh["image"]
        fw, fh = a["frameW"], a["frameH"]
        if rel is None:
            return np.zeros((fh, fw, 4), np.uint8)
        col = c["start"] + i
        return crew_trim.full_cell(self.img(rel), a, c, d, col)


def main():
    old, new = Set(sys.argv[1]), Set(sys.argv[2])
    ol, nl = old.layers(), new.layers()
    tot = dict(cells=0, same=0, opaque=0, alpha=0, colour=0)
    print(f"{'item':40} {'cells':>5} {'same':>5} {'opaque px':>9} {'alpha diff':>10} {'colour diff':>11} {'%':>5}  notes")
    for lid in sorted(set(ol) | set(nl)):
        if lid not in nl or lid not in ol:
            print(f"{lid:40} only in {'old' if lid in ol else 'new'}")
            tot["alpha"] += 1
            continue
        a, b = ol[lid], nl[lid]
        sx, sy = b["anchor"]["x"] - a["anchor"]["x"], b["anchor"]["y"] - a["anchor"]["y"]
        n_cells = n_same = opaque = adiff = cdiff = 0
        notes = []
        for clip, c in a["clips"].items():
            if clip not in b["clips"]:
                blank = all(not old.cell(a, clip, d, i, False)[..., 3].any() for d in range(8) for i in range(c["frames"]))
                notes.append(f"{clip}: dropped ({'old sheet blank' if blank else 'unused by design'})")
                continue
            for d in range(8):
                for i in range(c["frames"]):
                    n_cells += 1
                    ok = True
                    for glow in (False, True):
                        o, n = old.cell(a, clip, d, i, glow), new.cell(b, clip, d, i, glow)
                        emb = np.zeros_like(n)
                        h, w = o.shape[:2]
                        emb[sy:sy + h, sx:sx + w] = o
                        if glow:
                            ok &= np.array_equal(emb, n)
                            continue
                        vis = (emb[..., 3] > 0) | (n[..., 3] > 0)
                        opaque += int((n[..., 3] > 0).sum())
                        al = emb[..., 3] != n[..., 3]
                        co = (emb[..., :3] != n[..., :3]).any(-1) & vis & ~al
                        adiff, cdiff = adiff + int(al.sum()), cdiff + int(co.sum())
                        ok &= not (al.any() or co.any())
                    n_same += ok
        tot["cells"] += n_cells
        tot["same"] += n_same
        tot["opaque"] += opaque
        tot["alpha"] += adiff
        tot["colour"] += cdiff
        extra = sorted(set(b["clips"]) - set(a["clips"]))
        if extra:
            notes.append("new clips: " + ",".join(extra))
        print(f"{lid:40} {n_cells:5d} {n_same:5d} {opaque:9d} {adiff:10d} {cdiff:11d} {100 * cdiff / max(opaque, 1):5.2f}  {'; '.join(notes)}")
    ofw = {(a["frameW"], a["frameH"], a["anchor"]["x"], a["anchor"]["y"]) for a in ol.values()}
    nfw = {(a["frameW"], a["frameH"], a["anchor"]["x"], a["anchor"]["y"]) for a in nl.values()}
    print(f"frame (w,h,ax,ay) old {sorted(ofw)} new {sorted(nfw)}")
    print(f"TOTAL cells {tot['cells']}, identical {tot['same']}, opaque px {tot['opaque']}, alpha diffs {tot['alpha']}, "
          f"colour diffs {tot['colour']} ({100 * tot['colour'] / max(tot['opaque'], 1):.2f}%)")
    print("VERDICT:", "pixel-identical (after anchor alignment)" if tot["same"] == tot["cells"] and not tot["alpha"] else "differs")
    return 0 if tot["same"] == tot["cells"] else 1


sys.exit(main())
