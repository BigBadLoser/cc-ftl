"""Cut roof plates: the roof slab covers the hull walls too, and its outer edge lines up with the hull's OUTER face.

The far hull's outer face is its tile edge, so full plates fit there. The near hull (camera side) stands at the inner
edge of its tile and is HULL cells thick (walls.hull_thick(): the partitions' face, 19 of 32). An engine's hull row is the same production hull wall (engine_kestrel_h185
model.hull), so it takes the same cuts. The cut plates
are the production base tiles (same module rule, patch and inset plates, girders) clipped at that line, with the slab's
camera-facing side (lit lip + face down to the walls' top, like roof.edge.s / .e) on the cut:

  roof.c<L><c>.<u><v>[.patch|.inset].cut.<s|e|se>   near hull: space at +y, at +x, or both (the outer corner)
  roof.c<L><c>.<u><v>[.patch|.inset].cut.c          the chamfered far corner (N and W open), girders included
  roof.edge.<n|w>.<c>.cut                           an open N / W girder on an e / s cut tile, clipped likewise
The renderer (src/render/roofArt.ts roofCut) picks them; a cut side gets no separate edge overlay."""
from . import core
from . import roof_layout as rl
from . import roofs
from . import walls

GN = rl.GN
HULL = round(walls.hull_thick() * GN)
EPS = 1e-6


class ClipMesh(core.Mesh):
    """A Mesh that clips every polygon at x <= xmax and y <= ymax (grid frame) and drops what falls into the chamfer
    triangle (x + y < diag, tile corner at -0.5, -0.5). The last kept row / column of top cells takes the lip colour."""

    def __init__(self, name, flat=True, xmax=None, ymax=None, diag=None, lip=None):
        super().__init__(name, flat=flat)
        self.xmax, self.ymax, self.diag, self.lip = xmax, ymax, diag, lip or {}

    def poly(self, pts, color, flip=False):
        g = [(p[0], -p[1], p[2]) for p in pts]
        cx = sum(p[0] for p in g) / len(g)
        cy = sum(p[1] for p in g) / len(g)
        if self.diag is not None and (cx + 0.5) + (cy + 0.5) < self.diag:
            return
        if self.xmax is not None:
            if cx > self.xmax:
                return
            g = [(min(x, self.xmax), y, z) for x, y, z in g]
        if self.ymax is not None:
            if cy > self.ymax:
                return
            g = [(x, min(y, self.ymax), z) for x, y, z in g]
        if _area(g) < EPS:
            return
        flat_top = max(z for _, _, z in g) - min(z for _, _, z in g) < EPS
        if flat_top:
            w = 1.0 / GN
            if "s" in self.lip and self.ymax is not None and cy > self.ymax - w:
                color = self.lip["s"]
            elif "e" in self.lip and self.xmax is not None and cx > self.xmax - w:
                color = self.lip["e"]
        super().poly([core.G(*q) for q in g], color, flip)


def _area(g):
    """Polygon area (Newell's method) of grid-frame points."""
    nx = ny = nz = 0.0
    for (x0, y0, z0), (x1, y1, z1) in zip(g, g[1:] + g[:1]):
        nx += (y0 - y1) * (z0 + z1)
        ny += (z0 - z1) * (x0 + x1)
        nz += (x0 - x1) * (y0 + y1)
    return 0.5 * (nx * nx + ny * ny + nz * nz) ** 0.5


def _face(m, f, side, cut, lo, hi):
    """Camera-facing slab side on the cut line, from the roof top down to the walls' top, with a dark foot strip."""
    z, z0 = roofs.ZR, roofs.ZB
    if side == "s":
        a, b, face = (lo, cut), (hi, cut), f["fs"]
    else:
        a, b, face = (cut, lo), (cut, hi), f["fe"]
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z), core.G(*a, z)], face)
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z0 + 0.035), core.G(*a, z0 + 0.035)], f["k"])


def _base(L, c, u, v, kind, mesh):
    if kind == "inset":
        return roofs.inset_base(L, c, u, v, False, mesh=mesh)
    return roofs.variant_base(L, c, u, v, "C", kind == "patch", None, mesh=mesh)


def cut_tile(L, c, u, v, kind, cut, n):
    from . import roof_variants as rv
    f = rv.FAM_C[c]
    line = -0.5 + n / GN
    xmax = line if "e" in cut else None
    ymax = line if "s" in cut else None
    diag = n / GN if cut == "c" else None
    lip = {k: f["lit" if k == "s" else "shd"] for k in cut if k in "se"}
    mk = lambda name, flat=True: ClipMesh(name, flat, xmax, ymax, diag, lip)  # noqa: E731
    objs = _base(L, c, u, v, kind, mk)
    if cut == "c":                                          # the far corner: its open N and W girders, clipped
        for s in "nw":
            objs += roofs.variant_edge(s, c, "C", False, mesh=lambda name, flat=True: ClipMesh(name, flat, diag=diag))
        return objs
    m = core.Mesh(f"roof_cut_{L}{c}{u}{v}{kind}{cut}{n}", flat=True)
    for side in cut:
        _face(m, f, side, line, -0.5, (xmax if side == "s" and xmax is not None else ymax if side == "e" and ymax is not None else 0.5))
    return objs + [m.build()]


def cut_edge(side, c, n):
    line = -0.5 + n / GN
    clip = (lambda name, flat=True: ClipMesh(name, flat, xmax=line)) if side == "n" else \
        (lambda name, flat=True: ClipMesh(name, flat, ymax=line))
    return roofs.variant_edge(side, c, "C", False, mesh=clip)


def _sprites():
    from . import roof_variants as rv
    out = []
    for L in range(len(rl.LAYOUTS)):
        for c in rl.FAM:
            for v in range(rl.M):
                for u in range(rl.M):
                    kinds = ["base"]
                    if rl.plate_at(L, u, v) == rl.LAYOUTS[L][rv.PATCH[L]]:
                        kinds.append("patch")
                    if rv.inset_plate(L, u, v) is not None:
                        kinds.append("inset")
                    for kind in kinds:
                        sid = f"roof.c{L}{c}.{u}{v}" + ("" if kind == "base" else f".{kind}")
                        for cut in ("s", "e", "se", "c"):
                            out.append((f"{sid}.cut.{cut}", (1, 1), "block",
                                        lambda L=L, c=c, u=u, v=v, k=kind, t=cut: cut_tile(L, c, u, v, k, t, HULL)))
    for c in rl.FAM:
        for side in "nw":
            out.append((f"roof.edge.{side}.{c}.cut", (1, 1), "block", lambda s=side, c=c: cut_edge(s, c, HULL)))
    return out


SPRITES = _sprites()
