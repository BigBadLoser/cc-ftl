"""Flak cannon bay (2x2) concepts: where the hull scrap the turret fires is loaded, broken up and fed up through the roof.
All stand on the laser bay's lift (flange, rams, keep-clear ring, ram and roof collars) so the 2x2 bays read as a family;
what sets this one apart is the scrap handling round the column. About 36 px a world unit: nothing under 0.06.

  A  SHREDDER   a wide hopper with a hazard-striped rim, loose scrap in it, over a roller housing with brass-hubbed
                bearings and a side motor, a fragment bin under it
  B  CAROUSEL   a ring of fat scrap canisters on a turntable round the column, a compactor ram over the front one,
                a loader channel up from it into the collar
  C  BALER      a press frame on the front: two uprights and a crosshead with a ram, squeezing a block of mottled
                scrap on its bed, beside a breech block on the column

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP = L.P, L.obox, L.FRONT, L.TOP
ZI = TOP - 0.42                       # the ram collar's underside
SCRAP = ("rust", "steel", "rustD", "gm", "orange", "steelL", "rust", "steelD")


def at(r, s, z):
    """A point r out toward the camera (FRONT), s across it (to the camera's right), z up."""
    c, d = math.cos(FRONT), math.sin(FRONT)
    return (r * c - s * d, r * d + s * c, z)


def quad(f, pts, mat):
    f.poly([f.pt(*p) for p in pts], mat, flip=True)


def core_column(f, z0=0.24, r=0.18, bands=(0.6, 1.0, 1.4)):
    _g("core")
    f.vcyl(0, 0, z0, r, TOP - 0.12 - z0, "steelD", sides=24)
    for z in bands:
        f.vcyl(0, 0, z, r + 0.03, 0.07, "steel", top="steelL", sides=24)


# ---- A: SHREDDER ---------------------------------------------------------------------------------------------------

def hopper(f, r, z0, z1, w0, w1, d0, d1):
    """An open funnel centred r out on the front: w half width across, d half depth along FRONT, bottom z0 to rim z1."""
    _g("hopper")
    c = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    lo = [at(r + d0 * a, w0 * b, z0) for a, b in c]
    hi = [at(r + d1 * a, w1 * b, z1) for a, b in c]
    for i in range(4):
        j = (i + 1) % 4
        quad(f, [lo[i], lo[j], hi[j], hi[i]], "gm")
    quad(f, lo, "dark")
    n = 8                                                                                # hazard rim, a stripe a step
    for i in range(4):
        j = (i + 1) % 4
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            p0 = [hi[i][q] + (hi[j][q] - hi[i][q]) * t0 for q in range(3)]
            p1 = [hi[i][q] + (hi[j][q] - hi[i][q]) * t1 for q in range(3)]
            D.seg(f, tuple(p0), tuple(p1), 0.035, "hazY" if k % 2 == 0 else "hazK", 6)


def rollers(f, r, z, half, gap=0.085, rr=0.075):
    _g("rollers")
    for dr in (-gap, gap):
        D.seg(f, at(r + dr, -half, z), at(r + dr, half, z), rr, "steelD", 12, cap="steel", capstart="steel")
        n = 4
        for k in range(n):
            s = -half + (k + 0.5) * 2 * half / n
            D.seg(f, at(r + dr, s - 0.03, z), at(r + dr, s + 0.03, z), rr + 0.04, "steelL", 6, cap="steelL",
                  capstart="steelL")                                                     # tooth discs (6 sides: teeth)


def chunks(f, r, z, half, depth, n=6, seed=7):
    """Loose scrap lying in a hopper: grid-square chunks of mixed metal at uneven heights."""
    _g("scrap")
    k = seed
    for i in range(n):
        for j in range(2):
            k = (k * 1103515245 + 12345) & 0x7fffffff
            s_ = -half + (i + 0.5) * 2 * half / n
            q = r + (j - 0.5) * depth
            cu, cv, _ = at(q, s_, 0)
            w = 0.08 + (k >> 9) % 3 * 0.02
            f.box(cu, cv, z, w, w, 0.05 + (k >> 5) % 3 * 0.03, SCRAP[k % len(SCRAP)], top=SCRAP[(k >> 3) % len(SCRAP)])


def shredder(rot=0):
    m = core.Mesh("bay_flak_shredder")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    L.lift(f)
    core_column(f, bands=(1.3,))
    r = 0.36
    _g("bin")
    obox(f, FRONT, 0.14, 0.56, 0.22, 0.24, 0.5, "gm", "steel")                            # fragment bin
    obox(f, FRONT, 0.56, 0.58, 0.16, 0.3, 0.44, "steelL", "steelL")                       # its door
    _g("housing")
    obox(f, FRONT, 0.14, 0.58, 0.24, 0.5, 0.86, "steelD", "steel")                        # shredder housing
    for side in (-1, 1):
        D.seg(f, at(r, side * 0.24, 0.72), at(r, side * 0.3, 0.72), 0.09, "steel", 12, cap="brass",
              capstart="steel")                                                         # roller bearings, brass hubs
    rollers(f, r, 0.92, 0.22)
    hopper(f, r, 0.86, 1.1, 0.24, 0.36, 0.2, 0.3)
    chunks(f, r, 0.9, 0.2, 0.2)
    _g("motor")
    D.seg(f, at(0.2, 0.3, 0.68), at(0.2, 0.46, 0.68), 0.1, "gm", 14, cap="steel")
    return [m.build()] if cmbkit.REC is None else []


# ---- B: CAROUSEL ---------------------------------------------------------------------------------------------------

def canister(f, u, v, z0, h, r=0.1):
    _g("canister")
    f.vcyl(u, v, z0, r, h, "rust", top="steel", sides=14)
    f.vcyl(u, v, z0 + h * 0.62, r + 0.008, 0.07, "hazY", sides=14)
    f.vcyl(u, v, z0 + h * 0.62 + 0.07, r + 0.008, 0.04, "hazK", sides=14)
    f.vcyl(u, v, z0 + h, r * 0.55, 0.04, "steelL", top="plate", sides=10)


def carousel(rot=0):
    m = core.Mesh("bay_flak_carousel")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    L.lift(f)
    core_column(f, bands=(1.2, 1.5))
    _g("turntable")
    z0 = 0.34
    f.vcyl(0, 0, z0 - 0.08, 0.44, 0.08, "steel", top="steelL", sides=32)                 # turntable
    f.vcyl(0, 0, z0 + 0.62, 0.4, 0.06, "steelD", top="steel", sides=32)                  # retainer ring
    rc, n = 0.3, 6
    for k in range(n):
        a = FRONT + k * math.tau / n
        u, v = P(a, rc)
        canister(f, u, v, z0, 0.56)
    _g("compactor")
    zc = z0 + 0.68
    u, v = P(FRONT, rc)
    obox(f, FRONT, 0.1, rc + 0.16, 0.15, zc + 0.3, zc + 0.46, "gm", "steelL")             # crosshead arm off the column
    D.seg(f, (u, v, zc + 0.3), (u, v, zc + 0.08), 0.05, "steelL", 12)                      # ram rod
    f.vcyl(u, v, zc, 0.12, 0.08, "steelD", top="steel", sides=16)                          # press head over a canister
    return [m.build()] if cmbkit.REC is None else []


# ---- C: BALER ------------------------------------------------------------------------------------------------------

def bale(f, r, z0, size, seed=3):
    """A block of compressed scrap, square to the grid so it shows two faces and its top: a dark core with chunks of
    mixed metal pressed unevenly into each visible face."""
    _g("bale")
    h = size / 2
    cu, cv, _ = at(r, 0, 0)
    f.box(cu, cv, z0, size, size, size, "rustD", top="rustD")
    n, w = 3, size / 3
    k = seed
    for i in range(n):
        for j in range(n):
            for face in range(3):
                k = (k * 1103515245 + 12345) & 0x7fffffff
                mat = SCRAP[k % len(SCRAP)]
                g = 0.015 + (k >> 8) % 3 * 0.012                                          # stands proud unevenly
                a, b = -h + (i + 0.5) * w, (j + 0.5) * w
                if face == 0:                                                              # +u face
                    f.box(cu + h + g / 2 - 0.01, cv + a, z0 + b - w / 2 + 0.005, g + 0.01, w - 0.012, w - 0.012, mat, top=mat)
                elif face == 1:                                                            # +v face
                    f.box(cu + a, cv + h + g / 2 - 0.01, z0 + b - w / 2 + 0.005, w - 0.012, g + 0.01, w - 0.012, mat, top=mat)
                else:                                                                      # top
                    f.box(cu + a, cv - h + b, z0 + size - 0.01, w - 0.012, w - 0.012, g + 0.01, mat, top=mat)


def baler(rot=0):
    m = core.Mesh("bay_flak_baler")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    L.lift(f)
    core_column(f, bands=(1.3,))
    _g("breech")
    obox(f, FRONT, 0.1, 0.26, 0.16, 0.5, 0.86, "gm", "steelL")                            # breech block on the column
    obox(f, FRONT, 0.26, 0.28, 0.12, 0.56, 0.8, "dark", "dark")                            # its mouth
    _g("press")
    r, s = 0.48, 0.22
    for side in (-1, 1):
        obox(f, FRONT, r - 0.05, r + 0.05, 0.05, 0.24, 1.38, "steel", "steelL", off=side * (s + 0.04))   # uprights
    obox(f, FRONT, r - 0.08, r + 0.08, s + 0.1, 1.28, 1.42, "gm", "steelL")               # crosshead
    obox(f, FRONT, r - 0.14, r + 0.14, s + 0.04, 0.24, 0.32, "steelD", "steel")           # bed
    D.seg(f, at(r, 0, 1.28), at(r, 0, 0.98), 0.05, "steelL", 12)                           # ram rod
    obox(f, FRONT, r - 0.13, r + 0.13, s - 0.02, 0.92, 0.98, "steelD", "steel")           # platen
    D.seg(f, at(r, 0, 1.42), at(r, 0, 1.62), 0.09, "steelD", 12, cap="steel")             # press cylinder
    bale(f, r, 0.32, 0.36)
    return [m.build()] if cmbkit.REC is None else []


CONCEPTS = {"flakbayA": shredder, "flakbayB": carousel, "flakbayC": baler}
for _k, _fn in CONCEPTS.items():
    TB.BAYS[_k] = _fn
