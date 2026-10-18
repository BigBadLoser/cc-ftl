"""Wall and hull blocks (grid frame, origin = tile centre at floor level).

Profile (after Space Haven): a thin VERTICAL wall with a flat cap stands on a low sloped SKIRT. The wall occupies a
strip `tw` wide along the tile's far edges (-x, -y: away from the camera, which sees +x, +y and the tops); the skirt
spreads from the wall's foot across the rest of the tile on the camera-facing side, falling from zs to the floor at the
near edge. Only the skirt is sloped; above it the face is flat and vertical. The strip (core) is the corner square plus an
arm to the +x edge (bit 2 = E) and one to the +y edge (bit 4 = S), so neighbouring tiles join at the shared edges: runs
are plain, run ends and corners are mitred in the skirt (L-inf distance to the core). Full pieces rise to HF, cutaway
pieces are a short stub (H interior, HH hull) on a lower skirt. Hull is chunkier (thicker, taller stub), colour-blocked
ochre / blue-grey (variant 0/1 swaps them) and its outer corners and run ends are chamfered at 45 degrees. Hazard strips
for hull skirts are overlay sprites. Ghosts: ghosts.py, doors: doors.py, floors: floors.py, registry: envtiles.py."""
from . import core


def lerp(a, b, t):
    return a + (b - a) * t


GN = 32
NU, NT = 32, 16
H = 0.45           # cutaway interior wall stub height (tiles)
HH = 0.7           # cutaway hull stub height
HF = 2.4           # full-height wall top; crew are 1.5 tall (human_base.HEIGHT_UNITS)
T = TW = 11 / 32   # interior wall thickness (on the 1/32 grid so mitre creases follow cell diagonals)
TWH = 16 / 32      # hull thickness
CH = 5 / 32        # hull corner chamfer
BIT = {"n": 1, "e": 2, "s": 4, "w": 8}
DIRS = ("n", "e", "s", "w")

PAL = {   # L highlight, M body (lit +y face), D shade body (+x face), K darkest
    "wall": dict(L="wallL", M="wallM", D="wallD", K="wallK", top="wallL"),
    "hull": dict(L="ochL", M="ochM", D="ochD", K="ochK", top="ochL",
                 L2="hbL", M2="hbM", D2="hbD", K2="hbK", top2="hbL"),
}


def profile(fam, full):
    """(wall thickness, wall top z, skirt top z) for a family and mode."""
    if fam == "hull":
        return (TWH, HF, 0.55) if full else (TWH, HH, 0.28)
    return (TW, HF, 0.5) if full else (TW, H, 0.18)


def core_rects(mask, tw=TW):
    x1 = y1 = -0.5 + tw
    rs = [(-0.5, x1, -0.5, y1)]
    if mask & 2:
        rs.append((x1, 0.5, -0.5, y1))
    if mask & 4:
        rs.append((-0.5, x1, y1, 0.5))
    return rs


def height(mask, x, y, zs, tw=TW):
    """Skirt heightfield: zs at the core, falling linearly to 0 at L-inf distance 1 - tw (mitred hips and valleys)."""
    d = 1e9
    for x0, x1, y0, y1 in core_rects(mask, tw):
        d = min(d, max(x0 - x, x - x1, y0 - y, y - y1, 0.0))
    return zs * max(0.0, 1.0 - d / (1.0 - tw))


def in_core(mask, cx, cy, e=0.0, tw=TW):
    return any(x0 - e < cx < x1 + e and y0 - e < cy < y1 + e for x0, x1, y0, y1 in core_rects(mask, tw))


def cells(mask, zs, tw=TW):
    """Yield (kind, i, j, pts) for the 32x32 cells: 'flat' (4 points, at zs = core or 0) or 'tri' (skirt, 3 points)."""
    for j in range(GN):
        for i in range(GN):
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            p = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            z = [height(mask, px, py, zs, tw) for px, py in p]
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


def _skirt_col(c, fam, lit):
    if fam == "hull":
        return c["tM"] if lit else c["tD"]               # the skirt carries the contrasting colour block
    return c["L"] if lit else c["M"]


def _wall_col(c, fam, lit, u, z, top, zs):
    """Colour of the vertical face at along-wall position u (0..1) and height z."""
    body, hi, lo = (c["M"], c["L"], c["D"]) if lit else (c["D"], c["M"], c["K"])
    seam = u < 1 / 32 or abs(u - 0.5) < 0.5 / 32
    if z < zs + 0.03:
        return lo                                        # crease where the wall meets the skirt
    if z > top - 0.03:
        return hi                                        # cap edge highlight
    if fam == "hull":
        tb = c["tM"] if lit else c["tD"]
        if z > top - 0.22 or z < zs + 0.2:
            return tb                                    # colour-blocked bands
        if seam or abs(z - (zs + top) / 2) < 0.015:
            return lo
        return body
    if seam:
        return lo
    if top > 1.0 and any(abs(z - g) < 0.02 for g in (1.05, 1.7)):
        return lo                                        # horizontal panel bands
    if z > top - (0.3 if top > 1.0 else 0.1):
        return hi if lit else body                       # lighter tone band near the top
    return body


def emit(m, mask, fam, variant, full, skip=None):
    """Add the wall piece to mesh m. skip = (axis, half_width, z_top): leave the skirt and face free for a door."""
    tw, top, zs = profile(fam, full)
    c = _pal(fam, variant)
    nz = max(2, int(round((top - zs) * 20)))
    xa, ya = -0.5 + tw, -0.5 + tw
    cham = fam == "hull" and not mask & 6                # outer corner / run end: chamfer the (+x, +y) corner of the strip
    in_cham = lambda cx, cy: cham and (cx - (xa - CH)) + (cy - (ya - CH)) > CH  # noqa: E731
    skipped = lambda cx, cy: skip is not None and abs(cx if skip[0] == "x" else cy) < skip[1]  # noqa: E731

    for kind, i, j, pts in cells(mask, zs, tw):
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        if kind == "flat":
            if pts[0][2] > zs - 1e-9 and not in_cham(cx, cy):
                m.poly([core.G(x, y, top) for x, y, z in pts], c["top"])
            elif pts[0][2] > zs - 1e-9:
                m.poly([core.G(*p) for p in pts], _skirt_col(c, fam, True))
            continue
        if skipped(cx, cy):
            continue
        gx, gy = _grad(pts)
        if gy < -1e-6 and abs(gx) < 1e-6:
            col = _skirt_col(c, fam, True)
        elif gx < -1e-6 and abs(gy) < 1e-6:
            col = _skirt_col(c, fam, False)
        else:
            col = c["K"] if fam == "hull" else c["D"]
        m.poly([core.G(*p) for p in pts], col)

    for j in range(GN):                                  # vertical faces on the camera-facing boundary of the core
        for i in range(GN):
            cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
            if not in_core(mask, cx, cy, 0.0, tw):
                continue
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            for lit in (True, False):
                if lit:
                    if j == GN - 1 or in_core(mask, cx, cy + 1 / GN, 0.0, tw) or (cham and cx > xa - CH):
                        continue
                else:
                    if i == GN - 1 or in_core(mask, cx + 1 / GN, cy, 0.0, tw) or (cham and cy > ya - CH):
                        continue
                if skipped(cx, cy):
                    continue
                u = cx + 0.5 if lit else cy + 0.5
                for k in range(nz):
                    za, zb = zs + (top - zs) * k / nz, zs + (top - zs) * (k + 1) / nz
                    col = _wall_col(c, fam, lit, u, (za + zb) / 2, top, zs)
                    if lit:
                        m.poly([core.G(x0, y1, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x0, y1, zb)], col)
                    else:
                        m.poly([core.G(x1, y0, za), core.G(x1, y1, za), core.G(x1, y1, zb), core.G(x1, y0, zb)], col)
    if cham:                                             # 45 degree corner face
        for k in range(nz):
            za, zb = zs + (top - zs) * k / nz, zs + (top - zs) * (k + 1) / nz
            col = _wall_col(c, fam, True, 0.5, (za + zb) / 2, top, zs)
            for q in range(5):
                t0, t1 = q / 5 * CH, (q + 1) / 5 * CH
                m.poly([core.G(xa - CH + t0, ya - t0, za), core.G(xa - CH + t1, ya - t1, za),
                        core.G(xa - CH + t1, ya - t1, zb), core.G(xa - CH + t0, ya - t0, zb)], col)


def block(mask, fam, deco=None, name=None, full=False):
    """deco: colour variant (hull: 1 swaps the ochre / blue-grey bands)."""
    m = core.Mesh(name or f"wall_{fam}_{mask}", flat=True)
    emit(m, mask, fam, 1 if deco == 1 else 0, full)
    return [m.build()]


def hazard(side, bits):
    """Hazard stripe at the foot of a hull slope (overlay, same geometry as the slope of the matching piece).
    side 's'/'e'; bits: 1 = back end connected (W for s, N for e), 2 = front end connected (E for s, S for e)."""
    m = core.Mesh(f"haz_{side}_{bits}", flat=True)
    if side == "s":
        mask = (8 if bits & 1 else 0) | (2 if bits & 2 else 0) | 1
    else:
        mask = (1 if bits & 1 else 0) | (4 if bits & 2 else 0) | 8
    for kind, i, j, pts in cells(mask, profile("hull", False)[2], TWH):
        if kind != "tri":
            continue
        gx, gy = _grad(pts)
        pure = (side == "s" and gy < -1e-6 and abs(gx) < 1e-6) or (side == "e" and gx < -1e-6 and abs(gy) < 1e-6)
        if pure and max(p[2] for p in pts) <= profile("hull", False)[2] * 3 / NT + 1e-9:
            xs = i if side == "s" else j
            m.poly([core.G(x, y, z + 0.002) for x, y, z in pts], "hazY" if (xs // 2) % 2 == 0 else "hazK")
    return [m.build()]
