"""Mass driver bay (3x3): the railgun's loader and recoil mount under the roof turret (the rails are up in the turret).

  lift      the missile bay's base flange, ram collar, neck and roof collar, open round the bore
  breech    a chamfered armoured block at the column's foot, strapped top and bottom; a feed port off its front-left
            corner (cheeks, lintel and lip round a real recess, the rails running in, a dark gate in the set-in back)
  column    the recoiling mass above the breech: ribbed above the crosshead, a hazard-striped travel band (the
            stroke) below it running into a fixed guide collar with a bronze bushing, on posts from the floor
  recoil    a crosshead on the column, its four arms ending in bosses over four sprung recoil cylinders on round
            floor bases (buffer pad, banded body, gland, polished rod)
  lifters   four straight hydraulic lifting rams on the diagonals, from lugs in the guide collar up to clevises
            under the bolted flange
  loader    at the front-left 45: a shoe on two rails with a slug on it, waiting at the port; a short rammer on round
            pedestals behind it, its head at the shoe
  deck      a hazard-striped ring round the whole recoil zone

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from mathutils import Vector

from . import cmbkit, core, detail as D
from . import turret_bay_missile as M
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, ZC, Z = M.P, M.obox, M.FRONT, M.ZC, M.Z
frustum, beam, hoop, E = M.frustum, M.beam, M.hoop, M.E
LL = FRONT + math.pi / 4             # the loader's side (front-left)
RC, ZS, ZX = 0.27, 0.78, 1.08        # the column's radius, its foot, the crosshead
RR = 0.62                            # the recoil cylinders' radius


def V(a, r, z=0.0):
    return Vector((*P(a, r), z))


def rbox(f, c, a, he, ht, z0, z1, mat, top=None):
    """A box centred at c (u, v), its axes along E(a) (half he) and across it (half ht), from z0 to z1."""
    e, t = E(a), E(a + math.pi / 2)
    c = Vector((c[0], c[1], 0))
    TB.prism(f, [tuple((c + e * i * he + t * j * ht).xy) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
             z0, z1, mat, top=top or mat)


def cbox(f, c, a, he, ht, z0, z1, mat, top=None, ch=0.03):
    """rbox with a chamfered top edge (a tapered cap ch high and ch in)."""
    e, t = E(a), E(a + math.pi / 2)
    c = Vector((c[0], c[1], 0))
    rbox(f, c.xy, a, he, ht, z0, z1 - ch, mat, mat)

    def corner(i, j, k):
        k_in = ch if k > 0 else 0.0
        z = z1 if k > 0 else z1 - ch
        return tuple(c + e * i * (he - k_in) + t * j * (ht - k_in) + Z * z)
    D.loft_box(f, corner, top or mat)


def spring(f, p0, p1, R, turns, wire, mat="steelL", n=10):
    """A coil spring round the axis p0 -> p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    e1 = d.cross(Z if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    e2 = d.cross(e1)
    m = int(turns * n)
    pts = [p0 + (p1 - p0) * k / m + R * (math.cos(k * math.tau / n) * e1 + math.sin(k * math.tau / n) * e2)
           for k in range(m + 1)]
    for p, q in zip(pts, pts[1:]):
        frustum(f, p, q, wire, wire, mat, 8)


def slug(f, u, v, z, r=0.085, ln=0.32):
    """A railgun round standing up: a slotted armature at its tail, four sabot petals, the dart's tip."""
    _g("round")
    f.vcyl(u, v, z, r, 0.08, "steelL", top="plate", sides=16)
    rbox(f, (u, v), FRONT + math.pi / 2, 0.02, r + 0.004, z + 0.03, z + 0.081, "dark")
    f.vcyl(u, v, z + 0.08, r * 0.92, ln - 0.18, "plate", top="steelL", sides=16)
    for k in range(4):
        a = FRONT + math.pi / 4 + k * math.pi / 2
        rbox(f, (u + math.cos(a) * r * 0.72, v + math.sin(a) * r * 0.72), a, r * 0.23, 0.006, z + 0.09, z + ln - 0.1,
             "steelD")
    f.vcyl(u, v, z + ln - 0.1, r * 0.55, 0.1, "steel", rtop=0.01, sides=14)


def breech(f, z0=0.3, z1=0.78, hb=0.34):
    _g("breech")
    cbox(f, (0, 0), FRONT, hb, hb, z0, z1, "steel", "steelL", ch=0.05)
    for z in (z0, z1 - 0.12):
        rbox(f, (0, 0), FRONT, hb + 0.015, hb + 0.015, z, z + 0.06, "steelD", "steel")


def feed_port(f, a, r0=0.3, r1=0.6, hw=0.15, z0=0.14, z1=0.76, ow=0.11, oz=(0.3, 0.68), back=0.5):
    """A feed throat out of the breech toward a, standing on the base flange: cheeks, lintel and floor round a
    real recess, the back wall set in at back."""
    _g("port")
    e, t = E(a), E(a + math.pi / 2)
    c, he = e * (r0 + r1) / 2, (r1 - r0) / 2
    for sd in (-1, 1):                                                                    # cheeks
        rbox(f, (c + t * sd * (ow + hw) / 2).xy, a, he, (hw - ow) / 2, z0, z1, "steel", "steelL")
    rbox(f, c.xy, a, he, hw, oz[1], z1, "steel", "steelL")                                # lintel
    rbox(f, c.xy, a, he, ow, z0, oz[0], "steel", "steel")                                 # the floor inside
    rbox(f, (e * back).xy, a, 0.03, ow, oz[0], oz[1], "steelM", "steelM")                  # back wall, set in
    rbox(f, (e * (back + 0.035)).xy, a, 0.006, 0.07, oz[0] + 0.04, oz[1] - 0.04, "dark", "dark")  # the breech's gate
    rbox(f, (e * (r1 + 0.008)).xy, a, 0.012, hw + 0.012, oz[1], z1 + 0.012, "steelD", "steel")   # the lintel's lip
    for sd in (-1, 1):
        rbox(f, (e * (r1 + 0.008) + t * sd * (ow + 0.012)).xy, a, 0.012, 0.012, z0, oz[1], "steelD", "steel")


def column(f):
    """The recoiling mass: the column above the breech, ribbed above the crosshead, a striped travel band (the
    stroke) below it."""
    _g("column")
    f.vcyl(0, 0, ZS, RC, ZC - ZS, "steel", sides=36)
    for k in range(8):
        obox(f, FRONT + (k + 0.5) * math.tau / 8, RC - 0.01, RC + 0.04, 0.018, ZX + 0.16, ZC, "steelL", "plate")
    for k in range(8):
        f.vcyl(0, 0, ZS + 0.12 + k * 0.022, RC + 0.004, 0.022, "hazY" if k % 2 == 0 else "hazK", sides=36)


def guide_collar(f, z, posts, r_in=0.29, r_out=0.46, post_r=0.42):
    """A fixed guide collar the column slides in, a bronze bushing ring, on posts from the floor."""
    _g("guide")
    hoop(f, r_out, r_in, z, z + 0.1, "steel", "steelL")
    hoop(f, r_in + 0.015, r_in - 0.005, z - 0.02, z + 0.12, "rust", "rust")              # bushing
    for a in posts:
        q = P(a, post_r)
        rbox(f, q, a, 0.05, 0.05, 0.0, z, "steelD", "steel")
        rbox(f, q, a, 0.09, 0.09, 0.0, 0.05, "gm", "steel")


def recoil_cyl(f, base, top, r=0.07, spring_r=0.11, ext=0.55):
    """A vertical recoil cylinder from base (fixed) up to top (the crosshead): buffer pad, body, bands, gland, the
    polished rod showing the stroke, a spring round it all."""
    base, top = Vector(base), Vector(top)
    _g("recoil")
    m = base + (top - base) * ext
    f.vcyl(base.x, base.y, base.z - 0.06, r + 0.04, 0.06, "gm", top="steel", sides=16)     # buffer pad
    frustum(f, base, m, r, r, "steelD", 16, cap="steel", capstart="steel")
    for fr in (0.2, 0.7):
        q = base + (m - base) * fr
        frustum(f, q, q + Z * 0.03, r + 0.01, r + 0.01, "steel", 16)
    frustum(f, m, m + Z * 0.05, r * 0.75, r * 0.75, "steel", 14, cap="steelL")             # gland
    frustum(f, m + Z * 0.05, top, r * 0.45, r * 0.45, "plate", 12, cap="plate")            # polished rod
    spring(f, base + Z * 0.02, top - Z * 0.02, spring_r, 6, 0.016)


def crosshead(f, arms):
    _g("crosshead")
    hoop(f, RC + 0.12, RC - 0.01, ZX, ZX + 0.14, "steelM", "steel")
    for a in arms:
        obox(f, a, RC + 0.08, RR, 0.075, ZX, ZX + 0.14, "steelM", "steel")
        f.vcyl(*P(a, RR), ZX - 0.03, 0.09, 0.2, "steelD", top="steel", sides=16)          # the rod's clevis boss


def lift_ram(f, a, r=0.47, z0=0.76):
    """A hydraulic lifting ram from a lug cast into the guide collar up to a clevis under the bolted flange."""
    z1 = ZC - 0.025
    _g("liftram")
    rbox(f, P(a, r - 0.01), a, 0.08, 0.065, z0, z0 + 0.15, "steelD", "steel")             # the collar's lug
    b, t = V(a, r, z0 + 0.15), V(a, r, z1 - 0.08)
    d = (t - b).normalized()
    m = b + d * 0.42
    frustum(f, b, m, 0.045, 0.045, "steelD", 14, cap="steel", capstart="steel")
    frustum(f, b + d * 0.08, b + d * 0.11, 0.053, 0.053, "steel", 14)
    frustum(f, m, m + d * 0.04, 0.034, 0.034, "steel", 12, cap="steelL")                  # gland
    frustum(f, m + d * 0.04, t, 0.022, 0.022, "plate", 10, cap="plate")                   # rod
    rbox(f, P(a, r), a, 0.07, 0.05, z1 - 0.09, z1, "steelD", "steel")                     # the flange's clevis


def hazard_ring(f, r0, r1, n=40, z=0.012):
    _g("hazard")
    for k in range(n):
        c = "hazY" if k % 2 == 0 else "hazK"
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        TB.prism(f, [P(a0, r0), P(a0, r1), P(a1, r1), P(a1, r0)], 0.0, z, c, top=c)


def loader(f):
    e, t = E(LL), E(LL + math.pi / 2)
    _g("loader")                                                                          # a shoe on rails into the
    for sd in (-0.07, 0.07):                                                              # port, the rammer behind
        beam(f, e * 0.5 + t * sd + Z * 0.3, e * 1.06 + t * sd + Z * 0.3, Z, 0.018, 0.018, "steelL")
    p = e * 0.84                                                                          # the rails' pedestal
    f.vcyl(p.x, p.y, 0.0, 0.07, 0.035, "steel", top="steelL", sides=16)
    frustum(f, p + Z * 0.035, p + Z * 0.26, 0.04, 0.03, "steel", 12)
    rbox(f, p.xy, LL, 0.025, 0.09, 0.24, 0.282, "steel", "steelL")
    sh = e * 0.86
    rbox(f, sh.xy, LL, 0.1, 0.1, 0.3, 0.34, "steel", "steelL")                             # the shoe, a slug on it
    slug(f, sh.x, sh.y, 0.34)
    c0, c1 = e * 1.24 + Z * 0.52, e * 1.06 + Z * 0.52                                       # the rammer
    frustum(f, c0, c1, 0.08, 0.08, "steelD", 16, cap="steel", capstart="steel")
    for fr in (0.25, 0.75):
        q = c0 + (c1 - c0) * fr
        frustum(f, q, q + (c1 - c0).normalized() * 0.03, 0.09, 0.09, "steel", 16)
        p = Vector((q.x, q.y, 0.0)) + (c1 - c0).normalized() * 0.015                       # on round pedestals with
        f.vcyl(p.x, p.y, 0.0, 0.07, 0.035, "steel", top="steelL", sides=16)               # cradles
        frustum(f, p + Z * 0.035, p + Z * 0.42, 0.04, 0.03, "steel", 12)
        rbox(f, p.xy, LL, 0.025, 0.075, 0.38, 0.47, "steel", "steelL")
    frustum(f, c1, e * 0.98 + Z * 0.52, 0.03, 0.03, "plate", 10)
    rbox(f, (e * 0.97).xy, LL, 0.015, 0.08, 0.38, 0.66, "steel", "steelL")                 # its head


def bay_driver(rot=0):
    """Built the same way round for every rotation, as the laser bay (turret_bay_laser.bay_laser)."""
    m = core.Mesh("bay_driver")
    f = Frame(m, 1, square=True)
    TB._floor(-1.5, 1.5)
    M.lift(f)
    breech(f)
    feed_port(f, LL)
    column(f)
    arms = [FRONT + k * math.pi / 2 for k in range(4)]
    crosshead(f, arms)
    for a in arms:                                                                        # four recoil cylinders
        recoil_cyl(f, V(a, RR, 0.14), V(a, RR, ZX - 0.02))
        f.vcyl(*P(a, RR), 0.0, 0.13, 0.08, "gm", top="steel", sides=24)
    diag = [FRONT + math.pi / 4 + k * math.pi / 2 for k in range(4)]
    guide_collar(f, 0.76, diag[1:])
    for a in diag:                                                                        # lifting rams over the posts
        lift_ram(f, a)
    hazard_ring(f, 0.8, 0.9)                                                              # the recoil zone on the deck
    loader(f)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["driver"] = bay_driver
