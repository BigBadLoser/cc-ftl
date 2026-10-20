"""Local-frame builder for the module pack (storage set, medbay, battery, ...). Runs inside Blender.

A module is written once in a LOCAL frame: u across its width, v along its depth, front (the access / camera-facing
side) = +v, z up, origin at the middle of the footprint `fp` = (width, depth) in tiles. `K(name, fp, rot)` maps it to
the grid for the four sim rotations (the front turns clockwise like the fabricator: r0 +y, r1 -x, r2 -y, r3 +x) and
places the body so that the sprite origin is the centre of the front-most footprint tile, as for every other module.
Modules stand on the ship floor: no slab under them (feet, skids and pallets are parts of the model)."""
import math

from . import core

HALF_PI = math.pi / 2


class K:
    def __init__(self, name, fp, rot=0):
        self.m = core.Mesh(name)
        self.rot = rot
        w, d = fp if rot % 2 == 0 else (fp[1], fp[0])
        self.off = (-(w - 1) / 2, -(d - 1) / 2)

    def p(self, u, v):
        x, y = ((u, v), (-v, u), (-u, -v), (v, -u))[self.rot]
        return x + self.off[0], y + self.off[1]

    def box(self, u, v, z, su, sv, sz, col, top=None, bevel=0.0, rz=0.0, rx=0.0, taper=1.0):
        """Bottom-centred box at local (u, v, z), sizes along u, v, z; rz turns it about its own centre."""
        x, y = self.p(u, v)
        self.m.box((x, y, z), (su, sv, sz), col, top=top, base=True, bevel=bevel, rz=rz + self.rot * HALF_PI,
                   rx=rx, taper=taper)

    def cyl(self, u, v, z, r, h, col, top=None, sides=12, rtop=None):
        x, y = self.p(u, v)
        self.m.cyl((x, y, z), r, h, col, sides=sides, top=top, rtop=rtop)

    def door(self, hu, v, z, w, h, t, col, ang, side=1, top=None):
        """A door hinged at local u = hu on the front plane v. Shut (ang 0) it spans u = hu .. hu - side * w; it swings
        out toward +v by `ang` radians."""
        cu = hu - side * math.cos(ang) * w / 2
        cv = v + math.sin(ang) * w / 2
        self.box(cu, cv, z, w, t, h, col, top=top, rz=-side * ang)

    def build(self):
        return [self.m.build()]


def crate(k, u, v, z, s, col, rz=0.0, h=None, strap="strap"):
    """A cargo crate (s wide, h tall) with a strap band round it."""
    h = h or s * 0.85
    k.box(u, v, z, s, s, h, col, top="plate", bevel=0.012, rz=rz)
    k.box(u, v, z + h * 0.45, s + 0.012, s + 0.012, 0.035, strap, rz=rz)


def lamp(k, u, v, z, col, s=0.08):
    k.box(u, v, z, s, 0.03, s * 0.6, col)


def sprites(name, fp, states, build, rots=range(4)):
    """[(id, footprint, kind, builder)] for every rotation and state; the plain id is r0 with the first state."""
    out = []
    for r in rots:
        sfx = "" if r == 0 else f".r{r}"
        f = fp if r % 2 == 0 else (fp[1], fp[0])
        for s in states:
            out.append((f"{name}{sfx}.{s}", f, "prop", lambda r=r, s=s: build(s, r)))
        if r == 0:
            out.append((name, f, "prop", lambda s=states[min(1, len(states) - 1)]: build(s, 0)))
    return out
