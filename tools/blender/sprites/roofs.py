"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

Heavy armour seen from above, in the hull's ochre / blue-grey language. The layout lives in `roof_layout.py` (pure
Python): 4x4-tile armour modules with a riveted frame rail on each module's N / W side, 2-3 raised plates per module
(lit S lip, shaded E lip, grooves), a recessed pocket with corner bolts or a riveted strap on every plate, and colour
courses (module columns alternate). No objects sit on the roof.

Production sprites: see SPRITES at the end (the v12 set: C palette, patch and inset plates, livery masks). The
older builders (base, edge, generic and the marker tiles) are kept for the review tools only.
"""
from . import core
from . import roof_layout as rl
from . import walls

T = walls.ROOF_T  # roof slab thickness, shown as a face on open S / E sides
ZB = walls.HF     # slab underside sits on the interior walls
ZR = ZB + T       # roof top (= walls.hull_top(), flush with the hull): the plating is drawn here
GN = rl.GN


def _grid(m, grid):
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: grid[j][i])


def _slab(m, side, f):
    z, z0 = ZR, ZB
    if side == "s":
        a, b = (-0.5, 0.5), (0.5, 0.5)
    else:
        a, b = (0.5, -0.5), (0.5, 0.5)
    face = f["fs"] if side == "s" else f["fe"]
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z), core.G(*a, z)], face)
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z0 + 0.035), core.G(*a, z0 + 0.035)], f["k"])


def base(layout, col, u, v):
    m = core.Mesh(f"roof_p{layout}{col}_{u}{v}", flat=True)
    _grid(m, rl.tile_cells(layout, col, u, v))
    return [m.build()]


def edge(side, col):
    m = core.Mesh(f"roof_edge_{side}{col}", flat=True)
    cells = rl.edge_cells(side, col)
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: cells.get((i, j)))
    if side in ("s", "e"):
        _slab(m, side, rl.FAM[col])
    return [m.build()]


def _legacy_tile(m, mask, col="b"):
    f = rl.FAM[col]
    g = [[f["top"]] * GN for _ in range(GN)]
    for side, bit in (("n", 1), ("e", 2), ("s", 4), ("w", 8)):
        if not mask & bit:
            for (i, j), c in rl.edge_cells(side, col).items():
                g[j][i] = c
    _grid(m, g)
    for side, bit in (("s", 4), ("e", 2)):
        if not mask & bit:
            _slab(m, side, f)


def generic(mask):
    m = core.Mesh(f"roof_generic_{mask}", flat=True)
    _legacy_tile(m, mask)
    return [m.build()]


def weapon(mask):
    m = core.Mesh(f"roof_weapon_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.34, 0.025, "steelD", sides=8, top="steelL")                  # turret ring
    m.cyl((0, 0, z + 0.025), 0.29, 0.02, "dark", sides=8)
    m.cyl((0, 0, z + 0.045), 0.25, 0.05, "gmD", sides=8, top="gm", rtop=0.22)        # armoured hatch
    m.box((0, 0, z + 0.095), (0.4, 0.07, 0.025), "dark", base=True)                  # shutter slit
    m.box((0, 0, z + 0.095), (0.07, 0.4, 0.025), "steelD", base=True)
    return [m.build()]


def shield(mask):
    m = core.Mesh(f"roof_shield_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.33, 0.04, "steelD", sides=8, top="steelL")                    # collar
    m.cyl((0, 0, z + 0.04), 0.27, 0.07, "gm", sides=8, rtop=0.23)                    # dome, three stacked bands
    m.cyl((0, 0, z + 0.11), 0.23, 0.07, "plate", sides=8, rtop=0.16)
    m.cyl((0, 0, z + 0.18), 0.16, 0.06, "steelL", sides=8, rtop=0.07)
    m.cyl((0, 0, z + 0.24), 0.045, 0.06, "cyan", sides=8, rtop=0.02)                 # emitter tip (glows)
    return [m.build()]


def engine(mask):
    m = core.Mesh(f"roof_engine_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.box((0, 0, z), (0.7, 0.7, 0.05), "gmD", top="steel", base=True)                # vent frame
    m.box((0, 0, z + 0.05), (0.58, 0.58, 0.02), "dark", base=True)
    for k in range(5):                                                               # louvres
        m.box((0, -0.2 + k * 0.1, z + 0.065), (0.54, 0.05, 0.03), "steelD", top="gm", base=True)
    m.box((0, 0.27, z + 0.06), (0.5, 0.03, 0.02), "orange", base=True)               # heat leaking out (glows)
    return [m.build()]


# ---- v7 variant studies (preview only; see roof_variants.py) ---------------------------------------------------
DZ = 4 / core.ZPX         # raised armour belt (variant B): one plate thickness, exactly 4 px, drawn with an anchor offset
BEV = 0.05                # belt step bevel width (tiles)


def variant_base(layout, col, u, v, variant="v6", patch=False, paint=None, mesh=core.Mesh):
    from . import roof_variants as rv
    g, raised = rv.tile(layout, col, u, v, variant, patch, paint)
    fam = (rv.FAM_C if variant == "C" else rl.FAM)[col]
    m = mesh(f"roof_{variant}_{layout}{col}_{u}{v}", flat=True)
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: None if (i, j) in raised else g[j][i])
    if raised:
        zb = ZR + rv.DZ_BLISTER
        m.pattern((-0.5, -0.5, zb), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: g[j][i] if (i, j) in raised else None)
        for i, j in raised:                        # blister side faces; at a tile edge always (a continuing neighbour covers it)
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            if (i, j + 1) not in raised:
                m.poly([core.G(x0, y1, ZR), core.G(x1, y1, ZR), core.G(x1, y1, zb), core.G(x0, y1, zb)], fam["fs"])
            if (i + 1, j) not in raised:
                m.poly([core.G(x1, y0, ZR), core.G(x1, y1, ZR), core.G(x1, y1, zb), core.G(x1, y0, zb)], fam["fe"])
    return [m.build()]


def inset_base(layout, col, u, v, patch=False, mesh=core.Mesh):
    """v10 base tile on a recessed plate: the plate floor sits DI px below ZR, with a bevelled rim on the far
    side (lit N chamfer, shaded W chamfer) where the plate starts, and a shaded near (S / E) lip on the floor."""
    from . import roof_variants as rv
    g, _ = rv.tile(layout, col, u, v, "C", patch, None)
    f = rv.FAM_C[col]
    x0, y0, w, h, _t, _f = rv.inset_plate(layout, u, v)
    g = [list(r) for r in g]
    floor = {f["top"]: f["t2"]}                    # the recessed floor reads one tone darker
    for j in range(GN):
        for i in range(GN):
            if g[j][i] == f["lit"] and (j == GN - 1 and v == y0 + h - 1):
                g[j][i] = f["shd"]                  # near (S) lip in shade
            else:
                g[j][i] = floor.get(g[j][i], g[j][i])
    di, b = rv.DI / core.ZPX, 1.0 / GN
    zf, zb = ZR - di, ZR - di * 0.4
    m = mesh(f"roof_inset_{layout}{col}_{u}{v}", flat=True)
    m.pattern((-0.5, -0.5, zf), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: g[j][i])
    if v == y0:                                     # far N rim: thin lit bevel, then the S-facing wall
        m.poly([core.G(-0.5, -0.5, ZR), core.G(0.5, -0.5, ZR), core.G(0.5, -0.5 + b, zb), core.G(-0.5, -0.5 + b, zb)], f["lit"])
        m.poly([core.G(-0.5, -0.5 + b, zb), core.G(0.5, -0.5 + b, zb), core.G(0.5, -0.5 + b, zf), core.G(-0.5, -0.5 + b, zf)], f["fs"])
    if u == x0:                                     # far W rim: shaded bevel, then the E-facing wall
        m.poly([core.G(-0.5, -0.5, ZR), core.G(-0.5 + b, -0.5, zb), core.G(-0.5 + b, 0.5, zb), core.G(-0.5, 0.5, ZR)], f["shd"])
        m.poly([core.G(-0.5 + b, -0.5, zb), core.G(-0.5 + b, -0.5, zf), core.G(-0.5 + b, 0.5, zf), core.G(-0.5 + b, 0.5, zb)], f["fe"])
    return [m.build()]


def variant_edge(side, col, variant="v6", tall=False, mesh=core.Mesh):
    from . import roof_variants as rv
    fam = (rv.FAM_C if variant == "C" else rl.FAM)
    f = fam[col]
    m = mesh(f"roof_{variant}_edge_{side}{col}", flat=True)
    if side in ("n", "w"):
        cv = rl._Canvas(f, GN)
        rl._girder(cv, side, GN)
        cells = {(i, j): c for j, row in enumerate(cv.g) for i, c in enumerate(row) if c}
    elif side == "s":
        cells = {(k, GN - 1): f["lit"] for k in range(GN)}
    else:
        cells = {(GN - 1, k): f["shd"] for k in range(GN)}
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: cells.get((i, j)))
    if side in ("s", "e"):
        t = T + DZ if tall else T
        z, z0 = ZR, ZR - t
        a, b = ((-0.5, 0.5), (0.5, 0.5)) if side == "s" else ((0.5, -0.5), (0.5, 0.5))
        m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z), core.G(*a, z)], f["fs"] if side == "s" else f["fe"])
        m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z0 + 0.035), core.G(*a, z0 + 0.035)], f["k"])
    return [m.build()]


def belt_step(col, variant="v6"):
    """Bevelled E step of a raised belt tile (absolute z ZR..ZR+DZ, drawn with the belt tile at its normal anchor):
    a short vertical riser, then a 45-ish chamfer back onto the belt top, with a lit arris along the top."""
    from . import roof_variants as rv
    f = (rv.FAM_C if variant == "C" else rl.FAM)[col]
    m = core.Mesh(f"roof_step_{variant}{col}", flat=True)
    zr = ZR + DZ * 0.25
    m.poly([core.G(0.5, -0.5, ZR), core.G(0.5, 0.5, ZR), core.G(0.5, 0.5, zr), core.G(0.5, -0.5, zr)], f["fe"])
    xb = 0.5 - BEV
    m.poly([core.G(0.5, -0.5, zr), core.G(0.5, 0.5, zr), core.G(xb, 0.5, ZR + DZ), core.G(xb, -0.5, ZR + DZ)], f["shd"])
    m.poly([core.G(xb, -0.5, ZR + DZ + 0.002), core.G(xb, 0.5, ZR + DZ + 0.002), core.G(xb + 0.016, 0.5, ZR + DZ - 0.012),
            core.G(xb + 0.016, -0.5, ZR + DZ - 0.012)], f["lit"])
    m.poly([core.G(0.5, -0.5, ZR), core.G(0.5, 0.5, ZR), core.G(0.5, 0.5, ZR + 0.015), core.G(0.5, -0.5, ZR + 0.015)], f["k"])
    return [m.build()]


def trench(side, col="b", variant="v6"):
    from . import roof_variants as rv
    cells = rv.trench_cells(side, rv.FAM_C if variant == "C" else rl.FAM, col)
    m = core.Mesh(f"roof_trench_{variant}{side}{col}", flat=True)
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: cells.get((i, j)))
    return [m.build()]


def livery_mask(name, mirror=False):
    """Livery motif mask: flat cells at ZR in two key colours, mkP (primary) and mkS (secondary). The renderer
    recolours them per scheme as opaque paint with only a faint relief hint taken from the plating underneath
    (formula and constants in roof_livery's docstring: RELIEF_DARK / LIGHT, RELIEF_K_DARK / LIGHT), so one mask set
    serves every scheme."""
    from . import roof_livery as lv
    m = core.Mesh(f"roof_lv_{name}{'_m' if mirror else ''}", flat=True)
    fn = lv.mirrored(name) if mirror else lv.MASKS[name]
    key = {"P": "mkP", "S": "mkS"}
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: key.get(fn(i, j)))
    return [m.build()]


# ---- production set (v12, approved) -----------------------------------------------------------------------------
# Module rule (mirrored in src/render/roofArt.ts): tile (x, y) -> module (x // 4, y // 4), position (x % 4, y % 4),
# layout L = rl.module_layout, colour c = rl.module_colour; the patched plate of every third module (rv.PATCH) and the
# inset plate of about 2 in 3 modules (rv.inset_module / rv.inset_plate) use their own base sprites. Overlays: one
# edge per open side, livery masks (recoloured by the renderer, see roof_livery) between the base and the edges.
#   roof.c<L><c>.<u><v>[.patch|.inset]   base tiles        roof.edge.<n|e|s|w>.<c>   open-side edges
#   roof.lv.<mask>                       livery masks (key colours mkP / mkS)


def _production():
    from . import roof_livery as lv
    from . import roof_variants as rv
    out = []
    for L in range(len(rl.LAYOUTS)):
        for c in rl.FAM:
            for v in range(rl.M):
                for u in range(rl.M):
                    sid = f"roof.c{L}{c}.{u}{v}"
                    out.append((sid, (1, 1), "block", lambda L=L, c=c, u=u, v=v: variant_base(L, c, u, v, "C", False, None)))
                    if rl.plate_at(L, u, v) == rl.LAYOUTS[L][rv.PATCH[L]]:
                        out.append((sid + ".patch", (1, 1), "block", lambda L=L, c=c, u=u, v=v: variant_base(L, c, u, v, "C", True, None)))
                    if rv.inset_plate(L, u, v) is not None:
                        out.append((sid + ".inset", (1, 1), "block", lambda L=L, c=c, u=u, v=v: inset_base(L, c, u, v, False)))
    for s in "nesw":
        for c in rl.FAM:
            out.append((f"roof.edge.{s}.{c}", (1, 1), "block", lambda s=s, c=c: variant_edge(s, c, "C", False)))
    for name in lv.MASKS:
        out.append((f"roof.lv.{name}", (1, 1), "block", lambda n=name: livery_mask(n)))
    for name in lv.MIRROR:
        out.append((f"roof.lv.{name}.m", (1, 1), "block", lambda n=name: livery_mask(n, True)))
    return out


SPRITES = _production()
