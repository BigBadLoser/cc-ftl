"""Reusable mechanical-detail helpers on top of cmbkit.Frame (runs inside Blender).

All coordinates are the module's LOCAL frame (u along the long axis, +u = hull side; v across; z up), like Frame.
Rule of thumb for sprites at 64x32 tiles: one tile is ~45 px along an axis, so every detail (rib thickness, gap, pipe
diameter, panel inset) must be >= ~0.05 tiles or it vanishes in the downsample. Shapes stay clean: flat bands from
geometry, never texture."""
import math
from mathutils import Vector


def _basis(a):
    """Two unit vectors e1, e2 with e1 x e2 = a (hcyl's ring orientation, so the winding matches)."""
    ref = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
    e1 = a.cross(ref).normalized()
    return e1, a.cross(e1)


def seg(f, a, b, r, mat, sides=8, cap=None, capstart=None):
    """Round tube between two local points a, b (u, v, z), any direction."""
    a, b = Vector(a), Vector(b)
    ax = (b - a).normalized()
    e1, e2 = _basis(ax)
    a0 = math.pi / sides

    def ring(c):
        return [f.pt(*(c + e1 * (r * math.cos(a0 + i * math.tau / sides)) + e2 * (r * math.sin(a0 + i * math.tau / sides))))
                for i in range(sides)]
    A, B = ring(a), ring(b)
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap:
        f.poly(B[::-1], cap, flip=True)
    if capstart:
        f.poly(A, capstart, flip=True)


def flange(f, p, axis, r, mat="steelL", t=0.06, sides=8, bolt=None):
    """Thick collar ring around a pipe at p, axis = 'u' | 'v' | 'z'."""
    d = {"u": (t, 0, 0), "v": (0, t, 0), "z": (0, 0, t)}[axis]
    a = Vector(p) - Vector(d) / 2
    b = Vector(p) + Vector(d) / 2
    seg(f, a, b, r, mat, sides, cap=bolt or mat, capstart=mat)


def pipe(f, pts, r, mat="gm", joint="steelL", flanges=True, sides=8, flange_every=0.7):
    """Axis-aligned polyline pipe run with a chunky coupling at every elbow and flange rings on long straights.
    Elbow = a cube coupling 2.5r wide (reads as a bolted joint at sprite scale)."""
    P = [Vector(p) for p in pts]
    for i in range(len(P) - 1):
        a, b = P[i], P[i + 1]
        seg(f, a, b, r, mat, sides, cap=mat, capstart=mat)
        ln = (b - a).length
        if flanges and ln > 0.35:
            ax = "u" if abs(b.x - a.x) > 1e-6 else "v" if abs(b.y - a.y) > 1e-6 else "z"
            n = max(1, int(ln / flange_every))
            for k in range(n):
                flange(f, a + (b - a) * ((k + 0.5) / n), ax, r * 1.45, joint, sides=sides)
    for p in P[1:-1]:
        f.box(p.x, p.y, p.z, r * 2.7, r * 2.7, r * 2.7, joint, base=False)
    for p in (P[0], P[-1]):
        f.box(p.x, p.y, p.z, r * 2.2, r * 2.2, r * 2.2, joint, base=False)


def conduit_bundle(f, p0, p1, n=3, pitch=0.13, r=0.05, mats=("gm", "steelL", "gm"), across="z", clamps=3):
    """n parallel straight pipes from p0 to p1 spread across 'z' (stacked) or 'v' (side by side), with clamps."""
    p0, p1 = Vector(p0), Vector(p1)
    off = Vector((0, 0, 1)) if across == "z" else Vector((0, 1, 0))
    for i in range(n):
        d = off * ((i - (n - 1) / 2) * pitch)
        seg(f, p0 + d, p1 + d, r, mats[i % len(mats)], 8, cap=mats[i % len(mats)])
    w = n * pitch + r
    for k in range(clamps):
        c = p0 + (p1 - p0) * ((k + 0.5) / clamps)
        sz = (0.07, w, w) if across == "v" else (0.07, w, w)
        ax = (p1 - p0)
        if abs(ax.x) > abs(ax.y):
            f.box(c.x, c.y, c.z, 0.07, w if across == "v" else 2 * r + 0.04, w if across == "z" else 2 * r + 0.04, "steelD", base=False)
        else:
            f.box(c.x, c.y, c.z, w if across == "v" else 2 * r + 0.04, 0.07, w if across == "z" else 2 * r + 0.04, "steelD", base=False)


def ribs(f, u0, u1, v, z, r0, r1, n, thick=0.06, grow=0.05, mat="gm", sides=12):
    """n ring ribs along u on a (tapered) bell/tube from radius r0 at u0 to r1 at u1."""
    for k in range(n):
        t = (k + 0.5) / n
        u = u0 + (u1 - u0) * t
        r = r0 + (r1 - r0) * t + grow
        f.hcyl(u - thick / 2, u + thick / 2, v, z, r, mat, sides=sides, cap=mat)


def fins(f, u0, u1, v, z, sv, sz, n, thick=0.06, mat="steelL", top="plate", base=True):
    """Radiator fin array: n thin plates across u, each sv wide (v) and sz tall."""
    for k in range(n):
        u = u0 + (u1 - u0) * (k + 0.5) / n
        f.box(u, v, z, thick, sv, sz, mat, top=top, base=base)


def slats(f, u0, u1, v, z0, z1, n, side, depth=0.03, w=0.05, mat="dark"):
    """Vent slats on a +v/-v face (side = +1/-1): n horizontal grooves between z0 and z1 along u0..u1."""
    for k in range(n):
        z = z0 + (z1 - z0) * (k + 0.5) / n
        f.box((u0 + u1) / 2, v + side * depth / 2, z, u1 - u0, depth, w, mat, base=False)


def panel(f, u, v, z, su, sv, mat="steelL", seam="steelD", face="z", t=0.03, ring=0.04, bolts=True):
    """Inset-look panel: a dark seam frame with a lighter raised plate and corner bolts, on a face of the part below.
    face 'z' = top at height z; '+v'/'-v' = side face at v (su along u, sv is HEIGHT, centred at z);
    '+u'/'-u' = end face at u (su is across v, sv is height, centred at z)."""
    if face == "z":
        f.box(u, v, z, su, sv, t, seam)
        f.box(u, v, z + t, su - 2 * ring, sv - 2 * ring, t, mat, top=mat)
        pts = [(su / 2 - ring, sv / 2 - ring)] if bolts else []
        for a, b in [(1, 1), (-1, 1), (1, -1), (-1, -1)] if bolts else []:
            f.box(u + a * (su / 2 - ring * 1.5), v + b * (sv / 2 - ring * 1.5), z + 2 * t, 0.045, 0.045, 0.03, "plate")
    elif face in ("+v", "-v"):
        s = 1 if face == "+v" else -1
        f.box(u, v + s * t / 2, z, su, t, sv, seam, base=False)
        f.box(u, v + s * 1.5 * t, z, su - 2 * ring, t, sv - 2 * ring, mat, base=False)
        if bolts:
            for a, b in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
                f.box(u + a * (su / 2 - ring * 1.5), v + s * 3 * t, z + b * (sv / 2 - ring * 1.5), 0.045, 0.03, 0.045, "plate", base=False)
    else:
        s = 1 if face == "+u" else -1
        f.box(u + s * t / 2, v, z, t, su, sv, seam, base=False)
        f.box(u + s * 1.5 * t, v, z, t, su - 2 * ring, sv - 2 * ring, mat, base=False)
        if bolts:
            for a, b in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
                f.box(u + s * 3 * t, v + a * (su / 2 - ring * 1.5), z + b * (sv / 2 - ring * 1.5), 0.03, 0.045, 0.045, "plate", base=False)


def bracket(f, u, v, z0, z1, w=0.12, d=0.1, mat="steelD"):
    """Pipe/tank clamp strap: a post from the deck up to the pipe."""
    f.box(u, v, z0, d, w, z1 - z0, mat, top="steel")


def tank(f, u, v, z, r, h, mat="gm", cap="steelL", bands=2, sides=10):
    """Vertical pressure tank: body, domed cap (stepped), flange bands."""
    f.vcyl(u, v, z, r, h, mat, top=cap, sides=sides)
    for k in range(bands):
        f.vcyl(u, v, z + h * (k + 1) / (bands + 1) - 0.03, r + 0.04, 0.06, "steelL", top="steelL", sides=sides)
    f.vcyl(u, v, z + h, r * 0.7, 0.05, "steelL", top="plate", sides=sides)
    f.vcyl(u, v, z + h + 0.05, r * 0.3, 0.06, "steelD", top="gm", sides=sides)


def trim(f, u, v, z, su, sv, mat="plate", w=0.045, h=0.035):
    """Raised rim strips around a box top at height z (a lit edge that separates stacked blocks)."""
    f.box(u, v + sv / 2 - w / 2, z, su, w, h, mat)
    f.box(u, v - sv / 2 + w / 2, z, su, w, h, mat)
    f.box(u + su / 2 - w / 2, v, z, w, sv - 2 * w, h, mat)
    f.box(u - su / 2 + w / 2, v, z, w, sv - 2 * w, h, mat)


def drum(f, u0, u1, v, z, r, n=5, body="gmD", rib="plate", cap="steelL", sides=12, rib_t=0.1, grow=0.06):
    """Ribbed barrel lying along u (reactor / capacitor drum): body, n chunky rings, bolted end plates."""
    f.hcyl(u0, u1, v, z, r, body, sides=sides, cap=cap, capstart=cap)
    for k in range(n):
        u = u0 + (u1 - u0) * (k + 0.5) / n
        f.hcyl(u - rib_t / 2, u + rib_t / 2, v, z, r + grow, rib, sides=sides, cap=rib, capstart=rib)
    f.hcyl(u0 - 0.05, u0, v, z, r + 0.1, "steelL", sides=sides, cap="steelL", capstart="steelL")
    f.hcyl(u1, u1 + 0.05, v, z, r + 0.1, "steelL", sides=sides, cap="steelL", capstart="steelL")


def rail(f, a, b, w=0.05, mat="steelL"):
    """Square-section strap/rail between two local points (gusset, spine, cable tray)."""
    seg(f, a, b, w, mat, sides=4, cap=mat, capstart=mat)


def loft_box(f, corner, mat, top=None):
    """Box lofted between arbitrary corners: corner(a, b, d) -> local point for a, b, d in (-1, 1). The corner frame
    (a, b, d) must be right-handed like (u, v, z); the faces are the same as Frame.box."""
    P = {(a, b, d): f.pt(*corner(a, b, d)) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)}
    faces = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)),
             ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)),
             ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1))]
    for ks in faces:
        f.poly([P[k] for k in ks], mat, flip=True)


def vanes(f, u0, u1, v, z, ri, ro, n, thick=0.08, mat="gm", phase=0.0):
    """Radial vane array around a bell axis along u: n plates from inner radius ri(u) to outer radius ro(u)
    (callables of u), leaving open gaps between them. Gives a segmented / finned nozzle instead of a smooth cone."""
    for k in range(n):
        th = phase + k * math.tau / n
        s, c = math.sin(th), math.cos(th)

        def corner(a, b, d, s=s, c=c):
            u = u0 if a < 0 else u1
            rho = ri(u) if d < 0 else ro(u)
            t = b * thick / 2
            return (u, v + rho * s + t * c, z + rho * c - t * s)
        loft_box(f, corner, mat)
