"""Economy modules: the fabricator (2x1, idle/active, four rotations) and the storage crate (1x1, three fills).
Origin = centre of the FRONT-most footprint tile at floor level (same as props.py)."""
from . import core

# Fabricator local frame: u along the 2-tile length (-1.45..0.45, centre -0.5), v across (front/operator side = +v).
# Sim rotation r turns the access side (+y at rot 0) clockwise: r1 front -> -x, r2 -> -y, r3 -> +x.
CU = -0.5


def _xf(rot):
    if rot == 0:
        return lambda u, v: (u, v), False
    if rot == 1:
        return lambda u, v: (-v, u), True
    if rot == 2:
        return lambda u, v: (u, -v), False
    return lambda u, v: (v, u), True


def fabricator(active, rot):
    m = core.Mesh(f"fabricator_{rot}_{int(active)}")
    T, swap = _xf(rot)

    def box(u, v, z, su, sv, sz, color, top=None, bevel=0.0):
        x, y = T(u, v)
        s = (sv, su, sz) if swap else (su, sv, sz)
        m.box((x, y, z), s, color, top=top, base=True, bevel=bevel)

    def cyl(u, v, z, r, h, color, top=None, rtop=None):
        x, y = T(u, v)
        m.cyl((x, y, z), r, h, color, sides=8, top=top, rtop=rtop)

    box(CU, 0, 0, 1.9, 0.92, 0.1, "steelD", "plateA", 0.015)                      # base plate
    box(CU, -0.3, 0.1, 1.86, 0.3, 0.72, "steelD", "steel", 0.015)                 # rear housing
    for k in range(5):                                                            # vent slats on the housing front
        box(CU + 0.55 + k * 0.1, -0.148, 0.5, 0.05, 0.012, 0.26, "dark")
    box(CU, -0.148, 0.62, 1.7, 0.012, 0.03, "cyan")                               # trim line (glow)
    box(-1.12, -0.148, 0.2, 0.42, 0.012, 0.26, "dark")                            # control panel
    for k, col in enumerate(("magenta", "cyan", "cyan")):
        box(-1.28 + k * 0.12, -0.138, 0.3, 0.06, 0.012, 0.04, col)
    box(CU, 0.1, 0.1, 1.5, 0.5, 0.24, "steel", "steelL", 0.015)                   # work bed
    box(CU, 0.1, 0.34, 1.36, 0.38, 0.012, "dark")                                 # bed surface
    box(CU, 0.37, 0.1, 1.5, 0.02, 0.1, "hazY")                                    # hazard edge on the front
    box(CU, -0.02, 0.82, 1.84, 0.36, 0.1, "gmD", "gm", 0.01)                      # gantry rail
    box(-0.2, 0.06, 0.72, 0.3, 0.28, 0.1, "gm", "plate", 0.01)                    # carriage
    cyl(-0.2, 0.1, 0.46, 0.045, 0.26, "gm", "plate")                              # arm
    cyl(-0.2, 0.1, 0.38, 0.03, 0.08, "steelL", "plate", rtop=0.06)                # nozzle
    box(-0.2, 0.1, 0.34, 0.05, 0.05, 0.04, "orange" if active else "steelD")      # nozzle tip
    box(0.38, 0.4, 0.1, 0.08, 0.08, 0.34, "gmD", "gm")                            # light post
    box(0.38, 0.4, 0.44, 0.11, 0.11, 0.08, "orange" if active else "cyan")        # status light
    if active:
        box(-0.2, 0.1, 0.34, 0.34, 0.2, 0.05, "steelL", "orange")                 # glowing work piece
        for (du, dv, z, s) in ((0.1, 0.0, 0.44, 0.04), (-0.08, 0.16, 0.52, 0.03), (0.0, -0.06, 0.38, 0.03), (-0.34, 0.12, 0.46, 0.03)):
            box(-0.2 + du, 0.1 + dv, z, s, s, s, "flameW")                        # sparks
        box(-0.2, 0.1, 0.395, 0.03, 0.03, 0.045, "flameY")                        # beam
    return [m.build()]


# ---- storage: an open-topped steel bin; contents show how full it is ---------------------------------------------

CARGO = ("rust", "steel", "hivis", "gm", "medWhite", "pcb")


def storage(fill):
    m = core.Mesh(f"storage_{fill}")
    m.box((0, 0, 0), (0.94, 0.94, 0.12), "steelD", top="dark", base=True, bevel=0.012)              # base and bin floor
    for sx, sy, w, d in ((0, 0.43, 0.88, 0.08), (0, -0.43, 0.88, 0.08), (0.43, 0, 0.08, 0.78), (-0.43, 0, 0.08, 0.78)):
        m.box((sx, sy, 0.0), (w, d, 0.4), "steel", top="steelL", base=True, bevel=0.01)             # four walls
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):                                              # corner posts
        m.box((sx * 0.43, sy * 0.43, 0.0), (0.1, 0.1, 0.44), "gmD", top="gm", base=True)
    for k in range(4):                                                                               # hazard bands on the two faces
        col = "hazY" if k % 2 == 0 else "hazK"
        m.box((0.475, -0.3 + k * 0.2, 0.14), (0.012, 0.1, 0.1), col, base=True)
        m.box((-0.3 + k * 0.2, 0.475, 0.14), (0.1, 0.012, 0.1), col, base=True)
    lamp = {"empty": "orange", "partial": "cyan", "full": "magenta"}[fill]                          # fill-level lamp, both faces
    m.box((0.476, 0.0, 0.26), (0.02, 0.2, 0.05), lamp)
    m.box((0.0, 0.476, 0.26), (0.2, 0.02, 0.05), lamp)
    cargo = {"empty": [],
             "partial": [(-0.2, -0.18, 0.0, 0.3, 0.5), (0.2, -0.14, 0.0, 0.28, -0.2), (-0.02, 0.2, 0.0, 0.3, 0.3)],
             "full": [(-0.2, -0.2, 0.0, 0.34, 0.2), (0.2, -0.2, 0.0, 0.34, -0.2), (-0.2, 0.2, 0.0, 0.34, -0.4), (0.2, 0.2, 0.0, 0.34, 0.3),
                      (-0.06, -0.04, 0.3, 0.34, 0.8), (0.1, 0.14, 0.3, 0.3, -0.3), (-0.08, 0.04, 0.58, 0.26, 0.1)]}[fill]
    for k, (x, y, z, s, rz) in enumerate(cargo):
        m.box((x, y, 0.12 + z), (s, s, s * 0.85), CARGO[k % len(CARGO)], top="plate", rz=rz, base=True, bevel=0.012)
        m.box((x, y, 0.12 + z + s * 0.4), (s + 0.01, s + 0.01, 0.03), "strap", rz=rz, base=True)
    return [m.build()]


SPRITES = []
for _r in range(4):
    _sfx = "" if _r == 0 else f".r{_r}"
    _fp = (2, 1) if _r in (0, 2) else (1, 2)
    SPRITES.append((f"module.fabricator{_sfx}", _fp, "prop", lambda r=_r: fabricator(False, r)))
    SPRITES.append((f"module.fabricator{_sfx}.active", _fp, "prop", lambda r=_r: fabricator(True, r)))
for _f in ("empty", "partial", "full"):
    SPRITES.append((f"module.storage.{_f}", (1, 1), "prop", lambda f=_f: storage(f)))
SPRITES.append(("module.storage", (1, 1), "prop", lambda: storage("partial")))     # the def's asset id; the game picks a fill
