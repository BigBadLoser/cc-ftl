"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): twelve cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Round 6, after round 5 (13's
machined, intentional look kept; 14's spokes liked; every slab must read as held by the machine):

  s16  spoked carousel: 13's geared plinth and console; each slab's foot rides in a shoe on a lit track, its head held
       by a yoke under a spoke of an open spoked crown, a lit conduit along each spoke to its slab
  s17  hanging gallery: 14's white spokes; each slab hangs by a yoke and two rods from a carrier ring directly over it,
       a field beam down from its foot to a glow on the basin
  s18  docking column: each slab docked by its inner edge to a tall core on two arms with lit joints, its foot in a
       shoe on the track; an open top"""
import math

from .slab_study import L, T, W, Slab, beam, cassette, single

UP = (0.0, 0.0, 1.0)
N12, SKEW, R0 = 12, math.radians(40), 1.0


def angles():
    return [math.radians(45 + 360 * i / N12) for i in range(N12)]


def blades(k, z0, body="slbGr", caps="dark"):
    out = []
    for th in angles():
        ts = th - SKEW
        out.append(cassette(k, Slab((R0 * math.cos(th), R0 * math.sin(th), z0), UP, (-math.sin(ts), math.cos(ts), 0.0)),
                            body, caps))
    return out


def ring(k, r, z, h, w, col, top=None, n=48, skip=None):
    """A ring of n segments at radius r: w wide (radially), h tall. skip(i): leave segment i out."""
    for i in range(n):
        if skip and skip(i):
            continue
        a = (i + 0.5) * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), z, math.tau * r / n * 1.08, w, h, col, top=top, rz=a + math.pi / 2)


def at(r, a, z):
    return (r * math.cos(a), r * math.sin(a), z)


def plinth(k, top):
    """13's stepped plinth with a geared edge, a lit track under the slabs' feet."""
    k.cyl(0, 0, 0.0, 1.5, 0.06, "dark", top="steelD", sides=48)
    k.cyl(0, 0, 0.06, 1.42, top - 0.06, "steelD", top="steel", sides=48)
    ring(k, 1.45, 0.06, 0.06, 0.05, "dark", top="steelD", skip=lambda i: i % 2)
    ring(k, R0, top, 0.006, 0.07, "slbCy")


def shoe(k, s):
    """The slab's foot in its track shoe."""
    s.box(k, -0.06, 0.0, -0.3, 0.3, -0.2, 0.0, "steel", face="steelL")


def core(k, z, h, r):
    k.cyl(0, 0, z, r, h, "slbGr", top="slbGrL", sides=16)
    for i in range(6):
        a = math.radians(15 + 60 * i)
        k.box(*at(r + 0.005, a, z + 0.15)[:2], z + 0.15, 0.04, 0.04, h - 0.3, "slbCy", rz=a)


def hub(k, z, r):
    """A vented hub with a beacon."""
    k.cyl(0, 0, z, r, 0.16, "slbGr", top="slbGrL", sides=16)
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        k.box(*at(r * 0.72, a, 0)[:2], z + 0.16, 0.12, 0.05, 0.012, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, z + 0.16, 0.1, 0.08, "slbCy", top="slbCy", sides=10)


def console(k):
    """13's console in the front corner, facing out."""
    d = -math.pi / 4
    c = lambda r: (r * math.cos(math.pi / 4), r * math.sin(math.pi / 4))  # noqa: E731
    k.box(*c(1.66), 0.0, 0.6, 0.46, 0.1, "dark", top="steelD", rz=d)
    k.box(*c(1.62), 0.1, 0.44, 0.3, 0.9, "slbGr", top="slbGrL", rz=d)
    k.box(*c(1.66), 1.0, 0.56, 0.36, 0.08, "steelD", top="dark", rz=d)
    k.box(*c(1.775), 0.5, 0.36, 0.012, 0.42, "dark", rz=d)
    for z, w, col in ((0.56, 0.28, "slbCy"), (0.66, 0.2, "slbCy"), (0.76, 0.24, "green"), (0.84, 0.12, "slbAmb")):
        k.box(*c(1.783), z, w, 0.006, 0.04, col, rz=d)
    k.box(*c(1.665), 1.08, 0.4, 0.2, 0.012, "slbCy", rz=d)


def yoke(k, s, col, face):
    """A clamp over the slab's head cap: a bridge and two jaws down its sides."""
    s.box(k, L, L + 0.1, -0.3, 0.3, -0.24, 0.04, col, face=face)
    for w in (-1, 1):
        a, b = sorted((w * 0.44, w * 0.52))
        s.box(k, L - 0.22, L + 0.1, a, b, -0.26, 0.08, col, face=face)
    s.box(k, L + 0.03, L + 0.08, -0.22, 0.22, 0.04, 0.05, "slbCy")


def spoked(k):
    """s16."""
    z0 = 0.2
    zs = z0 + L + 0.1 + 0.05                                                 # the spokes' centre line
    plinth(k, 0.14)
    core(k, 0.14, zs - 0.14, 0.42)
    out = blades(k, z0)
    for s, th in zip(out, angles()):
        shoe(k, s)
        yoke(k, s, "steelD", "steel")
        beam(k, at(0.4, th, zs), at(1.46, th, zs), 0.09, 0.1, "dark", top="steelD")   # its spoke
        beam(k, at(0.5, th, zs + 0.056), at(1.0, th, zs + 0.056), 0.03, 0.012, "slbCy")   # the feed along it
    ring(k, 1.46, zs - 0.06, 0.12, 0.07, "dark", top="steelD")               # the rim
    ring(k, 1.5, zs - 0.02, 0.03, 0.012, "slbCy", skip=lambda i: i % 4 == 0)
    hub(k, zs - 0.08, 0.52)
    console(k)
    return out


def gallery(k, z0=0.44):
    """s17."""
    zr = z0 + L + 0.32                                                       # the carrier ring's centre line
    k.cyl(0, 0, 0.0, 1.48, 0.1, "plate", top="medWhite", sides=48)           # the basin
    ring(k, 1.38, 0.1, 0.02, 0.03, "slbCy")
    ring(k, R0, 0.1, 0.004, 0.18, "steelD")
    k.cyl(0, 0, 0.1, 0.26, zr - 0.1, "plate", top="medWhite", sides=16)      # the slim core
    for z in (0.9, 1.7):
        k.cyl(0, 0, z, 0.27, 0.05, "slbCy", sides=16)
    out = blades(k, z0, caps="plate")
    for s in out:
        yoke(k, s, "plate", "medWhite")
        for w in (-0.2, 0.2):                                                # the hangers
            s.box(k, L + 0.1, zr - z0 - 0.05, w - 0.025, w + 0.025, -0.14, -0.08, "steel", face="steelL")
        s.box(k, -0.06, 0.0, -0.22, 0.22, -0.22, 0.02, "plate", face="medWhite")   # the foot emitter
        f = s.p(0.0, 0.0, -0.1)
        k.cyl(f[0], f[1], 0.1, 0.15, 0.006, "slbCy", sides=14)               # its glow on the basin
    ring(k, R0, zr - 0.05, 0.1, 0.12, "plate", top="medWhite")              # the carrier ring
    ring(k, 1.42, zr - 0.04, 0.08, 0.08, "plate", top="medWhite")            # the outer rim
    ring(k, 1.465, zr - 0.02, 0.03, 0.012, "slbCy")
    for i in range(6):                                                       # the spokes
        a = math.radians(15 + 60 * i)
        beam(k, at(0.3, a, zr), at(1.42, a, zr), 0.07, 0.07, "plate", top="medWhite")
    k.cyl(0, 0, zr - 0.08, 0.36, 0.18, "plate", top="medWhite", sides=16)
    k.cyl(0, 0, zr + 0.1, 0.2, 0.012, "slbCy", sides=14)
    return out


def gallery_beams(k, z0=0.44):
    for th in angles():
        ts = th - SKEW
        s = Slab((R0 * math.cos(th), R0 * math.sin(th), z0), UP, (-math.sin(ts), math.cos(ts), 0.0))
        f = s.p(0.0, 0.0, -0.1)
        k.cyl(f[0], f[1], 0.1, 0.17, z0 - 0.16, "slbFilm", sides=14, rtop=0.12)


def column(k):
    """s18."""
    z0 = 0.2
    plinth(k, 0.14)
    core(k, 0.14, 2.5, 0.4)
    out = blades(k, z0)
    for z in (z0 + 0.35, z0 + L - 0.35):                                     # the collars the arms ride
        k.cyl(0, 0, z - 0.08, 0.47, 0.16, "steelD", top="steel", sides=16)
    for s in out:
        shoe(k, s)
        far = math.hypot(*s.p(L / 2, W / 2, -T / 2)[:2]) > math.hypot(*s.p(L / 2, -W / 2, -T / 2)[:2])
        ws = -1 if far else 1                                                # the edge nearer the core
        a, b = sorted((ws * W / 2, ws * (W / 2 + 0.06)))
        s.box(k, 0.16, L - 0.16, a, b, -T + 0.02, -0.02, "steelD", face="steel")   # the docking spine
        for l in (0.35, L - 0.35):
            e = s.p(l, ws * (W / 2 + 0.06), -T / 2)
            ang = math.atan2(e[1], e[0])
            beam(k, at(0.45, ang, e[2]), e, 0.09, 0.1, "dark", top="steelD")   # the arm
            k.cyl(e[0], e[1], e[2] - 0.07, 0.07, 0.14, "steel", top="steelL", sides=10)   # its joint
            k.cyl(e[0], e[1], e[2] + 0.07, 0.04, 0.012, "slbCy", sides=8)
    k.cyl(0, 0, 2.64, 0.55, 0.12, "slbGr", top="slbGrL", sides=16)          # the open top: a cap, a lit ring, a mast
    ring(k, 0.555, 2.68, 0.03, 0.012, "slbCy", n=24)
    hub(k, 2.76, 0.34)
    return out


DESIGNS = {"s16": (spoked, (3, 3)), "s17": (gallery, (3, 3)), "s18": (column, (3, 3))}
OVERLAYS = {"s17": [(single(gallery_beams, (3, 3), "bm"), 55)]}
