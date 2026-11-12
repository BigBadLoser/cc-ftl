"""Stasis slab look study, round 3 (family `slab`, preview only; issue #116), after review of round 2: rectangular
slabs over the coffin, storage as a module that holds many slabs like a catalog (rotary or otherwise), a hover cart
that reads as hovering, the hand truck kept. Three sets (r0 only):

  s7 / c7  cassette slab (heavy end caps with docking sockets, a recessed face inside a steel lip, cyan field lines
           in grip channels down its sides) in a revolver drum (3x2): six slabs round a horizontal axle, turning to
           bring one down to the access slot; three faces show at once. Cart: a hover cart lifted clear of the floor,
           four emitter rings under it, light pools and its shadow on the floor
  s8 / c8  ribbed block (pale stone, dark ribs round its sides and back, amber field light in grooves down its face)
           on a turntable carousel (2x2): six standing round a core under an emitter cap. Cart: the hand truck, with
           an axle housing and grips
  s9 / c9  glass-cased slab (the block inside a translucent field case, white corner posts) in a catalog drawer bank
           (2x2): ten drawers, each front labelled with its prisoner's face and a status light, one pulled out. Cart:
           a low dolly on four wheels, a tiller handle
Faces are the prisoner's body (a slab's face) or head (a drawer's label). Translucent layers (the hover cart's light
and shadow, the glass case) are `slab.study.<v>.ov<j>`, drawn over the scene."""
import math

from .modkit import K
from .slab_study import L, T, W, add, neg
from .slab_study2 import Slab2, poly, wheel
from .recovery_study4 import quad

class SlabF(Slab2):
    """A slab from its own axes: foot point O, U foot to head, N out of the face (Wd = U x N, the viewer's right)."""

    def __init__(self, O, U, N):
        self.O, self.U, self.N = O, U, N
        self.Wd = (U[1] * N[2] - U[2] * N[1], U[2] * N[0] - U[0] * N[2], U[0] * N[1] - U[1] * N[0])


# ---- slabs ----------------------------------------------------------------------------------------------------------
def cassette(k, s, body="slbGr", caps="dark"):
    s.box(k, 0.12, L - 0.12, -W / 2, W / 2, -T, 0.0, body, face="slbFace")
    for w in (-1, 1):                                                        # the steel lip round the face
        s.box(k, 0.12, L - 0.12, w * (W / 2 - 0.07), w * W / 2, 0.0, 0.03, "steel", face="steelL")
        s.box(k, 0.3, L - 0.3, w * (W / 2 + 0.001) - 0.012, w * (W / 2 + 0.001) + 0.012, -T / 2 - 0.02, -T / 2 + 0.02,
              "slbCy")                                                       # field line in the grip channel
    for l0, l1 in ((0.0, 0.16), (L - 0.16, L)):                              # the heavy end caps
        s.box(k, l0, l1, -W / 2 - 0.04, W / 2 + 0.04, -T - 0.04, 0.06, caps, face="steelD" if caps == "dark" else "steel")
        e = l0 - 0.015 if l0 == 0.0 else l1
        s.box(k, e, e + 0.015, -0.12, 0.12, -0.16, -0.04, "slbCy")           # docking socket
    s.box(k, L - 0.12, L - 0.04, -0.22, 0.22, 0.06, 0.072, "slbCy")           # status strip on the head cap
    for w in (-0.2, 0.0, 0.2):
        s.box(k, 0.05, 0.11, w - 0.03, w + 0.03, 0.06, 0.072, "green" if w else "slbCy")
    s.window = lambda: (0.2, L - 0.2, W / 2 - 0.1)
    return s


def ribbed(k, s):
    s.box(k, 0.0, L, -W / 2 + 0.04, W / 2 - 0.04, -T, 0.0, "slbCon", face="slbConL")
    for i in range(10):                                                      # ribs round the sides and back
        l = 0.12 + i * (L - 0.24) / 9
        s.box(k, l - 0.035, l + 0.035, -W / 2 - 0.03, W / 2 + 0.03, -T - 0.05, -0.05, "slbGr", face="slbGrL")
    for w in (-1, 1):                                                        # amber field light in face grooves
        s.box(k, 0.12, L - 0.12, w * (W / 2 - 0.08) - 0.013, w * (W / 2 - 0.08) + 0.013, -0.005, 0.004, "slbAmb")
    for l0, l1 in ((-0.05, 0.1), (L - 0.1, L + 0.05)):
        s.box(k, l0, l1, -W / 2 - 0.05, W / 2 + 0.05, -T - 0.07, 0.05, "dark", face="slbGr")
        s.box(k, l0 + 0.04, l1 - 0.04, -0.1, 0.1, 0.05, 0.062, "slbAmb")     # the lock light
    s.window = lambda: (0.14, L - 0.14, W / 2 - 0.13)
    return s


def glass(k, s):
    s.box(k, 0.0, L, -W / 2, W / 2, -T, -T + 0.04, "plate", face="medWhite")  # the case's white back
    s.box(k, 0.06, L - 0.06, -W / 2 + 0.06, W / 2 - 0.06, -T + 0.04, -0.03, "slbFace", face="slbFace")   # the block
    for l0, l1 in ((0.0, 0.08), (L - 0.08, L)):                              # white corner posts
        for w in (-1, 1):
            s.box(k, l0, l1, w * (W / 2 - 0.08), w * W / 2, -T, 0.04, "plate", face="medWhite")
    s.window = lambda: (0.12, L - 0.12, W / 2 - 0.12)
    s.mask_n = -0.027
    return s


def glass_case(s):
    """The field case over a glass slab (an overlay): its walls, and lit edges."""
    def build(k):
        s.box(k, 0.0, L, -W / 2, W / 2, -T + 0.04, 0.04, "slbFilm")
    return build


def glass_edges(s):
    def build(k):
        for w in (-1, 1):
            s.box(k, 0.08, L - 0.08, w * W / 2 - 0.012, w * W / 2 + 0.012, 0.028, 0.042, "slbCy")
        for l in (0.08, L - 0.08):
            s.box(k, l - 0.012, l + 0.012, -W / 2 + 0.08, W / 2 - 0.08, 0.028, 0.042, "slbCy")
    return build


# ---- storage --------------------------------------------------------------------------------------------------------
AXLE = 1.18                                         # the drum's axle height
APO = 0.745                                         # its slabs' faces from the axle (a hexagon of 0.86 sides)


def hexring(k, u0, u1, r, col, face):
    """A hexagonal prism along u (a flat at the top), u0 to u1, circumradius r about the axle."""
    pts = [(math.cos(math.radians(60 * i)), math.sin(math.radians(60 * i))) for i in range(6)]
    a = [(u0, r * c, AXLE + r * s) for c, s in pts]
    b = [(u1, r * c, AXLE + r * s) for c, s in pts]
    poly(k, a, col, (-1, 0, 0))
    poly(k, b, face, (1, 0, 0))
    for i in range(6):
        j = (i + 1) % 6
        m = math.radians(60 * i + 30)
        quad(k, [a[i], a[j], b[j], b[i]], col, (0, math.cos(m), math.sin(m)))


def drum(k):
    """s7: a revolver drum, six cassettes round a horizontal axle, on a plinth with end stands and a drive housing."""
    k.box(0, 0.0, 0.0, 2.95, 1.9, 0.1, "dark", top="steelD")
    k.box(0, 0.9, 0.1, 0.9, 0.06, 0.012, "slbCy")                             # the access slot's mark
    out = []
    for i in range(6):
        ph = math.radians(90 + 60 * i)                                      # the face's normal round the axle
        N = (0.0, math.cos(ph), math.sin(ph))
        O = (-1.0, APO * N[1], AXLE + APO * N[2])
        out.append(cassette(k, SlabF(O, (1.0, 0.0, 0.0), N)))
    hexring(k, -0.62, 0.62, 0.5, "slbGr", "slbGrL")                           # the core
    for u0, u1 in ((-1.24, -1.14), (1.14, 1.24)):                             # the end plates
        hexring(k, u0, u1, 1.0, "steelD", "steel")
    for u in (-1.32, 1.32):                                                  # the stands up to the axle
        k.box(u, 0.0, 0.1, 0.14, 0.7, AXLE - 0.1, "steelD", top="steel")
        k.box(u, 0.0, 0.1, 0.16, 1.1, 0.16, "steelD", top="steel")
    k.box(1.42, 0.0, 0.1, 0.12, 0.6, 1.5, "dark", top="steelD")               # the drive housing
    k.box(1.49, 0.0, 0.9, 0.012, 0.3, 0.06, "slbCy")
    return out


def carousel(k):
    """s8: a turntable carousel, six ribbed blocks standing round a core under an emitter cap."""
    k.cyl(0, 0, 0.0, 1.0, 0.12, "dark", top="steelD", sides=36)
    k.cyl(0, 0, 0.07, 1.005, 0.02, "slbAmb", sides=36)
    k.cyl(0, 0, 0.12, 0.44, 2.2, "slbGr", top="slbGrL", sides=6)
    out = []
    for i in range(6):
        th = math.radians(45 + 60 * i)
        out.append(ribbed(k, Slab2((0.74 * math.cos(th), 0.74 * math.sin(th), 0.18), th, 0.0)))
    k.cyl(0, 0, 2.28, 0.98, 0.1, "dark", top="steelD", sides=36)
    k.cyl(0, 0, 2.38, 0.5, 0.08, "slbGr", top="slbGrL", sides=12)
    for i in range(6):
        th = math.radians(45 + 60 * i)
        k.box(0.8 * math.cos(th), 0.8 * math.sin(th), 2.24, 0.2, 0.2, 0.04, "slbAmb", rz=th)
    return out


ROWS, PITCH, Z0 = 5, 0.36, 0.1


def drawers(k):
    """s9: a catalog drawer bank, two columns of five, each front a face label and a status light; one pulled out."""
    k.box(0, -0.05, 0.0, 2.0, 1.9, 0.1, "plate", top="medWhite")              # the plinth
    for u in (-0.98, 0.0, 0.98):                                             # the cabinet's walls
        k.box(u, -0.05, 0.1, 0.06, 1.9, ROWS * PITCH + 0.06, "plate", top="medWhite")
    k.box(0, -0.05, 0.1 + ROWS * PITCH, 2.02, 1.9, 0.08, "plate", top="medWhite")
    k.box(0, -0.98, 0.1, 2.0, 0.06, ROWS * PITCH, "plate", top="medWhite")
    out = []
    pulled = (2, 1)                                                          # (row, column) of the open drawer
    for r in range(ROWS):
        z = Z0 + r * PITCH + 0.02
        for c, u in enumerate((-0.49, 0.49)):
            dv = 1.15 if (r, c) == pulled else 0.0
            k.box(u, 0.88 + dv, z, 0.9, 0.04, PITCH - 0.04, "slbGr", top="slbGrL")    # the drawer front
            k.box(u + 0.3, 0.905 + dv, z + 0.12, 0.08, 0.012, 0.08, "slbCy" if (r + c) % 4 else "slbAmb")
            k.box(u + 0.05, 0.91 + dv, z + 0.04, 0.3, 0.02, 0.04, "steelL")  # the pull
            lab = SlabF((u - 0.24, 0.903 + dv, z + 0.07), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0))
            lab.box(k, -0.02, 0.24, -0.14, 0.14, -0.02, 0.0, "steel", face="slbFaceL")   # the label plate
            lab.window = lambda: (0.0, 0.2, 0.1)
            lab.mask_n = 0.003
            lab.kind = "head"
            out.append(lab)
            if (r, c) == pulled:
                k.box(u, 0.25 + dv / 2 + 0.3, z, 0.86, 1.9, 0.05, "steelD", top="steel")   # its tray
                out.append(glass(k, Slab2((u, 0.77 + dv, z + 0.05 + T), math.pi / 2, math.pi / 2)))   # head in
    return out


# ---- carts ----------------------------------------------------------------------------------------------------------
LIFT = 0.4                                          # the hover cart's deck: clear of the floor by this


def hover2(k):
    """c7: a hover cart, its deck lifted clear of the floor on four emitter rings; a cradle; a push bar."""
    k.box(0, 0.0, LIFT, 0.9, 1.9, 0.14, "dark", top="steelD")
    for u in (-0.47, 0.47):                                                  # skirts with vents
        k.box(u, 0.0, LIFT + 0.02, 0.04, 1.8, 0.1, "steelD", top="steel")
        for v in (-0.5, 0.0, 0.5):
            k.box(u + (0.022 if u > 0 else -0.022), v, LIFT + 0.05, 0.004, 0.3, 0.04, "dark")
    for u in (-0.3, 0.3):
        for v in (-0.68, 0.68):
            k.cyl(u, v, LIFT - 0.08, 0.14, 0.08, "steelD", top="steel", sides=14)   # the emitter pods
            k.cyl(u, v, LIFT - 0.09, 0.12, 0.012, "slbCy", sides=14)                # their glowing rings
            k.cyl(u, v, LIFT - 0.1, 0.065, 0.014, "dark", sides=10)
    k.box(0, 0.78, LIFT + 0.14, 0.7, 0.16, 0.16, "steelD", top="steel")       # the cradle's head rest
    for u in (-0.36, 0.36):
        k.box(u, -0.98, LIFT + 0.14, 0.05, 0.05, 0.6, "steel", top="steelL")
    k.box(0, -0.98, LIFT + 0.74, 0.8, 0.06, 0.06, "slbCy")
    return [cassette(k, Slab2((0.0, -0.94, LIFT + 0.14 + T), -math.pi / 2, math.radians(84)))]


def hover2_light(k):
    """Under the hover cart (an overlay): light cones from each ring down to the floor."""
    for u in (-0.3, 0.3):
        for v in (-0.68, 0.68):
            k.cyl(u, v, 0.0, 0.2, LIFT - 0.1, "slbFilm", sides=14, rtop=0.12)


def hover2_pools(k):
    for u in (-0.3, 0.3):
        for v in (-0.68, 0.68):
            k.cyl(u, v, 0.0, 0.22, 0.004, "slbFilm", sides=16)


def hover2_shadow(k):
    k.box(0, 0.0, 0.0, 0.8, 1.8, 0.003, "dark")


def truck2(k):
    """c8: the hand truck tipped back on two big wheels (axle housing, grips), the block on its toe plate."""
    tip = math.radians(55)
    b = Slab2((0.0, 0.62, 0.3), math.pi / 2, tip)
    b.box(k, -0.06, L + 0.3, -0.38, 0.38, -T - 0.1, -T, "dark", face="steelD")
    for w in (-0.3, 0.3):                                                    # frame rails
        b.box(k, -0.06, L + 0.3, w - 0.04, w + 0.04, -T - 0.14, -T - 0.08, "steelD", face="steel")
    b.box(k, -0.08, 0.04, -0.46, 0.46, -T - 0.1, 0.22, "steelD", face="steel")   # the toe plate
    b.box(k, -0.08, -0.04, -0.4, 0.4, 0.22, 0.24, "slbHaz")
    for w in (-0.34, 0.34):
        b.box(k, L + 0.2, L + 0.56, w - 0.03, w + 0.03, -T - 0.1, -T - 0.04, "steel", face="steelL")
        b.box(k, L + 0.44, L + 0.56, w - 0.045, w + 0.045, -T - 0.115, -T - 0.025, "slbAmb")   # the grips
    k.box(0, 0.7, 0.2, 0.86, 0.14, 0.12, "dark", top="steelD")               # the axle housing
    for u in (-0.48, 0.48):
        wheel(k, (u, 0.7, 0.27), (1.0, 0.0, 0.0), 0.27, 0.13)
    return [ribbed(k, Slab2((0.0, 0.62, 0.3), math.pi / 2, tip))]


def dolly(k):
    """c9: a low dolly on four wheels standing out past its deck, a tiller handle at its foot."""
    for u in (-0.47, 0.47):
        for v in (-0.7, 0.7):
            wheel(k, (u, v, 0.11), (1.0, 0.0, 0.0), 0.11, 0.07, hub="steelL", n=12)
    k.box(0, 0.0, 0.12, 0.84, 1.86, 0.08, "plate", top="medWhite")
    k.box(0, 0.0, 0.1, 0.9, 0.12, 0.06, "steelD")                             # axles' beam
    tiller = Slab2((0.0, -1.0, 0.2), math.pi / 2, math.radians(38))
    tiller.box(k, 0.0, 0.95, -0.03, 0.03, -0.06, 0.0, "steel", face="steelL")
    tiller.box(k, 0.9, 0.98, -0.18, 0.18, -0.07, 0.01, "slbCy")
    return [glass(k, Slab2((0.0, -0.96, 0.2 + T), -math.pi / 2, math.radians(90)))]


def overlays_glass(v):
    """The glass case and its lit edges over each glass slab of design v."""
    def films():
        fn, fp = DESIGNS[v]
        slabs = [s for s in fn(K("tmp", fp)) if getattr(s, "mask_n", None) == -0.027]
        kf, ke = K(f"slab_{v}_film", fp), K(f"slab_{v}_edges", fp)
        for s in slabs:
            glass_case(s)(kf)
            glass_edges(s)(ke)
        return kf, ke
    return [(lambda: films()[0].build(), 60), (lambda: films()[1].build(), 200)]


def single(build, fp, name):
    def go():
        k = K(name, fp)
        build(k)
        return k.build()
    return go


DESIGNS = {"s7": (drum, (3, 2)), "s8": (carousel, (2, 2)), "s9": (drawers, (2, 2)),
           "c7": (hover2, (1, 2)), "c8": (truck2, (1, 2)), "c9": (dolly, (1, 2))}
OVERLAYS = {"c7": [(single(hover2_shadow, (1, 2), "sh"), 110), (single(hover2_pools, (1, 2), "pl"), 130),
                   (single(hover2_light, (1, 2), "cn"), 60)],
            "s9": overlays_glass("s9"), "c9": overlays_glass("c9")}
