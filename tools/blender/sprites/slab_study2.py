"""Stasis slab look study, round 2 (family `slab`, preview only; issue #116), after review of round 1: the slabs
were too plain, and no cart showed how it moves. Three new sets, each a slab with its storage and its cart (r0 only):

  s4 / c4  coffin: a tapered slab (narrow at the foot, widest at the shoulders), graphite with cyan field light
           running round its edge and a steel crown of emitters at the head; stored one to a 1x1 stand that leans it
           back under a hood; moved on a hover cart, four lift pads glowing on the floor under it
  s5 / c5  clamp block: a rough pale block held shut by heavy dark clamp bands at head, knees and foot, amber lock
           lights on the bands and amber field light in the seams; stored in a wall rack (3x1, the wall drawn for
           context) leaning it back against the wall; moved standing on a two-wheeled hand truck tipped back
  s6 / c6  halo frame: a dark slab floating in a white frame, a gap of field between them bridged by cyan ticks;
           three stored in a corner shrine (2x2) facing into the room; moved on a gurney (four casters, a lift
           column, a cradle tilting it up)
Items and face corners as round 1 (slab_study.py)."""
import math

from .modkit import K
from .recovery_study4 import quad
from .slab_study import L, T, W, Slab, add, neg

LEAN = math.radians(25)


class Slab2(Slab):
    mask_n = 0.003                                  # the face is flush (round 1's window stood 0.004 proud)

    def poly(self, k, outline, n0, n1, col, face=None):
        """A prism: the outline [(l, w)] (counter-clockwise seen from the face) extruded from n0 to n1."""
        top = [self.p(l, w, n1) for l, w in outline]
        bot = [self.p(l, w, n0) for l, w in outline]
        poly(k, top, face or col, self.N)
        poly(k, bot[::-1], col, neg(self.N))
        m = len(outline)
        for i in range(m):
            j = (i + 1) % m
            (l0, w0), (l1, w1) = outline[i], outline[j]
            mid = self.p((l0 + l1) / 2, (w0 + w1) / 2, 0.0)
            ctr = self.p(L / 2, 0.0, 0.0)
            quad(k, [bot[i], bot[j], top[j], top[i]], col, add(mid, (-1, ctr)))

    def strip(self, k, a, b, half, n, col):
        """A thin bar on the face plane at height n from (l, w) a to b, `half` wide."""
        (l0, w0), (l1, w1) = a, b
        dl, dw = l1 - l0, w1 - w0
        ln = math.hypot(dl, dw)
        ol, ow = -dw / ln * half, dl / ln * half
        pts = [self.p(l0 + ol, w0 + ow, n), self.p(l1 + ol, w1 + ow, n), self.p(l1 - ol, w1 - ow, n),
               self.p(l0 - ol, w0 - ow, n)]
        quad(k, pts, col, self.N)


def poly(k, pts, col, out):
    """A flat polygon through pts (local u, v, z), its normal along `out`."""
    from .core import G as GV
    P = [GV(*k.p(u, v), z) for u, v, z in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    o = GV(*k.p(out[0], out[1]), out[2]) - GV(*k.p(0, 0), 0)
    k.m.poly(P, col, flip=n.dot(o) < 0)


def wheel(k, c, axis, r, w, tyre="dark", hub="steel", n=14):
    """A wheel at c turning about the horizontal `axis` (unit, local u v z), radius r, w wide."""
    up = (0.0, 0.0, 1.0)
    side = (axis[1] * up[2] - axis[2] * up[1], axis[2] * up[0] - axis[0] * up[2], axis[0] * up[1] - axis[1] * up[0])
    ring = lambda s, rr: [add(c, (s * w / 2, axis), (rr * math.cos(t), up), (rr * math.sin(t), side))   # noqa: E731
                          for t in (i * math.tau / n for i in range(n))]
    a, b = ring(1, r), ring(-1, r)
    for i in range(n):
        j = (i + 1) % n
        t = (i + 0.5) * math.tau / n
        quad(k, [a[i], a[j], b[j], b[i]], tyre, (math.sin(t) * side[0], math.sin(t) * side[1], math.cos(t)))
    for s, ring_ in ((1, a), (-1, b)):
        poly(k, ring_, tyre, tuple(s * x for x in axis))
        poly(k, ring(s * 1.02, r * 0.55), hub, tuple(s * x for x in axis))


# ---- the slabs ------------------------------------------------------------------------------------------------------
COFFIN = [(0.0, -0.24), (0.0, 0.24), (1.42, 0.42), (L, 0.3), (L, -0.3), (1.42, -0.42)]


def coffin(k, s):
    s.poly(k, COFFIN, -T, 0.0, "slbGr", face="slbFace")
    inset = [(0.1, -0.17), (0.1, 0.17), (1.42, 0.33), (L - 0.1, 0.22), (L - 0.1, -0.22), (1.42, -0.33)]
    m = len(COFFIN)
    for i in range(m):                                                       # field light round the edge
        s.strip(k, inset[i], inset[(i + 1) % m], 0.014, 0.006, "slbCy")
    s.box(k, L - 0.02, L + 0.1, -0.24, 0.24, -T - 0.03, 0.04, "steelD", face="steel")   # the crown
    for w in (-0.16, 0.0, 0.16):
        s.box(k, L + 0.1, L + 0.16, w - 0.03, w + 0.03, -0.1, -0.04, "slbCy")
    s.box(k, -0.06, 0.0, -0.18, 0.18, -T - 0.02, 0.02, "steelD")              # a foot plate
    s.window = lambda: (0.18, L - 0.16, 0.27)
    s.mask_outline = [(0.12, -0.15), (0.12, 0.15), (1.42, 0.31), (L - 0.12, 0.2), (L - 0.12, -0.2), (1.42, -0.31)]
    return s


def clamp(k, s):
    s.box(k, 0.0, L, -W / 2, W / 2, -T, 0.0, "slbCon", face="slbConL")
    for w in (-1, 1):                                                        # amber field in the long seams
        s.box(k, 0.05, L - 0.05, w * (W / 2 + 0.003) - 0.01, w * (W / 2 + 0.003) + 0.01, -T + 0.04, -0.04, "slbAmb")
    for l0, l1 in ((-0.02, 0.16), (0.52, 0.66), (L - 0.16, L + 0.02)):      # the clamp bands
        s.box(k, l0, l1, -W / 2 - 0.05, W / 2 + 0.05, -T - 0.05, 0.05, "dark", face="slbGrL")
        for w in (-1, 1):
            s.box(k, l0 + 0.04, l1 - 0.04, w * (W / 2 + 0.05) - 0.012, w * (W / 2 + 0.05) + 0.012, -0.09, -0.02, "slbAmb")
        s.box(k, l0 + 0.03, l1 - 0.03, -0.12, 0.12, 0.05, 0.065, "steelD")
    s.window = lambda: (0.08, L - 0.18, W / 2 - 0.08)
    return s


def halo(k, s):
    g = 0.07                                                                 # the field gap
    s.box(k, 0.0, L, -W / 2, W / 2, -T, 0.0, "slbGr", face="slbFace")
    fw = 0.07
    for w in (-1, 1):                                                        # the white frame's long sides
        s.box(k, -g - fw, L + g + fw, w * (W / 2 + g), w * (W / 2 + g + fw), -T + 0.02, 0.03, "plate", face="medWhite")
    for l0, l1 in ((-g - fw, -g), (L + g, L + g + fw)):
        s.box(k, l0, l1, -W / 2 - g - fw, W / 2 + g + fw, -T + 0.02, 0.03, "plate", face="medWhite")
    for i in range(5):                                                       # field ticks across the gap
        l = 0.2 + i * (L - 0.4) / 4
        for w in (-1, 1):
            s.box(k, l - 0.02, l + 0.02, w * W / 2, w * (W / 2 + g), -0.06, -0.03, "slbCy")
    for w in (-1, 1):
        s.box(k, -g, L + g, w * (W / 2 + 0.002) - 0.006, w * (W / 2 + 0.002) + 0.006, -0.09, -0.07, "slbCy")
    s.box(k, L + g, L + g + fw, -0.1, 0.1, 0.03, 0.06, "slbCy")               # the frame's head light
    s.window = lambda: (0.12, L - 0.12, W / 2 - 0.08)
    return s


# ---- storage --------------------------------------------------------------------------------------------------------
def stand(k):
    """s4: one coffin on a 1x1 stand, leaning back on its spine, a hood with emitters over its head."""
    k.box(0, 0.0, 0.0, 0.92, 0.92, 0.1, "dark", top="steelD")
    k.box(0, 0.38, 0.1, 0.62, 0.08, 0.06, "steelD", top="steel")              # the toe lip
    s = coffin(k, Slab2((0.0, 0.32, 0.1), math.pi / 2, LEAN))
    b = Slab2((0.0, 0.32, 0.1), math.pi / 2, LEAN)
    b.box(k, 0.0, L + 0.05, -0.08, 0.08, -T - 0.14, -T, "steel", face="steelL")   # the spine
    b.box(k, L - 0.05, L + 0.28, -0.32, 0.32, -T - 0.14, 0.2, "steelD", face="steel")   # the hood
    b.box(k, L - 0.02, L + 0.25, -0.26, 0.26, 0.2, 0.212, "slbCy")
    return [s]


def wall_rack(k):
    """s5: three clamp blocks leaning back against the wall (drawn for context) on a sill with amber lights."""
    k.box(0, -0.42, 0.0, 3.0, 0.16, 2.6, "gmD", top="slbGr")                 # the wall (context, not the module)
    k.box(0, 0.12, 0.0, 2.95, 0.6, 0.14, "dark", top="steelD")
    out = []
    for u in (-1.0, 0.0, 1.0):
        out.append(clamp(k, Slab2((u, 0.4, 0.14), math.pi / 2, math.radians(22))))
        k.box(u, 0.43, 0.14, 0.5, 0.03, 0.02, "slbAmb")
    for u in (-1.5, -0.5, 0.5, 1.5):                                         # brackets on the wall
        k.box(u, -0.3, 1.9, 0.08, 0.14, 0.3, "steelD", top="steel")
    return out


def shrine(k):
    """s6: three halo slabs on a corner plinth, two along the back edges and one across the corner, all facing in."""
    k.box(0, 0.0, 0.0, 1.95, 1.95, 0.08, "plate", top="medWhite")
    out = []
    spots = [((-0.62, 0.12, 0.08), 0.0), ((0.12, -0.62, 0.08), math.pi / 2), ((-0.42, -0.42, 0.08), math.pi / 4)]
    for (u, v, z), a in spots:
        out.append(halo(k, Slab2((u + 0.32 * math.cos(a), v + 0.32 * math.sin(a), z), a, math.radians(14))))
    k.cyl(0.35, 0.35, 0.08, 0.32, 0.02, "slbCy", sides=24)                   # a lit ring on the floor of the corner
    return out


# ---- carts ----------------------------------------------------------------------------------------------------------
def hover(k):
    """c4: a hover cart. Four lift pads under the deck, their glow on the floor; a cradle raising the head; a push bar."""
    for u in (-0.36, 0.36):
        for v in (-0.72, 0.72):
            k.cyl(u, v, 0.0, 0.16, 0.004, "slbCy", sides=16)                  # the glow on the floor
            k.cyl(u, v, 0.1, 0.13, 0.1, "steelD", top="steel", sides=12)      # the pad
            k.cyl(u, v, 0.09, 0.1, 0.012, "slbCy", sides=12)
    k.box(0, 0.0, 0.2, 0.86, 1.8, 0.1, "dark", top="steelD")
    k.box(0, 0.75, 0.3, 0.7, 0.14, 0.2, "steelD", top="steel")                # the cradle's raised head end
    for u in (-0.36, 0.36):                                                  # the push bar at the foot
        k.box(u, -0.93, 0.3, 0.05, 0.05, 0.62, "steel", top="steelL")
    k.box(0, -0.93, 0.92, 0.82, 0.06, 0.06, "steelL")
    s = coffin(k, Slab2((0.0, -0.82, 0.3 + T), -math.pi / 2, math.radians(84)))
    return [s]


def truck(k):
    """c5: a hand truck tipped back on its two big wheels, the block standing on its toe plate."""
    tip = math.radians(58)                                                   # leaning back from upright
    b = Slab2((0.0, 0.62, 0.28), math.pi / 2, tip)
    b.box(k, -0.06, L + 0.3, -0.36, 0.36, -T - 0.1, -T, "dark", face="steelD")   # the back frame
    b.box(k, -0.06, 0.04, -0.44, 0.44, -T - 0.1, 0.2, "steelD", face="steel")     # the toe plate
    for w in (-0.34, 0.34):                                                  # the handles
        b.box(k, L + 0.2, L + 0.52, w - 0.03, w + 0.03, -T - 0.1, -T - 0.04, "steel", face="steelL")
    b.box(k, L + 0.46, L + 0.52, -0.37, 0.37, -T - 0.1, -T - 0.04, "steelL")
    for u in (-0.42, 0.42):
        wheel(k, (u, 0.7, 0.26), (1.0, 0.0, 0.0), 0.26, 0.12)
    return [clamp(k, Slab2((0.0, 0.62, 0.28), math.pi / 2, tip))]


def gurney(k):
    """c6: a gurney on four casters, a lift column under a cradle tilting the slab up toward the push end."""
    for u in (-0.34, 0.34):
        for v in (-0.7, 0.7):
            wheel(k, (u, v, 0.08), (1.0, 0.0, 0.0), 0.08, 0.05, hub="steelL", n=10)
            k.box(u, v, 0.08, 0.04, 0.1, 0.12, "steel", top="steelL")        # the fork
    k.box(0, 0.0, 0.2, 0.8, 1.6, 0.06, "plate", top="medWhite")
    for v in (-0.4, 0.4):                                                    # the lift columns
        k.box(0, v, 0.26, 0.5, 0.16, 0.32, "steel", top="steelL")
        k.box(0, v, 0.32, 0.52, 0.04, 0.03, "slbCy")
    k.box(0, 0.0, 0.5, 0.84, 1.74, 0.12, "plate", top="medWhite")             # the cradle
    k.box(0, -0.88, 0.56, 0.7, 0.05, 0.5, "plate", top="medWhite")             # the push end
    k.box(0, -0.88, 1.06, 0.76, 0.06, 0.05, "slbCy")
    return [halo(k, Slab2((0.0, -0.7, 0.62 + T), -math.pi / 2, math.radians(78)))]


DESIGNS = {"s4": (stand, (1, 1)), "s5": (wall_rack, (3, 1)), "s6": (shrine, (2, 2)),
           "c4": (hover, (1, 2)), "c5": (truck, (1, 2)), "c6": (gurney, (1, 2))}
