"""Wall and hull blocks (grid frame, origin = tile centre at floor level).

ASYMMETRIC profile (as in Space Haven): the base fills the whole tile, the flat top is a thin strip T wide along the
tile's far edges (-x, -y: away from the camera, which sees +x, +y and the tops) and the slope ALWAYS faces the camera,
falling from the top strip to the floor at the near (+x / +y) tile edge. The back side is vertical (never seen, so not
drawn). The top strip (core) is the corner square plus an arm to the +x edge (bit 2 = E) and one to the +y edge (bit 4 =
S); neighbours' arms and squares meet at the shared tile edges, so every mask autotiles: runs are plain wedges, run ends
taper with a slope facing +x/+y, corners and T junctions are mitred (hips/valleys, L-inf distance to the core). The slope
rises to H (cutaway), HH (low hull) or HF (full height). Hull pieces add colour-blocked plating (variant 0/1 swaps the
ochre and blue-grey bands; the renderer alternates them). Hazard strips for hull slopes are overlay sprites. Ghosts:
ghosts.py, doors: doors.py, floors: floors.py, registry: envtiles.py."""
from . import core


def lerp(a, b, t):
    return a + (b - a) * t


H = 0.38           # low (cutaway) interior wall height (tiles)
HH = 0.55          # low (cutaway) hull height: chunkier than interior walls
HF = 2.4           # full-height wall top (tiles); crew are 1.5 tall (human_base.HEIGHT_UNITS)
T = 5 / 32         # flat top strip width (on the 1/32 grid so the mitre creases follow cell diagonals)
WT = T             # legacy name
NU, NT = 32, 16
GN = 32
R = 1.0 - T        # slope run (horizontal)
DIRS = ("n", "e", "s", "w")
BIT = {"n": 1, "e": 2, "s": 4, "w": 8}

# family -> palette names: L highlight, M body (lit +y face), D shade body (+x face), K darkest; top: flat strip
PAL = {
    "wall": dict(L="wallL", M="wallM", D="wallD", K="wallK", top="wallL"),
    "hull": dict(L="ochL", M="ochM", D="ochD", K="ochK", top="ochL",
                 L2="hbL", M2="hbM", D2="hbD", K2="hbK", top2="hbL"),
}


def core_rects(mask):
    """Flat-top rectangles (x0, x1, y0, y1): corner square plus arms toward connected +x / +y sides."""
    x1, y1 = -0.5 + T, -0.5 + T
    rs = [(-0.5, x1, -0.5, y1)]
    if mask & 2:
        rs.append((x1, 0.5, -0.5, y1))
    if mask & 4:
        rs.append((-0.5, x1, y1, 0.5))
    return rs


def height(mask, x, y, top):
    """Piecewise-linear heightfield: L-inf distance to the core (mitred hips and valleys)."""
    d = 1e9
    for x0, x1, y0, y1 in core_rects(mask):
        d = min(d, max(x0 - x, x - x1, y0 - y, y - y1, 0.0))
    return top * max(0.0, 1.0 - d / R)


def in_core(mask, cx, cy, e=0.0):
    """Is the point inside the core (flat top) footprint, optionally grown by e?"""
    return any(x0 - e < cx < x1 + e and y0 - e < cy < y1 + e for x0, x1, y0, y1 in core_rects(mask))


def cells(mask, top):
    """Yield (kind, i, j, pts) for the 32x32 cells: 'flat' (4 points at z = top or 0) or 'tri' (3 points, sloped).
    Creases lie on the cell diagonals (x - y = const through grid corners), so every cell splits along the main one."""
    for j in range(GN):
        for i in range(GN):
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            p = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            z = [height(mask, px, py, top) for px, py in p]
            q = [(px, py, zz) for (px, py), zz in zip(p, z)]
            if max(z) - min(z) < 1e-9:
                yield "flat", i, j, q
                continue
            for t in ([q[0], q[1], q[2]], [q[0], q[2], q[3]]):
                yield "tri", i, j, t


def _grad(t):
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = t
    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    gx = ((z1 - z0) * (y2 - y0) - (z2 - z0) * (y1 - y0)) / det
    gy = ((x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)) / det
    return gx, gy


def _pal(fam, variant):
    c = PAL[fam]
    if fam == "hull" and variant:
        return dict(L=c["L2"], M=c["M2"], D=c["D2"], K=c["K2"], top=c["top2"],
                    tL=c["L"], tM=c["M"], tD=c["D"], tK=c["K"])
    return dict(L=c["L"], M=c["M"], D=c["D"], K=c["K"], top=c["top"],
                tL=c.get("L2"), tM=c.get("M2"), tD=c.get("D2"), tK=c.get("K2"))


def _face_col(c, fam, lit, u, f):
    """Colour of a slope cell: u 0..1 along the wall, f 0..1 up the slope."""
    body, hi, lo = (c["M"], c["L"], c["D"]) if lit else (c["D"], c["M"], c["K"])
    seam_u = u < 1 / 32 or abs(u - 0.5) < 0.5 / 32
    if fam == "hull":
        tb, tlo = (c["tM"], c["tD"]) if lit else (c["tD"], c["tK"])
        if f < 0.04:
            return lo
        if f < 0.14:                                         # colour-blocked foot band
            return tb
        if f > 0.93:
            return hi
        if f > 0.84:
            return tb
        if seam_u or abs(f - 0.50) < 0.012:
            return lo
        if f > 0.50 and (u % 0.5) < 0.04:                    # plate step on the upper panel
            return hi
        return body
    if f < 0.035:
        return lo
    if f > 0.955:
        return hi
    if seam_u or abs(f - 0.34) < 0.014 or abs(f - 0.66) < 0.014:
        return lo
    if f > 0.66:
        return hi if lit else body
    return body


def _slope_col(c, fam, t, top):
    gx, gy = _grad(t)
    eps = 1e-6
    cxm, cym = sum(p[0] for p in t) / 3, sum(p[1] for p in t) / 3
    f = min(max(sum(p[2] for p in t) / 3 / top, 0.0), 1.0)
    if gy < -eps and abs(gx) < eps:                        # +y slope (lit)
        return _face_col(c, fam, True, cxm + 0.5, f)
    if gx < -eps and abs(gy) < eps:                        # +x slope (shaded)
        return _face_col(c, fam, False, cym + 0.5, f)
    return c["D"] if fam == "wall" else c["K"]             # mitre hips and valleys


def block(mask, fam, deco=None, name=None, full=False):
    """deco: colour variant (hull: 1 swaps the ochre / blue-grey bands)."""
    variant = 1 if deco == 1 else 0
    m = core.Mesh(name or f"wall_{fam}_{mask}", flat=True)
    c = _pal(fam, variant)
    top = HF if full else (HH if fam == "hull" else H)
    for kind, i, j, pts in cells(mask, top):
        if kind == "flat":
            if pts[0][2] > top - 1e-9:
                m.poly([core.G(*p) for p in pts], c["top"])
            continue
        m.poly([core.G(*p) for p in pts], _slope_col(c, fam, pts, top))
    return [m.build()]


def hazard(side, bits):
    """Hazard stripe at the foot of a hull slope (overlay, same geometry as the slope of the matching piece).
    side 's'/'e'; bits: 1 = back end connected (W for s, N for e), 2 = front end connected (E for s, S for e)."""
    m = core.Mesh(f"haz_{side}_{bits}", flat=True)
    if side == "s":
        mask = (8 if bits & 1 else 0) | (2 if bits & 2 else 0) | 1
    else:
        mask = (1 if bits & 1 else 0) | (4 if bits & 2 else 0) | 8
    for kind, i, j, pts in cells(mask, HH):
        if kind != "tri":
            continue
        gx, gy = _grad(pts)
        pure = (side == "s" and gy < -1e-6 and abs(gx) < 1e-6) or (side == "e" and gx < -1e-6 and abs(gy) < 1e-6)
        if pure and max(p[2] for p in pts) <= HH * 3 / NT + 1e-9:
            xs = i if side == "s" else j
            m.poly([core.G(x, y, z + 0.002) for x, y, z in pts], "hazY" if (xs // 2) % 2 == 0 else "hazK")
    return [m.build()]
