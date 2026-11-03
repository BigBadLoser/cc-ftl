"""Stage 8: the Kestrel behind the hull's thruster block (sprites/hull_engine). The engine, its thrust axis 0.3
lower (at hull_engine.AXIS), comes out through the block's port; the bell pushed 0.3 further out. On the bell: a gold
manifold band with dark steel edges, and two gold pipes off it along the bell, midway between the straps, sweeping
round into flanged sockets in the block front's top corners. The old feed pipes into the collector (the Y) are gone.
Only the near rotations (1, 2: hull_engine.KESTREL) have a block."""
import math
from contextlib import contextmanager

import bpy

from sprites import hull_engine as HE

DROP = 0.3              # the whole engine this much lower than stage 7
PUSH = 0.3              # the bell (the outboard part) this much further out
U0 = 2.107 - PUSH       # a bell u at the block's d = u - U0 (d out from the hull row's middle line)
BAND = (3.11, 3.21)     # the manifold band: between the staves' two rows, about halfway out
PIPES = ((30, 45), (150, 135))      # the pipes' angles round the axis (deg): off the band midway between the straps
                                    # (every 60 from 0), into sockets centred in the front's top corners
SR = 1.0                # the sockets' distance from the axis (midway from the port's rim to the corner)


@contextmanager
def lowered(model, stage):
    """The model's axis heights, DROP lower for stage 8 (the whole engine, as built at BZ and moved to THRUST_Z)."""
    if stage < 8:
        yield
        return
    bz, tz = model.BZ, model.THRUST_Z
    model.BZ, model.THRUST_Z = bz - DROP, tz - DROP
    try:
        yield
    finally:
        model.BZ, model.THRUST_Z = bz, tz


def nozzle(model, f, stage):
    """The band, the two pipes and their sockets (built at BZ, with the bell)."""
    BZ = model.BZ
    rad = lambda u: model.bell_radius(u, stage)                         # noqa: E731
    u0, u1 = BAND
    rm = rad((u0 + u1) / 2)
    model.annulus(f, u0 - 0.06, u1 + 0.06, rm - 0.03, rm + 0.08, BZ, "brass", "brass", sides=32)
    for e0, e1 in ((u0 - 0.1, u0 - 0.06), (u1 + 0.06, u1 + 0.1)):     # (its dark steel edges)
        model.annulus(f, e0, e1, rad(e0) - 0.03, rad(e0) + 0.11, BZ, "steelD", "steel", sides=32)
    front = HE.DF + U0                                                  # (the block's front, in bell u)
    at = lambda u, r, t: (u, r * math.cos(t), BZ + r * math.sin(t))     # noqa: E731
    for d0, d1 in PIPES:
        a0, a = math.radians(d0), math.radians(d1)
        path = []
        for i in range(7):                      # (one smooth sweep: out off the band, along the bell, round into its
            t = i / 6                           # socket, easing from between the straps to the corner)
            e = t * t * (3 - 2 * t)
            u = u0 + (front + 0.1 - u0) * t
            path.append(at(u, (rad(u0) + 0.1) * (1 - t) + SR * t + 0.12 * math.sin(math.pi * t), a0 + (a - a0) * e))
        path += [at(front + 0.06, SR, a), at(front + 0.02, SR, a)]     # (straight into its socket, seated in it)
        model.curved_pipe(f, path, 0.08, "brass", steps=4, sides=12)
        v, z = SR * math.cos(a), BZ + SR * math.sin(a)
        f.hcyl(front - 0.02, front + 0.04, v, z, 0.13, "steelD", sides=16, capstart="steel")   # (its socket: a
        f.hcyl(front + 0.04, front + 0.12, v, z, 0.1, "steel", sides=16, capstart="steelD")    # flange, a collar)


def holdouts(rot):
    """What stands in front of the engine in every view without a roof, as holdouts: the block, its ring and the
    engine's own hull (the row's two inner tiles, full height, closed at the ends). Not the row's end tiles nor the
    hull wall: there the near hull is its belly's cut top (walls up too), so the machine shows over them."""
    own, wide = HE.module_block(rot)
    for ob in wide:
        if ob not in own:
            bpy.data.objects.remove(ob)
    objs = own + HE.module_hull(rot)
    for ob in objs:
        ob.is_holdout = True
    return objs
