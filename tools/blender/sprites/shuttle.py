"""SHUTTLE prototype (vehicle.shuttle): a compact, chunky utility craft for a pilot plus four. Not wired in.

Local frame (shuttle_bay.BayFrame with off/yaw): u across, v along (nose at -v), z up, origin = the craft's centre on the
pad. Parked on its bay (r0) it sits on four legs on the closed hatch leaves, nose to the back of the bay, with the rear
ramp (left half of the tail, over the boarding tile) facing the camera and the boarding apron.

Shape: a flared lower hull and a raked cabin with a wrap windscreen, two side engine nacelles on stub pylons, a tail
fin and a roof spine. The rose spine, fin and nacelle bands are the livery area (team-tintable later)."""
import math
from . import core, cmbkit, detail as D
from .shuttle_bay import BayFrame, lbox

OFF = (0.0, -0.25)                 # parked position on the pad (centred on the hatch)
LIV, LIVL = "rM", "rL"             # livery (dusty rose, like the doors)
BODY, BODYL = "plate", "gW1"       # light grey hull: sides / lit tops
NX, NZ, NR = 1.03, 0.9, 0.25       # nacelle axis (u, z) and radius
NV0, NV1 = -0.62, 1.22             # nacelle intake / nozzle v


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def _cone_v(f, u, z, v0, v1, r0, r1, mat, sides=12, cap=None):
    """Cone frustum along v (r0 at v0, r1 at v1), optional cap at v1."""
    a0 = math.pi / sides
    ring = lambda v, r: [f.pt(u + r * math.cos(a0 + i * math.tau / sides), v, z + r * math.sin(a0 + i * math.tau / sides)) for i in range(sides)]  # noqa: E731
    A, B = ring(v0, r0), ring(v1, r1)
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap:
        f.poly(B[::-1], cap, flip=True)


def hull(f):
    _g("hull")
    zb, zm, zt = 0.48, 0.86, 1.4
    # lower hull: flares out going up (chunky boat section), chin under the nose; its top shows as a lit shoulder ledge
    lbox(f, lambda a, b, d: (a * (0.62 if d < 0 else 0.8), (-1.4 if b < 0 else 1.26) if d < 0 else (-1.75 if b < 0 else 1.26), zb if d < 0 else zm),
         {"top": BODYL, "bot": "steelD", "side": BODY, "-b": "steelL"})
    _g("belt")
    lbox(f, lambda a, b, d: (a * 0.705, (-1.62 if b < 0 else 1.25), zm + (0.0 if d < 0 else 0.07)), {"side": "steelD", "top": "steelD"})
    _g("cabin")
    # cabin: long raked canopy (flat enough to face the camera from above), sides lean in
    lbox(f, lambda a, b, d: (a * (0.68 if d < 0 else 0.56), (-1.6 if b < 0 else 1.25) if d < 0 else (-0.62 if b < 0 else 1.18), zm + 0.07 if d < 0 else zt),
         {"top": BODYL, "side": BODY, "-b": "glassD", "bot": BODY})
    zc0, zc1, vc0, vc1 = zm + 0.07, zt, -1.6, -0.62
    for uu in (-0.2, 0.2):                                                       # canopy frames
        lbox(f, lambda a, b, d, uu=uu: (uu + a * 0.04, (vc0 if b < 0 else vc1) - 0.0, (zc0 if b < 0 else zc1) + (0.0 if d < 0 else 0.03)),
             {"side": "steelL", "top": BODYL})
    lbox(f, lambda a, b, d: (a * (0.66 if b < 0 else 0.58), (vc0 + 0.45 if b < 0 else vc0 + 0.53), zc0 + (zc1 - zc0) * (0.46 if b < 0 else 0.54) + (0.0 if d < 0 else 0.03)),
         {"side": "steelL", "top": BODYL})
    # side windows: dark glass strips on the cabin flanks behind the canopy
    for s in (-1, 1):
        def win(a, b, d, s=s):
            z = zm + 0.22 + (d + 1) * 0.11
            t = (z - zm - 0.07) / (zt - zm - 0.07)
            uu = s * (0.68 + (0.56 - 0.68) * t + 0.012 + (a + 1) * 0.008)
            return (uu, -0.5 + (b + 1) * 0.42, z)
        lbox(f, win, {"side": "glassD", "top": "glassD"})
    # roof: full-length livery stripe, a roof hatch and a sensor dome, then the tail fin
    _g("spine")
    f.box(0.24, 0.3, zt, 0.3, 1.7, 0.05, LIV, top=LIVL)
    f.box(-0.3, 0.93, zt, 0.44, 0.4, 0.03, "steelD", top="hazK")          # dorsal boarding hatch (the bay's gangway meets it)
    f.box(-0.3, 0.93, zt + 0.03, 0.32, 0.28, 0.02, "steel", top="steelL")
    f.vcyl(-0.3, -0.3, zt, 0.1, 0.07, "steelL", top="steel", sides=12)


def tail(f, lamp=True):
    """Rear: ramp door on the left half (over the boarding tile), a vent block on the right, lamp over the door."""
    _g("door")
    v = 1.26
    f.box(-0.3, v + 0.025, 0.52, 0.72, 0.05, 0.78, "steel", top="steelL")
    f.box(-0.3, v + 0.06, 0.52, 0.66, 0.03, 0.08, "hazY", top="hazY")
    for zz in (0.75, 1.0):
        f.box(-0.3, v + 0.06, zz, 0.6, 0.03, 0.04, "steelD", top="steelD")
    f.box(-0.3, v + 0.065, 1.3, 0.22, 0.04, 0.06, "lampY" if lamp else "oD")
    _g("vent")
    f.box(0.37, v + 0.03, 0.6, 0.4, 0.06, 0.56, "steelD", top="steel")
    D.slats(f, 0.2, 0.54, v + 0.06, 0.66, 1.1, 4, 1, depth=0.025, w=0.05, mat="dark")


def nacelles(f, hot):
    for s in (-1, 1):
        u = s * NX
        _g("nacelle")
        D.seg(f, (u, NV0, NZ), (u, NV1, NZ), NR, BODY, 12, cap=BODY, capstart=BODY)
        _cone_v(f, u, NZ, NV0, NV0 - 0.3, NR, 0.09, "steelL", 12, cap="steel")                              # nose fairing
        D.seg(f, (u, 0.15, NZ), (u, 0.33, NZ), NR + 0.02, LIV, 12, cap=LIV, capstart=LIV)                     # livery band
        _g("nozzle")
        _cone_v(f, u, NZ, NV1, NV1 + 0.16, NR - 0.02, NR + 0.03, "steel", 12)
        D.seg(f, (u, NV1 + 0.1, NZ), (u, NV1 + 0.12, NZ), NR - 0.06, "steelD", 12, cap="cyan" if hot else "dark")
        if hot:
            _cone_v(f, u, NZ, NV1 + 0.16, NV1 + 0.7, NR - 0.04, 0.05, "cyan", 12)
        _g("pylon")
        f.box(s * 0.76, 0.3, 0.92, 0.18, 1.2, 0.12, "steelL", top=BODYL)
        _g("navlight")
        f.box(s * (NX + NR - 0.02), NV0 + 0.12, NZ - 0.04, 0.05, 0.1, 0.1, "red" if s < 0 else "green")


def legs(f):
    _g("leg")
    for s in (-1, 1):
        for vv in (-1.05, 0.85):
            D.seg(f, (s * 0.5, vv, 0.5), (s * 0.8, vv, 0.1), 0.055, "steelL", 8)
            f.box(s * 0.5, vv, 0.4, 0.16, 0.16, 0.1, "steelD", top="steel")
            _g("foot")
            f.vcyl(s * 0.8, vv, 0.04, 0.14, 0.06, "steelD", top="steel", sides=12)
            _g("leg")


def build(f, state="parked"):
    """state: parked (legs down, engines cold), fly (legs up, engines lit), launch (legs up, engines lit)."""
    hot = state != "parked"
    hull(f)
    tail(f)
    nacelles(f, hot)
    if state == "parked":
        legs(f)


PARK_DZ = -1.19                    # down in the bay's hangar well, feet on the launch rail (shuttle_bay.PIT - rail)


def parked(rot=0):
    """Sitting in the bay's well; render it with shuttle_bay.bay(rot) as a holdout so the coaming cuts it."""
    m = core.Mesh(f"shuttle_parked_r{rot}")
    m.dz = PARK_DZ
    build(BayFrame(m, rot, off=OFF), "parked")
    return [m.build()]


def launch(rot=0, dz=0.0):
    """Hovering / sinking into the shaft (dz < 0), legs up, engines lit; same anchor as the bay."""
    m = core.Mesh(f"shuttle_launch_r{rot}_{dz:.2f}")
    m.dz = dz
    build(BayFrame(m, rot, off=OFF), "launch")
    return [m.build()]


def fly(d):
    """Sector view: heading d (0..7), nose toward grid -y at d0, clockwise by 45 deg steps; origin = the craft centre."""
    m = core.Mesh(f"shuttle_fly_d{d}")
    build(BayFrame(m, 0, anchor=False, yaw=d * math.pi / 4), "fly")
    return [m.build()]
