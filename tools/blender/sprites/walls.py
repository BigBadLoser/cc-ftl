"""Wall and hull blocks (grid frame, origin = tile centre at floor level).

A wall tile is a LOW bevelled block that fills its tile: a heightfield over the L-inf distance to the flat top (core),
which is the centre square plus one arm per connected side (bit 1 = N = -y, 2 = E = +x, 4 = S = +y, 8 = W = -x), so
slopes are mitred (hips outside, valleys inside) and neighbouring tiles share identical edge profiles. Slopes are plain
(foot crease, one seam, crest line); the top has a dark channel along the arms (isolated: a pit). FULL pieces add plain
vertical faces up to HF. Hazard strips for hull slopes are overlay sprites. Ghosts: ghosts.py, doors: doors.py,
floors: floors.py, registry: envtiles.py."""
from . import core

H = 0.38           # block height (tiles)
WT = 7 / 32        # top half-width of an open side (slope inset from the tile edge)
CH = 2 / 32        # channel half-width
NU, NT = 32, 16    # slope cells across / up
HF = 2.2          # full-height wall top (tiles); crew are 1.5 tall (human_base.HEIGHT_UNITS), so 0.7 headroom
DH = 2.3           # door frame height (0.1 above HF)
DX = 0.30          # door opening half-width
DIRS = ("n", "e", "s", "w")
BIT = {"n": 1, "e": 2, "s": 4, "w": 8}

PAL = {  # family -> colours
    "wall": dict(top="steel", chan="dark", sb="steel", sp="steelL", sl="steelD", eb="steelD", ep="steel",
                 el="dark", crest="steelL", hip="plateA"),
    "hull": dict(top="steelD", chan="dark", sb="steelD", sp="steel", sl="dark", eb="plateA", ep="steelD",
                 el="dark", crest="steel", hip="grime"),
    "ghost": dict(top="dark", chan="hazK", sb="grime", sp="hazK", sl="dark", eb="dark", ep="hazK",
                  el="dark", crest="steelL", hip="dark"),
}


def lerp(a, b, t):
    return a + (b - a) * t


def rect(mask):
    """Top rectangle (xw, xe, yn, ys) of the block for a mask."""
    return (-0.5 if mask & 8 else -WT, 0.5 if mask & 2 else WT, -0.5 if mask & 1 else -WT, 0.5 if mask & 4 else WT)


# ---- slope panel patterns ------------------------------------------------------------------------------------

def _panel(c, lit, deco, i, j):
    """Colour of a slope cell (j up 0..NT-1): plain body with a dark foot crease, one thin seam and a light crest."""
    body, edge = (c["sb"], c["sl"]) if lit else (c["eb"], c["el"])
    if j == 0:
        return c["el"]
    if j == NT - 1:
        return c["crest"]
    if j == NT // 2:
        return edge
    return body


R = 0.5 - WT        # slope run (horizontal)
GN = 32


def core_rects(mask):
    """Axis-aligned rectangles (x0, x1, y0, y1) whose union is the flat top: centre square plus one arm per
    connected side running to the tile edge. Neighbouring tiles share the exact arm cross-section."""
    rs = [(-WT, WT, -WT, WT)]
    if mask & 1:
        rs.append((-WT, WT, -0.5, -WT))
    if mask & 2:
        rs.append((WT, 0.5, -WT, WT))
    if mask & 4:
        rs.append((-WT, WT, WT, 0.5))
    if mask & 8:
        rs.append((-0.5, -WT, -WT, WT))
    return rs


def height(mask, x, y, top):
    """Piecewise-linear heightfield: L-inf distance to the core, so slopes are mitred (outer hips, inner valleys)."""
    d = 1e9
    for x0, x1, y0, y1 in core_rects(mask):
        d = min(d, max(x0 - x, x - x1, y0 - y, y - y1, 0.0))
    return top * max(0.0, 1.0 - d / R)


def in_core(mask, cx, cy, e=0.0):
    """Is the point inside the core (flat top) footprint, optionally grown by e?"""
    return any(x0 - e < cx < x1 + e and y0 - e < cy < y1 + e for x0, x1, y0, y1 in core_rects(mask))


def cells(mask, top):
    """Yield (kind, i, j, pts) for the 32x32 cells: 'flat' (4 points at z = top or 0) or 'tri' (3 points, sloped)."""
    for j in range(GN):
        for i in range(GN):
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            p = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            z = [height(mask, px, py, top) for px, py in p]
            if max(z) - min(z) < 1e-9:
                yield "flat", i, j, [(px, py, zz) for (px, py), zz in zip(p, z)]
                continue
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            q = [(px, py, zz) for (px, py), zz in zip(p, z)]
            if cx * cy > 0:
                tr = ([q[0], q[1], q[2]], [q[0], q[2], q[3]])
            else:
                tr = ([q[0], q[1], q[3]], [q[1], q[2], q[3]])
            for t in tr:
                yield "tri", i, j, t


def _grad(t):
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = t
    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    gx = ((z1 - z0) * (y2 - y0) - (z2 - z0) * (y1 - y0)) / det
    gy = ((x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)) / det
    return gx, gy


def _top_col(c, mask, i, j):
    cx, cy = (i + 0.5) / 32 - 0.5, (j + 0.5) / 32 - 0.5
    if mask == 0:
        chan = abs(cx) < 3 / 32 and abs(cy) < 3 / 32
    else:
        chan = (abs(cx) < CH and abs(cy) < CH) or \
               (abs(cx) < CH and ((mask & 1 and cy < 0) or (mask & 4 and cy > 0))) or \
               (abs(cy) < CH and ((mask & 8 and cx < 0) or (mask & 2 and cx > 0)))
    return c["chan"] if chan else c["top"]


def _span(mask):
    xw, xe, yn, ys = rect(mask)
    return xw, xe, yn, ys


def _slope_col(c, mask, t, top, deco):
    gx, gy = _grad(t)
    cxm = sum(p[0] for p in t) / 3
    cym = sum(p[1] for p in t) / 3
    zm = sum(p[2] for p in t) / 3
    eps = 1e-6
    xw, xe, yn, ys = _span(mask)
    if gy < -eps and abs(gx) < eps:                        # pure +y slope (lit)
        i = int((cxm - xw) / (xe - xw) * NU)
        return _panel(c, True, deco if mask == 10 else None, min(max(i, 0), NU - 1), min(int(zm / top * NT), NT - 1))
    if gx < -eps and abs(gy) < eps:                        # pure +x slope (shaded)
        i = int((cym - yn) / (ys - yn) * NU)
        return _panel(c, False, deco if mask == 5 else None, min(max(i, 0), NU - 1), min(int(zm / top * NT), NT - 1))
    if gx < -eps or gy < -eps:                             # mitre faces toward the camera
        return c["sb"] if gy < -eps and gx >= -eps else (c["eb"] if gx < -eps and gy >= -eps else c["hip"])
    return c["eb"]


def _upright(m, mask, c, top_z):
    """Plain vertical faces from z = H to top_z along the core boundary on +y and +x facing edges (one seam, crest)."""
    nz = int(round((top_z - H) * 24))
    for j in range(GN):
        for i in range(GN):
            cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
            if not in_core(mask, cx, cy):
                continue
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            for lit in (True, False):
                if lit:
                    if j == GN - 1 or in_core(mask, cx, cy + 1 / GN):
                        continue
                    body, edge = c["sb"], c["sl"]
                else:
                    if i == GN - 1 or in_core(mask, cx + 1 / GN, cy):
                        continue
                    body, edge = c["eb"], c["el"]
                for k in range(nz):
                    col = c["crest"] if k == nz - 1 else (edge if k == nz // 2 else body)
                    za, zb = H + (top_z - H) * k / nz, H + (top_z - H) * (k + 1) / nz
                    if lit:
                        m.poly([core.G(x0, y1, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x0, y1, zb)], col)
                    else:
                        m.poly([core.G(x1, y0, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x1, y0, zb)], col)


def block(mask, fam, deco=None, name=None, full=False):
    m = core.Mesh(name or f"wall_{fam}_{mask}", flat=True)
    c = PAL[fam]
    top = HF if full else H
    for kind, i, j, pts in cells(mask, H):
        gp = [(x, y, z + (top - H if kind == "flat" and z >= H - 1e-9 else 0.0)) for x, y, z in pts]
        if kind == "flat":
            if pts[0][2] >= H - 1e-9:
                m.poly([core.G(*p) for p in gp], _top_col(c, mask, i, j))
            continue
        m.poly([core.G(*p) for p in pts], _slope_col(c, mask, pts, H, deco))
    if full:
        _upright(m, mask, c, HF)
    return [m.build()]


def hazard(side, bits):
    """Hazard stripe at the foot of a hull slope (overlay, same geometry as the slope of the matching piece).
    side 's'/'e'; bits: 1 = back end connected (W for s, N for e), 2 = front end connected (E for s, S for e)."""
    m = core.Mesh(f"haz_{side}_{bits}", flat=True)
    if side == "s":
        mask = (8 if bits & 1 else 0) | (2 if bits & 2 else 0) | 1
    else:
        mask = (1 if bits & 1 else 0) | (4 if bits & 2 else 0) | 8
    for kind, i, j, pts in cells(mask, H):
        if kind != "tri":
            continue
        gx, gy = _grad(pts)
        pure = (side == "s" and gy < -1e-6 and abs(gx) < 1e-6) or (side == "e" and gx < -1e-6 and abs(gy) < 1e-6)
        if pure and max(p[2] for p in pts) <= H * 3 / NT + 1e-9:
            xs = i if side == "s" else j
            m.poly([core.G(x, y, z + 0.002) for x, y, z in pts], "hazY" if (xs // 2) % 2 == 0 else "hazK")
    return [m.build()]
