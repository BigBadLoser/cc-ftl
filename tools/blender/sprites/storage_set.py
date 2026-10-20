"""The storage set (family `storage_set`): seven storage modules, each with the crate's three fills (.empty, .partial,
.full) in four rotations. Local frame and placement: modkit.K (front = +v, the side a crew member uses).

Fill reads from across the room: closed and lit = untouched, doors swung open and bare shelves = looted. Fill lamps
follow module.storage: orange empty, cyan partial, magenta full.

  locker     1x1 wall locker, back to the wall: two doors; partial opens one, empty opens both on bare shelves
  rack       2x1 open shelving for aisles, reachable from both long sides: boxes on three shelves
  pallet     2x2 floor pallet: a strapped crate stack
  container  2x3 cargo container, doors on the front end: partial has one door open on half a load
  tank       2x2 upright tank for fuel, water or O2: a sight-glass gauge shows the level, the top lamp the fill
  cold       2x1 cold store, glass doors on food shelves, frosted and lit inside
  armory     2x1 secure weapon and suit locker behind a grille, a lock light (red locked, green open)"""
import math

from .modkit import K, case, crate, lamp, sack, sprites

FILLS = ("empty", "partial", "full")
LAMP = {"empty": "orange", "partial": "cyan", "full": "magenta"}
CARGO = ("rust", "steel", "hivis", "gm", "medWhite", "pcb", "navy")


# ---- locker: 1x1, back against the wall (-v) -----------------------------------------------------------------------

def locker(fill, rot):
    k = K(f"storage_locker_{fill}_{rot}", (1, 1), rot)
    W, D, H, v0 = 0.82, 0.42, 1.5, -0.5          # body against the back edge of the tile
    vb, vf = v0 + 0.02, v0 + 0.02 + D
    vc = (vb + vf) / 2
    k.box(0, vb + 0.02, 0.0, W, 0.04, H, "steelD")                                   # back
    for s in (-1, 1):
        k.box(s * (W / 2 - 0.02), vc, 0.0, 0.04, D, H, "steel", top="steelL")         # sides
    k.box(0, vc, H - 0.04, W, D, 0.06, "steel", top="steelL", bevel=0.01)             # roof
    k.box(0, vc, 0.0, W, D, 0.08, "gmD")                                              # kick plate
    k.box(0, vc - 0.02, 0.08, W - 0.08, D - 0.06, 0.02, "dark")                       # floor of the bay
    for z in (0.5, 0.95):                                                             # shelves
        k.box(0, vc - 0.02, z, W - 0.08, D - 0.08, 0.03, "gm", top="steelL")
    k.box(0, vb + 0.05, 0.1, W - 0.1, 0.02, H - 0.16, "steel")                        # back wall inside
    if fill != "empty":                                                              # cases on the shelves, a sack below
        case(k, -0.15, vc - 0.03, 0.53, 0.34, 0.26, 0.14, "gm")
        case(k, 0.12, vc - 0.03, 0.98, 0.3, 0.26, 0.16, "hivis")
    if fill == "full":
        case(k, 0.14, vc - 0.03, 0.53, 0.28, 0.26, 0.2, "navy")
        case(k, -0.16, vc - 0.03, 0.98, 0.3, 0.26, 0.12, "medWhite")
        case(k, -0.16, vc - 0.03, 1.1, 0.3, 0.26, 0.12, "gm")
        sack(k, -0.15, vc - 0.02, 0.1, 0.16, 0.36, "jacket")
        sack(k, 0.16, vc - 0.02, 0.1, 0.15, 0.32, "steel")
    ang = {"empty": (1.9, 1.9), "partial": (0.0, 1.75), "full": (0.0, 0.0)}[fill]   # (+u door, -u door)
    for side, a in zip((1, -1), ang):                                                # doors hinged at the outer edges
        k.door(side * (W / 2 - 0.02), vf, 0.06, W / 2 - 0.03, H - 0.14, 0.03, "steel", a, side, top="steelL")
        if a == 0:                                                                   # vent slats and handle on a shut door
            cu = side * (W / 4 - 0.01)
            for j in range(3):
                k.box(cu, vf + 0.02, 1.1 + j * 0.07, 0.24, 0.02, 0.03, "dark")
            k.box(side * 0.06, vf + 0.025, 0.7, 0.03, 0.03, 0.16, "steelL")
    k.box(0, vf + 0.01, H - 0.12, 0.26, 0.02, 0.07, "plate")                          # label plate
    lamp(k, 0.24, vf + 0.02, H - 0.11, LAMP[fill], 0.07)
    return k.build()


# ---- rack: 2x1 open shelving ---------------------------------------------------------------------------------------

def rack(fill, rot):
    k = K(f"storage_rack_{fill}_{rot}", (2, 1), rot)
    L, D, H = 1.8, 0.62, 1.12
    for su in (-1, 0, 1):                                                             # uprights
        for sv in (-1, 1):
            k.box(su * (L / 2 - 0.03), sv * (D / 2 - 0.03), 0.0, 0.06, 0.06, H, "gm", top="steelL")
    shelves = (0.08, 0.55, 1.02)                                                      # the top shelf is open to the
    for z in shelves:                                                                 # sky, so it is never in shade
        k.box(0, 0, z, L, D, 0.03, "steelD", top="plate")
        k.box(0, D / 2 - 0.01, z - 0.04, L, 0.02, 0.07, "hazY" if z == shelves[0] else "gmD")  # front lip
    for s in (-1, 1):                                                                 # cross bracing on the ends
        k.box(s * (L / 2 - 0.03), 0, 0.3, 0.03, D - 0.06, 0.03, "gmD", rx=0.0)
    slots = [(-0.6, 0), (-0.15, 0), (0.3, 0), (0.62, 0)]
    keep = {"empty": {(0, 0)}, "partial": {(0, 0), (0, 1), (1, 2), (2, 0), (0, 3)},
            "full": {(z, s) for z in range(3) for s in range(4)}}[fill]
    for zi, z in enumerate(shelves):
        for si, (u, rz) in enumerate(slots):
            if (zi, si) in keep:
                col = CARGO[(zi * 4 + si) % len(CARGO)]
                if zi == 0:                                                         # crates low, cases and sacks higher
                    crate(k, u, 0.0, z + 0.03, 0.36, col, rz=0.06 * ((si % 3) - 1))
                elif (zi + si) % 3 == 0:
                    sack(k, u, 0.0, z + 0.03, 0.15, 0.34, ("jacket", "steel")[si % 2])
                else:
                    case(k, u, 0.0, z + 0.03, 0.36, 0.4, 0.15 + 0.05 * (si % 2), col)
                    if si % 2:
                        case(k, u, 0.0, z + 0.23, 0.3, 0.36, 0.12, "gm")
    if fill == "empty":                                                               # one box knocked on the floor
        crate(k, 0.35, D / 2 + 0.22, 0.0, 0.3, "rust", rz=0.6)
    return k.build()


# ---- pallet: 2x2 floor pallet with a crate stack ------------------------------------------------------------------

def pallet(fill, rot):
    k = K(f"storage_pallet_{fill}_{rot}", (2, 2), rot)
    P = 1.6
    for s in (-1, 0, 1):                                                              # skids
        k.box(s * (P / 2 - 0.08), 0, 0.0, 0.16, P, 0.08, "gmD", top="gm")
    for j in range(5):                                                                # deck boards
        k.box(0, -P / 2 + 0.16 + j * (P - 0.32) / 4, 0.08, P, 0.22, 0.04, "steel", top="steelL")
    z0, s = 0.12, 0.5
    grid = [(-0.52, -0.52), (0.0, -0.52), (0.52, -0.52), (-0.52, 0.0), (0.0, 0.0), (0.52, 0.0), (-0.52, 0.52),
            (0.0, 0.52), (0.52, 0.52)]
    layers = {"empty": 0, "partial": 1, "full": 3}[fill]
    for L in range(layers):
        for i, (u, v) in enumerate(grid):
            if fill == "partial" and i in (2, 5, 8):
                continue
            crate(k, u, v, z0 + L * 0.43, s, ("steel", "rust", "steel", "hivis")[(i + 2 * L) % 4], h=0.42, rz=0.04 * ((i + L) % 3 - 1))
    if fill == "full":                                                                # straps over the stack
        for u in (-0.3, 0.3):
            k.box(u, 0, z0 + 3 * 0.43, 0.06, 1.56, 0.02, "strap")
            for sv in (-1, 1):
                k.box(u, sv * 0.78, z0, 0.06, 0.02, 3 * 0.43, "strap")
    if fill == "empty":                                                               # a loose strap and a lid left behind
        k.box(-0.2, 0.3, 0.12, 0.9, 0.06, 0.015, "strap", rz=0.5)
        k.box(0.35, -0.3, 0.12, 0.45, 0.45, 0.04, "plate", rz=0.3)
    return k.build()


# ---- container: 2x3 cargo container, doors on the front end ------------------------------------------------------

def container(fill, rot):
    k = K(f"storage_container_{fill}_{rot}", (2, 3), rot)
    W, L, H = 1.7, 2.8, 1.62
    vf = L / 2
    body, rib = "navy", "blueGrey"
    k.box(0, -0.04, 0.0, W, L - 0.08, 0.08, "gmD")                                    # floor frame
    k.box(0, -L / 2 + 0.04, 0.0, W, 0.08, H, body)                                    # back wall
    for s in (-1, 1):
        k.box(s * (W / 2 - 0.03), -0.04, 0.0, 0.06, L - 0.08, H, body, top=rib)        # side walls
        for j in range(9):                                                            # corrugation ribs
            k.box(s * (W / 2 + 0.0), -L / 2 + 0.25 + j * 0.29, 0.1, 0.03, 0.12, H - 0.2, rib)
    k.box(0, -0.04, H - 0.06, W, L - 0.08, 0.06, body, top=rib)                       # roof
    for j in range(6):
        k.box(0, -L / 2 + 0.3 + j * 0.44, H, W - 0.2, 0.1, 0.02, rib)                 # roof ribs
    for su in (-1, 1):                                                                # corner castings
        for sv in (-1, 1):
            k.box(su * (W / 2 - 0.04), sv * (L / 2 - 0.08) - 0.04, 0.0, 0.1, 0.1, H, "gmD", top="gm")
    k.box(0, vf - 0.12, H - 0.12, W, 0.1, 0.12, "gmD")                                # door header
    k.box(0, -0.04, 0.08, W - 0.12, L - 0.2, 0.02, "steelD")                          # inside floor
    k.box(0, -L / 2 + 0.1, 0.1, W - 0.12, 0.02, H - 0.2, "gmD")                       # inside back
    load = {"empty": 0, "partial": 3, "full": 6}[fill]
    for i in range(load):                                                              # crates, loaded toward the doors
        u = -0.38 if i % 2 == 0 else 0.38
        v = L / 2 - 0.45 - (i // 2) * 0.62
        crate(k, u, v, 0.1, 0.62, ("rust", "steel", "pcb")[i % 3], h=0.55)
        crate(k, u, v, 0.65, 0.56, ("steel", "navy", "rust")[i % 3], h=0.5)
    ang = {"empty": (2.0, 2.0), "partial": (0.0, 1.9), "full": (0.0, 0.0)}[fill]    # (+u door, -u door)
    for side, a in zip((1, -1), ang):
        k.door(side * (W / 2 - 0.04), vf - 0.02, 0.08, W / 2 - 0.04, H - 0.22, 0.04, body, a, side, top=rib)
        if a == 0:
            for j in range(2):                                                        # lock bars
                cu = side * (0.12 + j * 0.42)
                k.box(cu, vf + 0.02, 0.12, 0.04, 0.04, H - 0.3, "steelL")
                k.box(cu, vf + 0.04, 0.6, 0.07, 0.04, 0.05, "gm")
    k.box(-0.45, vf + 0.01, H - 0.32, 0.3, 0.02, 0.14, "plate")                       # placard
    lamp(k, 0.55, vf + 0.01, H - 0.3, LAMP[fill], 0.09)
    return k.build()


# ---- tank: 2x2 pressure vessel in a skid frame, a sight-glass level gauge ----------------------------------------

def tank(fill, rot):
    k = K(f"storage_tank_{fill}_{rot}", (2, 2), rot)
    F, R, z0, H = 1.7, 0.74, 0.18, 1.28                                               # R: tangent to the side rails
    TOP = z0 + H + 0.2                                                                # the dome's top
    for su in (-1, 1):                                                                # skid: base rails, corner posts
        k.box(su * (F / 2 - 0.05), 0, 0.0, 0.1, F, 0.1, "gmD", top="gm")
        k.box(0, su * (F / 2 - 0.05), 0.0, F, 0.1, 0.1, "gmD", top="gm")
        for sv in (-1, 1):
            k.box(su * (F / 2 - 0.06), sv * (F / 2 - 0.06), 0.0, 0.13, 0.13, TOP + 0.06, "gm", top="steelL",
                  bevel=0.01)                                                        # posts the full height
        k.box(su * (F / 2 - 0.06), 0, TOP - 0.04, 0.1, F - 0.1, 0.1, "gmD", top="gm")   # top rails at the dome
        k.box(0, su * (F / 2 - 0.06), TOP - 0.04, F - 0.1, 0.1, 0.1, "gmD", top="gm")
    for j in range(5):                                                                # hazard stripes on the front rail
        k.box(-0.5 + j * 0.25, F / 2 - 0.0, 0.02, 0.1, 0.02, 0.06, "hazY" if j % 2 == 0 else "hazK")
    pc = F / 2 - 0.06                                                                 # corner post centre
    for su in (-1, 1):                                                                # mounts: each corner post braced
        for sv in (-1, 1):                                                            # to the shell, low and high
            a = math.atan2(sv, su)
            d0 = R - 0.02
            d1 = math.hypot(pc, pc) - 0.05
            cm = (d0 + d1) / 2
            for z in (z0 + 0.12, z0 + H - 0.2):
                k.box(math.cos(a) * cm, math.sin(a) * cm, z, d1 - d0, 0.08, 0.1, "gmD", top="gm", rz=a)
            k.box(math.cos(a) * (R + 0.01), math.sin(a) * (R + 0.01), z0 + 0.08, 0.06, 0.2, H - 0.12, "steel", rz=a)
    k.box(0, 0, 0.1, F - 0.2, 0.12, 0.08, "gmD")                                      # saddle under the vessel
    k.box(0, 0, 0.1, 0.12, F - 0.2, 0.08, "gmD")
    k.cyl(0, 0, z0 - 0.04, R * 0.85, 0.06, "gmD", sides=16)                           # foot ring
    k.cyl(0, 0, z0, R, H, "plate", top="plate", sides=16)                             # shell
    for z in (z0 + 0.1, z0 + H - 0.14):                                               # weld bands
        k.cyl(0, 0, z, R + 0.015, 0.05, "steel", sides=16)
    k.cyl(0, 0, z0 + 0.5, R + 0.02, 0.2, "polyB", sides=16)                           # contents band
    k.cyl(0, 0, z0 + H, R, 0.12, "plate", rtop=R * 0.78, sides=16)                    # dome, in two steps
    k.cyl(0, 0, z0 + H + 0.12, R * 0.78, 0.08, "plate", rtop=R * 0.45, sides=16)
    k.cyl(-0.16, -0.12, z0 + H + 0.14, 0.17, 0.08, "gm", top="steelL", sides=10)       # manway hatch
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        k.cyl(-0.16 + math.cos(ang) * 0.13, -0.12 + math.sin(ang) * 0.13, z0 + H + 0.2, 0.025, 0.03, "steelL", sides=6)
    k.cyl(0.24, 0.1, z0 + H + 0.08, 0.05, 0.18, "gm", top="steelL", sides=8)          # relief valve stack
    k.cyl(0.24, 0.1, z0 + H + 0.26, 0.08, 0.06, "medRed", sides=8)
    g = math.pi / 2 + 0.32                                                            # gauge on the front face, clear of
                                                                                      # the front corner post
    ca, sa = math.cos(g), math.sin(g)
    gr = R + 0.09
    for z in (z0 + 0.22, z0 + H - 0.2):                                               # brackets
        k.box(ca * (R + 0.04), sa * (R + 0.04), z, 0.1, 0.05, 0.05, "gm", rz=g)
    k.box(ca * gr, sa * gr, z0 + 0.18, 0.12, 0.12, H - 0.3, "gmD", top="gm", rz=g)    # gauge housing
    gh = H - 0.46
    level = {"empty": 0.08, "partial": 0.5, "full": 0.94}[fill]
    k.box(ca * (gr + 0.03), sa * (gr + 0.03), z0 + 0.26, 0.07, 0.07, gh, "glassD", rz=g)   # the sight glass
    k.box(ca * (gr + 0.035), sa * (gr + 0.035), z0 + 0.26, 0.07, 0.072, gh * level, "cyan", rz=g)   # fluid column
    for t in range(5):                                                                # tick marks beside the glass
        k.box(ca * (gr + 0.02) - sa * 0.08, sa * (gr + 0.02) + ca * 0.08, z0 + 0.26 + gh * t / 4, 0.05, 0.03, 0.025,
              "steelL", rz=g)
    col = {"empty": "red", "partial": "orange", "full": "green"}[fill]               # one fill light, same size always
    k.box(ca * gr, sa * gr, z0 + H - 0.12, 0.14, 0.14, 0.05, "gmD", rz=g)              # on top of the gauge housing
    k.box(ca * gr, sa * gr, z0 + H - 0.07, 0.1, 0.1, 0.08, col, rz=g)
    a = 0.3                                                                           # outlet line and valve wheel
    ou, ov = math.cos(a) * (R + 0.03), math.sin(a) * (R + 0.03)
    k.box(ou, ov, 0.1, 0.1, 0.1, z0 + 0.3, "gm", top="steelL")
    k.box(ou, ov, z0 + 0.24, 0.16, 0.16, 0.08, "steelL")
    k.cyl(ou, ov, z0 + 0.32, 0.12, 0.04, "brass", sides=10)
    return k.build()


# ---- cold store: 2x1, back to the wall, glass doors ---------------------------------------------------------------

def cold(fill, rot):
    k = K(f"storage_cold_{fill}_{rot}", (2, 1), rot)
    W, D, H, v0 = 1.76, 0.6, 1.5, -0.5
    vb, vf = v0 + 0.02, v0 + 0.02 + D
    vc = (vb + vf) / 2
    k.box(0, vb + 0.02, 0.0, W, 0.04, H, "medWhite")
    for s in (-1, 0, 1):
        k.box(s * (W / 2 - 0.03), vc, 0.0, 0.06 if s else 0.05, D, H, "medWhite", top="plate")
    k.box(0, vc, H - 0.12, W, D, 0.12, "medWhite", top="plate", bevel=0.01)           # cap
    k.box(0, vf, H - 0.1, W - 0.1, 0.02, 0.06, "iceB")                                  # lit header strip
    k.box(0, vc, 0.0, W, D, 0.12, "gmD")                                                # plinth vents
    for j in range(6):
        k.box(-0.6 + j * 0.24, vf + 0.005, 0.03, 0.14, 0.01, 0.06, "dark")
    k.box(0, vb + 0.05, 0.12, W - 0.12, 0.02, H - 0.26, "iceB")                         # lit inside back
    shelves = (0.14, 0.55, 0.96)
    for z in shelves:
        k.box(0, vc - 0.02, z, W - 0.12, D - 0.1, 0.025, "steelL")
    food = ("orange", "pcb", "medWhite", "hivis", "medRed", "pcb")
    n = {"empty": 0, "partial": 7, "full": 15}[fill]
    for i in range(n):                                                                # trays and packs on the shelves
        zi, si = i % 3, i // 3
        u = -0.62 + si * 0.3 + (0.08 if zi == 1 else 0)
        col = food[(i * 5) % len(food)]
        k.box(u, vc - 0.02, shelves[zi] + 0.025, 0.26, 0.34, 0.2 if i % 2 else 0.15, col, top="plate", bevel=0.01)
    for s_ in (-1, 1):                                                                # glass doors: frames, a glare strip
        cu = s_ * W / 4
        for e in (-1, 1):
            k.box(cu + e * (W / 4 - 0.06), vf + 0.01, 0.13, 0.05, 0.03, H - 0.28, "steelL")
        for z in (0.13, H - 0.2):
            k.box(cu, vf + 0.01, z, W / 2 - 0.1, 0.03, 0.05, "steelL")
        k.box(cu - 0.12, vf + 0.02, 0.3, 0.05, 0.01, 0.8, "glassL", rx=0.0)            # glare on the glass
        k.box(cu, vf + 0.02, 0.18, W / 2 - 0.16, 0.012, 0.1, "iceB")                     # frost along the bottom
        k.box(s_ * 0.07, vf + 0.04, 0.5, 0.03, 0.03, 0.4, "steelL")                     # handles
    lamp(k, W / 2 - 0.18, vf + 0.02, H - 0.08, LAMP[fill], 0.07)
    return k.build()


# ---- armory: 2x1 secure locker behind a grille --------------------------------------------------------------------

def armory(fill, rot):
    k = K(f"storage_armory_{fill}_{rot}", (2, 1), rot)
    W, D, H, v0 = 1.76, 0.56, 1.55, -0.5
    vb, vf = v0 + 0.02, v0 + 0.02 + D
    vc = (vb + vf) / 2
    k.box(0, vb + 0.02, 0.0, W, 0.04, H, "gmD")
    for s in (-1, 1):
        k.box(s * (W / 2 - 0.04), vc, 0.0, 0.08, D, H, "gm", top="steelL", bevel=0.01)
    k.box(0, vc, H - 0.1, W, D, 0.1, "gm", top="steelL", bevel=0.01)
    k.box(0, vc, 0.0, W, D, 0.1, "gmD", top="gm")
    k.box(0, vb + 0.05, 0.1, W - 0.16, 0.02, H - 0.2, "steel")                          # inside back (light, so the
                                                                                       # contents read through the bars)
    k.box(0, vb + 0.08, 1.28, W - 0.2, 0.06, 0.04, "steelD")                            # gun rail
    guns = {"empty": 0, "partial": 2, "full": 4}[fill]
    for i in range(guns):                                                             # rifles, muzzle up
        u = -0.72 + i * 0.16
        k.box(u, vb + 0.12, 0.3, 0.08, 0.08, 0.9, "gm", top="steelL")
        k.box(u, vb + 0.17, 0.58, 0.07, 0.1, 0.22, "dark")                              # magazine
        k.box(u, vb + 0.12, 0.3, 0.1, 0.12, 0.16, "hazY" if i % 2 else "steelL")        # stock
    suits = {"empty": 0, "partial": 1, "full": 2}[fill]
    for i in range(suits):                                                            # hanging armour suits
        u = 0.2 + i * 0.38
        k.box(u, vb + 0.2, 0.55, 0.3, 0.2, 0.55, "medWhite", top="plate", bevel=0.03)    # torso
        k.box(u, vb + 0.2, 0.2, 0.26, 0.18, 0.35, "plate", bevel=0.02)                   # legs
        k.cyl(u, vb + 0.2, 1.12, 0.13, 0.22, "medWhite", top="plate", sides=10)          # helmet
        k.box(u, vb + 0.31, 1.18, 0.16, 0.02, 0.08, "brass")                            # visor
    ang = {"empty": (1.8, 1.8), "partial": (0.0, 0.0), "full": (0.0, 0.0)}[fill]
    for side, a in zip((1, -1), ang):                                                 # grille doors: frame and bars
        hu = side * (W / 2 - 0.08)
        w = W / 2 - 0.08
        if a == 0:                                                                     # shut: a frame and bars
            cu = hu - side * w / 2
            for e in (-1, 1):
                k.box(cu + e * (w / 2 - 0.03), vf, 0.1, 0.06, 0.04, H - 0.2, "gm", top="steelL")
            for z in (0.1, H - 0.16):
                k.box(cu, vf, z, w, 0.04, 0.06, "gm", top="steelL")
            k.box(cu, vf, 0.62, w, 0.04, 0.05, "gm")
            for j in range(4):
                k.box(hu - side * (0.16 + j * 0.16), vf + 0.01, 0.16, 0.035, 0.035, H - 0.32, "gmD")
        else:
            k.door(hu, vf, 0.1, w, H - 0.2, 0.04, "gm", a, side, top="steelL")
    lock = "red" if fill != "empty" else "green"
    k.box(0, vf + 0.04, 0.72, 0.14, 0.04, 0.22, "gmD", bevel=0.01)                      # lock box
    k.box(0, vf + 0.065, 0.84, 0.08, 0.02, 0.06, lock)                                  # lock light
    k.box(0, vf + 0.065, 0.74, 0.08, 0.02, 0.06, "steelL")                               # keypad
    for s in (-1, 1):
        k.box(s * 0.62, vf + 0.01, H - 0.08, 0.28, 0.02, 0.05, "hazY")                   # hazard tabs on the header
    return k.build()


BUILDERS = {"locker": ((1, 1), locker), "rack": ((2, 1), rack), "pallet": ((2, 2), pallet),
            "container": ((2, 3), container), "tank": ((2, 2), tank), "cold": ((2, 1), cold),
            "armory": ((2, 1), armory)}


def jobs(rots=range(4)):
    out = []
    for name, (fp, fn) in BUILDERS.items():
        out += sprites(f"module.storage_{name}", fp, FILLS, fn, rots)
    return out
