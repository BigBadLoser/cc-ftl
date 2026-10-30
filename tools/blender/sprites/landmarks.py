"""Court landmarks (family `landmarks`): signature pieces the station generator sets at a court's middle. Local frame
and placement: modkit.K (front = +v). Four rotations each.

- module.holo_sign: a 2x2 plaza holo-column: a stepped plinth, a steel column with brass bands, a slatted band of
  magenta and cyan light round its head (an advert drum), an emitter dish on top.
- module.tree_large: a 3x3 garden tree: an octagonal raised bed with a seat ledge, a tall tree whose crown clears the
  walls, ground cover round the trunk.
- module.banner: a 1x1 banner post: the banner hangs from a crossbar on a post up the middle of its back, in the ship's
  livery with its roof emblem (roof_livery._emblem) on both faces. The livery is a key-colour mask overlay per emblem,
  module.banner.r{n}.lv.<dot | delta | cross | star | diamond | plain>, recoloured by the renderer like a container's trim.
  A row of them marks a drill hall; any faction's room can fly them."""
import math
import random

from .decor import _foliage
from .modkit import K


def holo_sign(rot):
    k = K(f"holo_sign_{rot}", (2, 2), rot)
    k.cyl(0, 0, 0.0, 0.84, 0.1, "steelD", top="steel", sides=8)                          # plinth
    k.cyl(0, 0, 0.1, 0.62, 0.1, "gmD", top="gm", sides=8)                                # step
    for i in range(8):                                                                 # floor emitters round the step
        a = i * math.tau / 8 + math.tau / 16
        k.box(0.72 * math.cos(a), 0.72 * math.sin(a), 0.1, 0.1, 0.1, 0.02, "cyan")
    k.cyl(0, 0, 0.2, 0.17, 1.55, "steel", top="steelL", sides=10)                         # column
    for z in (0.55, 1.0):                                                              # brass bands
        k.cyl(0, 0, z, 0.2, 0.05, "ochD", top="ochM", sides=10)
    n = 18
    for i in range(n):                                                                 # the advert drum: slats of light
        a = i * math.tau / n
        col = "magenta" if (i // 3) % 2 == 0 else "cyan"
        k.box(0.48 * math.cos(a), 0.48 * math.sin(a), 1.2, 0.1, 0.02, 0.42 if i % 3 != 1 else 0.3, col, rz=a + math.pi / 2)
    k.cyl(0, 0, 1.15, 0.5, 0.03, "gmD", top="steelD", sides=18)                           # the drum's lower rim
    k.cyl(0, 0, 1.75, 0.26, 0.06, "steelD", top="steel", sides=12)                       # cap
    k.cyl(0, 0, 1.81, 0.16, 0.05, "steel", top="cyan", sides=12, rtop=0.2)               # emitter dish
    return k.build()


def tree_large(rot):
    k = K(f"tree_large_{rot}", (3, 3), rot)
    k.cyl(0, 0, 0.0, 1.42, 0.08, "gmD", sides=8)                                         # base
    k.cyl(0, 0, 0.08, 1.32, 0.38, "lvW2", top="lvW", sides=8)                            # cream panels
    k.cyl(0, 0, 0.46, 1.4, 0.05, "steel", top="steelL", sides=8)                         # the rim, a seat ledge
    k.cyl(0, 0, 0.48, 1.24, 0.03, "rustD", top="leather", sides=8)                       # soil
    for i in range(8):                                                                 # a navy trim panel per side
        a = i * math.tau / 8 + math.tau / 16
        k.box(1.24 * math.cos(a), 1.24 * math.sin(a), 0.2, 0.5, 0.012, 0.06, "navy", rz=a + math.pi / 2)
    k.cyl(0, 0, 0.5, 0.16, 1.55, "rustD", top="ochD", sides=8, rtop=0.09)                # trunk
    rnd = random.Random(17)
    for a in (0.3, 1.9, 3.4, 4.9):                                                     # four boughs
        k.box(0.22 * math.cos(a), 0.22 * math.sin(a), 1.55, 0.07, 0.6, 0.07, "rustD", rz=a, rx=0.75)
    for i in range(9):                                                                 # the crown: leaf clumps in two tiers
        tier = 0 if i < 6 else 1
        a = i * (math.tau / 6 if tier == 0 else math.tau / 3) + (0 if tier == 0 else 0.5)
        d = 0.62 if tier == 0 else 0.3
        _foliage(k, d * math.cos(a), d * math.sin(a), 1.65 + 0.35 * tier, 0.5, 0.6, 12, 90 + i)
    _foliage(k, 0, 0, 2.15, 0.45, 0.45, 12, 99)                                        # the top
    for i in range(8):                                                                 # ground cover round the trunk
        a = i * math.tau / 8 + rnd.uniform(-0.3, 0.3)
        _foliage(k, 0.8 * math.cos(a), 0.8 * math.sin(a), 0.5, 0.24, 0.24, 6, 120 + i)
    return k.build()


# ---- holo column variations under review -------------------------------------------------------------------------

def _plinth(k):
    k.cyl(0, 0, 0.0, 0.84, 0.1, "steelD", top="steel", sides=8)
    k.cyl(0, 0, 0.1, 0.62, 0.1, "gmD", top="gm", sides=8)
    for i in range(8):
        a = i * math.tau / 8 + math.tau / 16
        k.box(0.72 * math.cos(a), 0.72 * math.sin(a), 0.1, 0.1, 0.1, 0.02, "cyan")


def holo_ring(rot):
    """B: a slim mast; two thin rings of light float apart from it, a magenta diamond hangs in the middle."""
    k = K(f"holo_ring_{rot}", (2, 2), rot)
    _plinth(k)
    k.cyl(0, 0, 0.2, 0.09, 1.9, "steel", top="steelL", sides=8)
    for z, r, col in ((0.95, 0.55, "cyan"), (1.6, 0.45, "magenta")):
        n = 24
        for i in range(n):
            a = i * math.tau / n
            k.box(r * math.cos(a), r * math.sin(a), z, 0.16, 0.03, 0.04, col, rz=a + math.pi / 2)
    for i in range(4):                                                                 # the diamond: four slats in a rhombus
        a = i * math.pi / 2 + math.pi / 4
        k.box(0.13 * math.cos(a), 0.13 * math.sin(a), 1.12, 0.04, 0.04, 0.36, "magenta", rz=a)
    k.cyl(0, 0, 2.1, 0.14, 0.06, "steel", top="cyan", sides=10, rtop=0.18)
    return k.build()


def holo_pylon(rot):
    """C: a billboard pylon: two steel legs, a tall sign panel between them with a cyan frame and magenta glyph bars."""
    k = K(f"holo_pylon_{rot}", (2, 2), rot)
    k.box(0, 0, 0.0, 1.7, 0.9, 0.12, "steelD", top="steel", bevel=0.02)
    for u in (-0.7, 0.7):
        k.box(u, 0, 0.12, 0.14, 0.24, 2.0, "steel", top="steelL")
    k.box(0, 0, 0.55, 1.26, 0.06, 1.45, "gmD", top="steelD")                              # the panel
    for z in (0.58, 1.95):                                                             # cyan frame top and bottom
        k.box(0, 0.035, z, 1.22, 0.02, 0.05, "cyan")
    for u in (-0.6, 0.6):
        k.box(u, 0.035, 0.58, 0.05, 0.02, 1.42, "cyan")
    rnd = random.Random(4)
    for row in range(6):                                                               # glyph bars
        z = 0.75 + row * 0.2
        u = -0.45
        while u < 0.4:
            w = rnd.choice((0.12, 0.2, 0.28))
            k.box(u + w / 2, 0.04, z, w, 0.02, 0.1, "magenta" if row != 2 else "cyan")
            u += w + 0.08
    k.box(0, 0, 2.12, 1.6, 0.3, 0.08, "steelD", top="steel")                             # the cap
    return k.build()


def holo_globe(rot):
    """D: a globe of light: meridian slats round a floating sphere over a squat drum."""
    k = K(f"holo_globe_{rot}", (2, 2), rot)
    _plinth(k)
    k.cyl(0, 0, 0.2, 0.32, 0.55, "steel", top="steelD", sides=10)
    k.cyl(0, 0, 0.75, 0.38, 0.06, "ochD", top="ochM", sides=10)
    k.cyl(0, 0, 0.81, 0.22, 0.04, "cyan", sides=10)
    c, r = 1.45, 0.48
    for m in range(8):                                                                 # meridians
        a = m * math.pi / 8
        for j in range(1, 10):
            t = -math.pi / 2 + j * math.pi / 10
            k.box(r * math.cos(t) * math.cos(a), r * math.cos(t) * math.sin(a), c + r * math.sin(t), 0.04, 0.04, 0.08,
                  "cyan" if m % 2 else "magenta")
    for j in range(1, 5):                                                              # a few latitude lines
        t = -math.pi / 2 + j * math.pi / 5
        n = 16
        for i in range(n):
            a = i * math.tau / n
            k.box(r * math.cos(t) * math.cos(a), r * math.cos(t) * math.sin(a), c + r * math.sin(t), 0.1, 0.03, 0.03, "cyan",
                  rz=a + math.pi / 2)
    return k.build()


EMBLEMS = ("dot", "delta", "cross", "star", "diamond")


def _banner_face(emblem, nu, nv, keyed):
    """A banner's face, cell (i, j) from its lower left: a field of livery P, a roundel of the ship's roof emblem near
    the top (roof_livery._emblem, the same shape as on the roof), two S bars below it, a swallow-tail hem. `keyed`:
    the key colours (mkP / mkS) of the livery mask; else the base sprite's neutral cloth under it."""
    from .roof_livery import _emblem
    P, S = ("mkP", "mkS") if keyed else ("plate", "steelL")
    sc = 66 / nu                                                                       # emblem cells per banner cell (the ring clears the hem)
    cy = nv - nu / 2 - 1

    def fn(i, j):
        if i in (0, nu - 1) or j == nv - 1:
            return None if keyed else "gmD"                                          # the hem and sides: not painted
        if j < 6 and abs(i - (nu - 1) / 2) < (6 - j) * nu / 12:
            return None                                                              # the swallow-tail notch
        if emblem:
            X, Y = (i + 0.5 - nu / 2) * sc, (cy - j - 0.5) * sc
            if X * X + Y * Y < 27 * 27:
                I, J = int(X + 32), int(Y + 32)
                c = _emblem(emblem, (I >= 32) + 2 * (J >= 32))(I % 32, J % 32)
                return {"P": P, "S": S}.get(c, P)
        lo = cy - nu / 2 - (4 if emblem else -nu / 2)
        if lo - 6 < j < lo - 3 or lo - 10 < j < lo - 8:
            return S
        return P
    return fn


def banner(rot, emblem=None, keyed=False):
    """A banner post (1x1): a post on a weighted foot up the middle of the banner's back, a crossbar at the top, the banner
    hung from it in the ship's livery with its roof emblem on both faces (livery mask <id>.lv.<emblem>; plain bars
    without one)."""
    k = K(f"banner_{rot}", (1, 1), rot)
    k.box(0, -0.06, 0.0, 0.34, 0.3, 0.07, "steelD", top="steel", bevel=0.02)             # weighted foot
    k.cyl(0, -0.06, 0.07, 0.04, 2.08, "steelL", top="steel", sides=8)                  # the post, behind the banner
    k.cyl(0, -0.06, 2.15, 0.065, 0.05, "ochD", top="ochM", sides=8)                    # finial
    k.box(0, -0.03, 2.0, 0.72, 0.04, 0.04, "steel", top="steelL")                        # crossbar
    for u in (-0.35, 0.35):                                                            # crossbar end caps
        k.box(u, -0.03, 1.99, 0.05, 0.06, 0.06, "ochD", top="ochM")
    objs = k.build()
    f = K(f"banner_{rot}_face{'_lv' if keyed else ''}", (1, 1), rot)
    f.m.flat = True
    w, h, z0 = 0.6, 1.1, 0.88
    nu, nv = round(w * 32), round(h * 32)
    fn = _banner_face(emblem, nu, nv, keyed)
    for sv in (1, -1):                                                                 # both faces
        a, b = f.p(-sv * w / 2, sv * 0.012), f.p(sv * w / 2, sv * 0.012)
        f.m.pattern((a[0], a[1], z0), (b[0] - a[0], b[1] - a[1], 0), (0, 0, h), nu, nv, fn)
    faces = f.build()
    if keyed:                                                                          # the mask: the face alone, the rest a holdout
        for o in objs:
            o.is_holdout = True
    return objs + faces


def _rots(name, fp, fn):
    out = []
    for r in range(4):
        f = (fp[1], fp[0]) if r % 2 == 1 else fp
        out.append((f"module.{name}.r{r}", f, "prop", lambda r=r: fn(r)))
    return out + [(f"module.{name}", fp, "prop", lambda: fn(0))]


# The family `landmarks`: the chosen pieces, the banner's livery masks (module.banner.r{n}.lv.<emblem | plain>).
SPRITES = [*_rots("holo_sign", (2, 2), holo_sign), *_rots("tree_large", (3, 3), tree_large), *_rots("banner", (1, 1), banner),
           *((f"module.banner.r{r}.lv.{e or 'plain'}", (1, 1), "prop", lambda r=r, e=e: banner(r, e, True))
             for r in range(4) for e in (*EMBLEMS, None))]
# Holo column variations still under review (not built with the family): build them by name for a contact sheet.
REVIEW = [*_rots("holo_ring", (2, 2), holo_ring), *_rots("holo_pylon", (2, 2), holo_pylon), *_rots("holo_globe", (2, 2), holo_globe)]
