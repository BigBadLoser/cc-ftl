"""Ghost wall pieces: the low bevelled cut-wall footprint in opaque near-black (same sloped profile as the cut
pieces, thin blue-grey line along the top edges) plus a short translucent glass volume above it. env_build renders the
two returned objects in separate passes: the glass is never palette-quantized or outlined and its brightness becomes
alpha."""
from . import core
from .walls import H, GN, cells, _grad, in_core

GH = 0.55          # glass height above the floor
GE = 4 / 32        # the glass outline is the core grown by this much (it stands over the slope, not the flat top)


def _plate(mask):
    pm = core.Mesh(f"ghost_plate_{mask}", flat=True)
    for kind, i, j, pts in cells(mask, H):
        if kind == "flat":
            if pts[0][2] >= H - 1e-9:
                cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
                edge = any(not in_core(mask, cx + dx / GN, cy + dy / GN) and abs(cx + dx / GN) < 0.5 and abs(cy + dy / GN) < 0.5
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                pm.poly([core.G(*p) for p in pts], "blueGrey" if edge else "dark")
            continue
        gx, gy = _grad(pts)
        z = sum(p[2] for p in pts) / 3
        if gy < -1e-6 and abs(gx) < 1e-6:                 # camera-facing slope: slightly lighter rim steps
            col = "grime" if z > H * 0.8 else "dark"
        elif gx < -1e-6 and abs(gy) < 1e-6:
            col = "hazK"
        else:
            col = "hazK"
        pm.poly([core.G(*p) for p in pts], col)
    return pm.build()


def _glass(mask):
    gm = core.Mesh(f"glass_{mask}", flat=True)
    nz = int(round(GH * 20))
    inn = lambda cx, cy: in_core(mask, cx, cy, GE)  # noqa: E731
    for j in range(GN):
        for i in range(GN):
            cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
            if not inn(cx, cy):
                continue
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            nbr = lambda dx, dy: inn(cx + dx / GN, cy + dy / GN)  # noqa: E731
            inside = lambda dx, dy: abs(cx + dx / GN) < 0.5 and abs(cy + dy / GN) < 0.5  # noqa: E731
            rim = any(not nbr(dx, dy) and inside(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            gm.poly([core.G(x0, y0, GH), core.G(x1, y0, GH), core.G(x1, y1, GH), core.G(x0, y1, GH)],
                    "plate" if rim else "steelD")
            for lit in (True, False):
                if lit and (j == GN - 1 or nbr(0, 1)):
                    continue
                if not lit and (i == GN - 1 or nbr(1, 0)):
                    continue
                a, b = ((-1, 0), (1, 0)) if lit else ((0, -1), (0, 1))
                corner = (not nbr(*a) and inside(*a)) or (not nbr(*b) and inside(*b))
                for k in range(nz):
                    if k >= nz - 2:
                        col = "plate"
                    elif corner:
                        col = "steelL" if k > nz // 2 else "steel"
                    else:
                        col = "steel" if k > nz * 2 // 3 else ("steelD" if k > nz // 3 else "dark")
                    za, zb = GH * k / nz, GH * (k + 1) / nz
                    if lit:
                        gm.poly([core.G(x0, y1, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x0, y1, zb)], col)
                    else:
                        gm.poly([core.G(x1, y0, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x1, y0, zb)], col)
    return gm.build()


def ghost(mask):
    return [_plate(mask), _glass(mask)]
