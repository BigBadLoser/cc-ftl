"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

Hull-language armour: ochre and blue-grey colour-blocked plates that span 2-4 tiles and run flush to the hull edge
(S / E edges turn down into the plate's own dark slab face). `plate_geom(tx, ty)` is a pure position hash: bands of 2-3
tiles cut into 2-4 tile plates with a brick offset, plus a per-plate sub-plate layout. Surface detail belongs to the
plating itself: plate-boundary seams, a split seam / L-shaped lap seam inside the plate with a slight same-hue tone
change between sub-plates, and neat rivet rows (2x2 cells) inset from the plate edge and along the seams. All of it is
computed in PLATE cell coordinates (32 cells per tile), so rows and seams line up across tiles. The sprite is the
mesh of `tile_grid(...)`; identical grids share a sprite. No objects sit on the roof. Mask bits N1 E2 S4 W8 = connected.
`roof.weapon / .shield / .engine` keep their hints on a plain plate."""
from . import core

ZR = 2.4          # plating height: the top of a full-height wall (= walls.HF)
T = 0.14          # slab thickness shown on open sides
GN = 32
COLS = {          # plate family -> two same-hue tones, +y face, +x face, highlight (rivets, seam lit edge)
    "o": dict(t=("rO1", "rO2"), fy="rOD", fx="rOK", hi="rOL"),
    "b": dict(t=("rB1", "rB2"), fy="rBD", fx="rBK", hi="rBL"),
}


def _h(*v):
    x = 0x9E3779B1
    for a in v:
        x = ((x ^ (a & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF
        x ^= x >> 15
    return x


def plate_geom(tx, ty):
    """Plate containing tile (tx, ty): dict(col, sn, sw, u, v, pw, ph, lay). u, v = tile offset inside the plate."""
    b0, b = 0, 0                                   # y bands of height 2-3
    while True:
        ph = 2 + _h(b, 1) % 2
        if ty < b0 + ph:
            break
        b0 += ph
        b += 1
    x0, k = -(_h(b, 2) % 4), 0                     # x segments of width 2-4, offset per band
    while True:
        pw = 2 + _h(b, k, 3) % 3
        if tx < x0 + pw:
            break
        x0 += pw
        k += 1
    r = _h(b, k, 4) % 100
    lay = _h(b, k, 9) % 100
    return dict(col="o" if r < 50 else "b", sn=1 if ty == b0 else 0, sw=1 if tx == x0 else 0, u=tx - x0, v=ty - b0,
                pw=pw, ph=ph, lay=0 if lay < 30 else 1 if lay < 55 else 2 if lay < 80 else 3)


def _spread(a, b):
    """Evenly spaced rivet positions from a to b inclusive (spacing about 8 cells)."""
    n = max(1, round((b - a) / 8))
    return [round(a + k * (b - a) / n) for k in range(n + 1)]


def _plate_layout(pw, ph, lay):
    """Sub-plate seams in plate cells: ([(axis, pos, a0, a1)], tone2(PU, PV), rivet cells)."""
    PW, PH = pw * 32, ph * 32
    lines, riv = [], set()
    sv, sh = (PW // 2) // 8 * 8, (PH // 2) // 8 * 8
    if lay == 1:
        lines = [("v", sv, 0, PH)]
    elif lay == 2:
        lines = [("h", sh, 0, PW)]
    elif lay == 3:
        lines = [("v", sv, 0, PH), ("h", sh, sv, PW)]
    tone2 = {0: lambda u, v: False, 1: lambda u, v: u >= sv, 2: lambda u, v: v >= sh, 3: lambda u, v: u >= sv and v >= sh}[lay]
    for p in _spread(4, PW - 6):                    # perimeter rows, inset 4 cells
        riv |= {(p, 4), (p, PH - 6)}
    for p in _spread(4, PH - 6):
        riv |= {(4, p), (PW - 6, p)}
    for ax, pos, a0, a1 in lines:                   # rows along the lap seams
        if ax == "v":
            riv |= {(pos + 4, p) for p in _spread(4, PH - 6)}
        else:
            riv |= {(p, pos + 4) for p in _spread(max(a0 + 4, 4), PW - 6)}
    return lines, tone2, riv


def tile_grid(g, mask):
    """32x32 palette names for the tile (rows j, columns i)."""
    c = COLS[g["col"]]
    PW, PH = g["pw"] * 32, g["ph"] * 32
    lines, tone2, riv = _plate_layout(g["pw"], g["ph"], g["lay"])
    ou, ov = g["u"] * 32, g["v"] * 32
    cells = {(ou + i, ov + j): None for j in range(GN) for i in range(GN)}
    open_n, open_w = not mask & 1, not mask & 8
    out = []
    for j in range(GN):
        row = []
        for i in range(GN):
            U, V = ou + i, ov + j
            col = c["t"][1 if tone2(U, V) else 0]
            for ax, pos, a0, a1 in lines:
                d, along = (U - pos, V) if ax == "v" else (V - pos, U)
                if a0 <= along < a1:
                    if d == 0:
                        col = "wallK"
                    elif d == 1:
                        col = c["hi"]
            if g["sn"] and not open_n:
                if j < 2:
                    col = "wallK"
                elif j == 2:
                    col = c["hi"]
            if g["sw"] and not open_w:
                if i < 2:
                    col = "wallK"
                elif i == 2:
                    col = c["hi"]
            row.append(col)
        out.append(row)
    for (pu, pv) in riv:                            # rivets: 2x2 cells, skipped where they would touch a seam
        cs = [(pu + a, pv + b) for a in (0, 1) for b in (0, 1)]
        if all(0 <= u - ou < GN and 0 <= v - ov < GN for u, v in cs) and all(out[v - ov][u - ou] in (c["t"][0], c["t"][1]) for u, v in cs):
            for u, v in cs:
                out[v - ov][u - ou] = c["hi"]
    return out


def _tile(m, mask, col="o", grid=None):
    c = COLS[col]
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, (lambda i, j: grid[j][i]) if grid else (lambda i, j: c["t"][0]))
    z, z0 = ZR, ZR - T
    if not mask & 4:                                # +y edge (lit): the plate turns down into its slab face
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(-0.5, 0.5, z)], c["fy"])
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(-0.5, 0.5, z0 + 0.035)], "wallK")
    if not mask & 2:                                # +x edge (shaded)
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(0.5, -0.5, z)], c["fx"])
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(0.5, -0.5, z0 + 0.035)], "wallK")


def plate(mask, col="o", grid=None):
    m = core.Mesh("roof_plate", flat=True)
    _tile(m, mask, col, grid)
    return [m.build()]


def generic(mask):
    m = core.Mesh(f"roof_generic_{mask}", flat=True)
    _tile(m, mask)
    return [m.build()]


def weapon(mask):
    m = core.Mesh(f"roof_weapon_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.34, 0.025, "steelD", sides=8, top="steelL")                  # turret ring
    m.cyl((0, 0, z + 0.025), 0.29, 0.02, "dark", sides=8)
    m.cyl((0, 0, z + 0.045), 0.25, 0.05, "gmD", sides=8, top="gm", rtop=0.22)        # armoured hatch
    m.box((0, 0, z + 0.095), (0.4, 0.07, 0.025), "dark", base=True)                  # shutter slit
    m.box((0, 0, z + 0.095), (0.07, 0.4, 0.025), "steelD", base=True)
    for sx in (-1, 1):
        m.box((sx * 0.17, 0, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)       # warning tabs
        m.box((0, sx * 0.17, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)
    return [m.build()]


def shield(mask):
    m = core.Mesh(f"roof_shield_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.33, 0.04, "steelD", sides=8, top="steelL")                    # collar
    m.cyl((0, 0, z + 0.04), 0.27, 0.07, "gm", sides=8, rtop=0.23)                    # dome, three stacked bands
    m.cyl((0, 0, z + 0.11), 0.23, 0.07, "plate", sides=8, rtop=0.16)
    m.cyl((0, 0, z + 0.18), 0.16, 0.06, "steelL", sides=8, rtop=0.07)
    m.cyl((0, 0, z + 0.24), 0.045, 0.06, "cyan", sides=8, rtop=0.02)                 # emitter tip (glows)
    for k in range(4):                                                               # emitter nodes
        sx, sy = (-1, 1)[k & 1], (-1, 1)[k >> 1]
        m.cyl((sx * 0.26, sy * 0.26, z), 0.035, 0.1, "gm", sides=4, top="cyan")
    return [m.build()]


def engine(mask):
    m = core.Mesh(f"roof_engine_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.box((0, 0, z), (0.7, 0.7, 0.05), "gmD", top="steel", base=True)                # vent frame
    m.box((0, 0, z + 0.05), (0.58, 0.58, 0.02), "dark", base=True)
    for k in range(5):                                                               # louvres
        m.box((0, -0.2 + k * 0.1, z + 0.065), (0.54, 0.05, 0.03), "steelD", top="gm", base=True)
    m.box((0, 0.27, z + 0.06), (0.5, 0.03, 0.02), "orange", base=True)               # heat leaking out (glows)
    for k in range(4):
        m.box((-0.3 + k * 0.2, -0.355, z + 0.05), (0.1, 0.02, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    return [m.build()]


SPRITES = []
for _name, _fn in (("generic", generic), ("weapon", weapon), ("shield", shield), ("engine", engine)):
    for _m in range(16):
        SPRITES.append((f"roof.{_name}.m{_m}", (1, 1), "block", lambda m=_m, f=_fn: f(m)))
    SPRITES.append((f"roof.{_name}", (1, 1), "block", lambda f=_fn: f(15)))
