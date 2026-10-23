"""Machine kit: the language of the processing machines (refinery, scrapper). One chamfered housing per machine, its
work shown by bays set into it and by parts mounted on purpose; a gunmetal body, orange paint on the corner armour and
edges, a few lit accents. Local frame: modkit.K (u, v, z); a side is "+u", "-u", "+v" or "-v" and `plane` is how far
its face stands from the origin."""
import math

from mathutils import Vector

from .steelkit import face

BODY, BODY_D, BODY_L = "steel", "steelD", "blueGrey"
TRIM, TRIM_L, TRIM_D = "c1T3", "c1T2", "c1T4"
DARK = "dark"
LIT, SCREEN = "orange", "cyan"

# side -> (along, out): unit vectors along the face (u, v) and out of it; `s` along a face is plain v on a u side and
# plain u on a v side
AX = {"+u": ((0, 1), (1, 0)), "-u": ((0, 1), (-1, 0)), "+v": ((1, 0), (0, 1)), "-v": ((1, 0), (0, -1))}


def _oct(u0, u1, v0, v1, c):
    return [(u0 + c, v0), (u1 - c, v0), (u1, v0 + c), (u1, v1 - c), (u1 - c, v1), (u0 + c, v1), (u0, v1 - c), (u0, v0 + c)]


def hull(k, u0, u1, v0, v1, z0, z1, cv=0.16, ct=0.1, side=BODY, bevel=TRIM, top=BODY_L, corner=TRIM):
    """A housing with chamfered vertical corners (cv) and top edges (ct); the corner chamfers in `corner` (armour)."""
    lo = _oct(u0, u1, v0, v1, cv)
    hi = _oct(u0 + ct, u1 - ct, v0 + ct, v1 - ct, max(0.0, cv - ct * 0.42))
    c = Vector(((u0 + u1) / 2, (v0 + v1) / 2, 0))
    zm = z1 - ct
    for i in range(8):
        j = (i + 1) % 8
        if math.dist(lo[i], lo[j]) < 1e-6:
            continue
        out = Vector(((lo[i][0] + lo[j][0]) / 2, (lo[i][1] + lo[j][1]) / 2, 0)) - c
        armour = corner and i % 2 == 1                                      # odd edges are the corner chamfers
        face(k, [(*lo[i], z0), (*lo[j], z0), (*lo[j], zm), (*lo[i], zm)], out, corner if armour else side)
        if ct > 0:
            face(k, [(*lo[i], zm), (*lo[j], zm), (*hi[j], z1), (*hi[i], z1)], out.normalized() + Vector((0, 0, 1)),
                 corner if armour else bevel)
    face(k, [(*p, z1) for p in hi], (0, 0, 1), top)


def at(side, plane, s, z, d=0.0):
    """A local point on a side's face: s along it, height z, d out from it."""
    (au, av), (nu, nv) = AX[side]
    return (nu * plane + au * s + nu * d, nv * plane + av * s + nv * d, z)


def sbox(k, side, plane, s, z, w, d, h, col, top=None, d0=0.0):
    """A box on a side's face: w along it, standing d out (from d0), z .. z + h."""
    u, v, _ = at(side, plane, s, z, d0 + d / 2)
    su, sv = (d, w) if side in ("+u", "-u") else (w, d)
    k.box(u, v, z, su, sv, h, col, top=top)


def vent(k, side, plane, s, z0, z1, w, active=False, n=None, frame=TRIM_D):
    """A heat-exchanger bay: a dark recess behind vertical slats in a frame, glowing low behind them when active."""
    n = n or max(3, round(w / 0.09))
    sbox(k, side, plane, s, z0, w, 0.006, z1 - z0, DARK)
    if active:
        sbox(k, side, plane, s, z0 + 0.03, w - 0.06, 0.008, (z1 - z0) * 0.35, LIT)
    for i in range(n):
        sbox(k, side, plane, s - w / 2 + w * (i + 0.5) / n, z0, 0.026, 0.035, z1 - z0, BODY_D, top=BODY)
    for z in (z0 - 0.03, z1):
        sbox(k, side, plane, s, z, w + 0.06, 0.045, 0.03, frame, top=frame)
    for e in (-1, 1):
        sbox(k, side, plane, s + e * (w / 2 + 0.015), z0 - 0.03, 0.03, 0.045, z1 - z0 + 0.06, frame, top=frame)


def screen(k, side, plane, s, z, w, h, on, col=SCREEN):
    """A screen set in a bezel on a side's face."""
    sbox(k, side, plane, s, z, w, 0.025, h, BODY_D, top=BODY)
    sbox(k, side, plane, s, z + 0.025, w - 0.05, 0.03, h - 0.05, col if on else DARK)


def lamp(k, side, plane, s, z, on, col=LIT, w=0.06, h=0.04):
    sbox(k, side, plane, s, z, w, 0.03, h, col if on else BODY_D)


def port(k, u, v, z, r, active, collar=TRIM, glow=("flameY", "orange")):
    """A round port in a top face: a painted collar, a dark throat; molten light in it when active."""
    k.cyl(u, v, z, r, 0.12, BODY_D, top=collar, sides=16)
    k.cyl(u, v, z + 0.12, r * 0.95, 0.03, collar, top=collar, sides=16)
    k.cyl(u, v, z + 0.1, r * 0.72, 0.055, DARK, top=DARK, sides=14)
    if active:
        k.cyl(u, v, z + 0.1, r * 0.6, 0.06, glow[1], top=glow[1], sides=14)
        k.cyl(u, v, z + 0.1, r * 0.38, 0.065, glow[0], top=glow[0], sides=12)
