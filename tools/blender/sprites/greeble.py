"""Surface greebles for the detail kit (runs inside Blender): junction boxes, valve wheels, hex-bolt clusters, hatches.

Every element is placed on a face of the part below: face 'z' (a top at height s), '+v'/'-v' (a side face at v = s) or
'+u'/'-u' (an end face at u = s). (a, b) are the two coordinates ALONG the face: for 'z' (u, v); for '+v'/'-v' (u, z);
for '+u'/'-u' (v, z). Sizes are >= ~0.06 tiles (3 px) so they survive the downsample."""
import math
from mathutils import Vector
from . import detail as D


def _pt(face, a, b, s, d=0.0):
    sg = -1 if face.startswith("-") else 1
    if face == "z":
        return Vector((a, b, s + d))
    if face[1] == "v":
        return Vector((a, s + sg * d, b))
    return Vector((s + sg * d, a, b))


def sbox(f, face, a, b, s, w, h, d, mat, top=None):
    """Box standing on the face: w along the first axis, h along the second, d out of the surface."""
    c = _pt(face, a, b, s, d / 2)
    if face == "z":
        f.box(c.x, c.y, c.z, w, h, d, mat, top=top, base=False)
    elif face[1] == "v":
        f.box(c.x, c.y, c.z, w, d, h, mat, top=top, base=False)
    else:
        f.box(c.x, c.y, c.z, d, w, h, mat, top=top, base=False)


def disc(f, face, a, b, s, r, d0, d1, mat, sides=8, cap=None):
    """Round plate/stem out of the face from depth d0 to d1."""
    D.seg(f, _pt(face, a, b, s, d0), _pt(face, a, b, s, d1), r, mat, sides, cap=cap or mat, capstart=mat)


def hex_cluster(f, face, a, b, s, n=4, pitch=0.17, r=0.065, mat="plate", cols=2):
    """n hex bolt heads in a grid (cols wide) centred on (a, b)."""
    rows = (n + cols - 1) // cols
    for k in range(n):
        i, j = k % cols, k // cols
        disc(f, face, a + (i - (cols - 1) / 2) * pitch, b + (j - (rows - 1) / 2) * pitch, s, r, 0, 0.045, mat, sides=6)


def junction_box(f, face, a, b, s, w=0.44, h=0.34, d=0.12, mat="steelL", lid="plate"):
    """Boxy junction with an inset lid, corner bolts and a conduit stub out of one side."""
    sbox(f, face, a, b, s, w, h, d, mat)
    sbox(f, face, a, b, s, w - 0.07, h - 0.07, d + 0.03, "steelD")
    sbox(f, face, a, b, s, w - 0.11, h - 0.11, d + 0.05, lid)
    for sx in (-1, 1):
        disc(f, face, a + sx * (w / 2 - 0.02), b + h / 2 - 0.02, s, 0.025, d, d + 0.04, "bolt", sides=6)
    sbox(f, face, a + w / 2 + 0.05, b, s, 0.1, 0.07, 0.07, "gm")


def valve_wheel(f, face, a, b, s, r=0.21, mat="brass"):
    """Hand wheel on a stem: rim disc, dark hub, two crossed spokes."""
    disc(f, face, a, b, s, 0.04, 0, 0.09, "steelL", sides=6)
    disc(f, face, a, b, s, r, 0.09, 0.12, mat, sides=10)
    disc(f, face, a, b, s, r * 0.62, 0.12, 0.125, "steelD", sides=10)
    sbox(f, face, a, b, s, 2 * r - 0.02, 0.06, 0.15, mat)
    sbox(f, face, a, b, s, 0.06, 2 * r - 0.02, 0.15, mat)
    disc(f, face, a, b, s, 0.045, 0.125, 0.17, "plate", sides=6)


def hatch(f, face, a, b, s, w=0.55, h=0.38, handle="brass"):
    """Access hatch: seam frame, raised door, bar handle and two hinge blocks."""
    sbox(f, face, a, b, s, w, h, 0.03, "dark")
    sbox(f, face, a, b, s, w - 0.07, h - 0.07, 0.06, "steel", top="plate")
    sbox(f, face, a + w * 0.18, b, s, 0.06, h * 0.5, 0.1, handle)
    for sz in (-1, 1):
        sbox(f, face, a - w / 2 + 0.03, b + sz * h * 0.28, s, 0.06, 0.06, 0.08, "steelL")


def scatter(f, face, s, items):
    """items: [(kind, a, b), ...] kind in 'junction', 'valve', 'bolts', 'hatch'."""
    fn = {"junction": junction_box, "valve": valve_wheel, "bolts": hex_cluster, "hatch": hatch}
    for kind, a, b in items:
        fn[kind](f, face, a, b, s)
