"""ENGINE module art (4x5, one big bell, runs inside Blender). Review only, not wired into the sheets yet.

Local frame (cmbkit.Frame): u -2.5..2.5 is the depth (+u = the hull side, the bell points +u into space), v -2..2 runs
along the hull, z up. The hull row is u 1.5..2.5: the engine's own bulkhead stands there (the real hull-wall profile
plus engine armour, always full height) and the bell passes through it. Inside (u -2.5..1.5) sits an F-1 style drive
train: injector dome on a gimbal yoke and thrust frame, the combustion chamber with its propellant manifold torus, a
horizontal turbopump whose two big curved ducts arch into the manifold, the turbine exhaust duct running through the
bulkhead into the torus manifold on the bell, gimbal actuators, a finned heat exchanger and a control cabinet.

Two layers per rotation, drawn hull first, then machine at the same anchor: `hull` (bulkhead) and `machine`
(everything else, rendered with the hull as a Cycles holdout so the bulkhead cuts it). `cell` = both, for the review
render."""
import math
from . import core, detail as D, walls, cmbkit
from .cmbkit import Frame
from .sweep import lathe, torus, tube, curve, bezier, collar, smooth

CENTRE = {0: (-1.5, -2.0), 1: (-2.0, -1.5), 2: (-1.5, -2.0), 3: (-2.0, -1.5)}   # footprint centre - front tile centre
BZ = 1.25                      # bell / chamber axis height
UW = 2.0                       # hull row centre
UI, UO = UW - walls.WT, UW + walls.WT    # inner / outer face of the wall core
T0, R0, UM, RM = 1.5, 0.44, 4.0, 1.30    # throat (u, r) and mouth (u, r): 2.6 across at the mouth
UT = 2.86                      # exhaust manifold torus on the bell
PV, PZ = 1.3, 0.62             # turbopump axis (v, z)


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def rb(u):
    """Outer bell radius: a near-conical flare that keeps opening right to the mouth (reads as a flared bell)."""
    t = min(max((u - T0) / (UM - T0), 0.0), 1.0)
    return R0 + (RM - R0) * (0.25 * t + 0.75 * t ** 1.25)


def ring_pt(u, r, a):
    return (u, r * math.cos(a), BZ + r * math.sin(a))


# ---- bulkhead (hull layer) ------------------------------------------------------------------------------------

def bulkhead(f):
    """The engine's own armoured bulkhead on the hull row, always full height (walls.HF): an armoured skirt over the
    whole row, a dark wall slab with a light cap, flat armoured end frames where the neighbouring hull walls butt in,
    stepped buttresses either side of the bell and the bell-mount collar with brass bolts on the outer face; I-beam
    stiffeners, the inner collar, actuator brackets and duct ports on the inner face."""
    hf = walls.HF
    _g("bulkhead")
    f.box(UW, 0, 0.0, 0.9, 4.0, 0.3, "steel", top="plate")                              # armoured skirt
    f.box(UW, 0, 0.3, UO - UI, 3.72, hf - 0.42, "steelD", top="steelD")                  # wall slab
    f.box(UW, 0, hf - 0.12, UO - UI + 0.08, 4.0, 0.12, "steelL", top="plate")            # cap
    for s in (-1, 1):
        f.box(UW, s * 1.93, 0.3, UO - UI + 0.06, 0.14, hf - 0.42, "steel", top="plate")   # flat end frame
        vb = s * 1.62
        for z0, z1, du in ((0.3, 1.2, 0.3), (1.2, hf - 0.12, 0.2)):                    # stepped buttress
            f.box(UO + du / 2 - 0.01, vb, z0, du + 0.02, 0.46, z1 - z0, "steel", top="plate")
            for zz in (z0 + 0.22, z1 - 0.22):                                         # bolt pair per step
                for dv in (-0.12, 0.12):
                    D.seg(f, (UO + du, vb + dv, zz), (UO + du + 0.04, vb + dv, zz), 0.055, "plate", 6, cap="plate")
        f.box(UI - 0.11, vb, 0.3, 0.22, 0.09, hf - 0.42, "steel", top="plate")         # inner I-beam: web
        f.box(UI - 0.25, vb, 0.3, 0.07, 0.32, hf - 0.42, "steelL", top="plate")        # inner I-beam: flange
        f.box(UI - 0.09, s * 1.05, 1.85, 0.18, 0.3, 0.3, "steelL", top="plate")       # actuator bracket
    _g("collar")
    D.annulus(f, UO, UO + 0.13, 0, BZ, 1.04, rb(UO + 0.13) - 0.01, "steelL", "plate", sides=48)
    D.annulus(f, UO + 0.13, UO + 0.17, 0, BZ, 0.88, rb(UO + 0.17), "steelD", "steel", sides=48)
    for k in range(16):
        u0, (_, v, z) = UO + 0.13, ring_pt(0, 0.96, k * math.tau / 16 + math.pi / 16)
        D.seg(f, (u0, v, z), (u0 + 0.06, v, z), 0.06, "brass", 6, cap="brass")
    _g("icollar")
    D.annulus(f, UI - 0.14, UI, 0, BZ, 0.95, rb(UI - 0.14) - 0.01, "steelL", "plate", sides=48)
    for k in range(12):
        _, v, z = ring_pt(0, 0.8, k * math.tau / 12 + math.pi / 12)
        D.seg(f, (UI - 0.14, v, z), (UI - 0.2, v, z), 0.06, "brass", 6, cap="brass")
    _g("ports")
    for v, z in ((1.12, 0.5), (-1.05, 0.75)):                                          # duct ports, both faces
        D.seg(f, (UI - 0.06, v, z), (UI, v, z), 0.2, "brass", 14, cap="brass", capstart="brass")
    D.seg(f, (UO, 1.12, 0.5), (UO + 0.06, 1.12, 0.5), 0.2, "brass", 14, cap="brass", capstart="brass")


def hull_section(rot, holdout=False):
    """The engine's own hull section (bulkhead layer) as one object."""
    m = core.Mesh(f"engine_bulkhead_{rot}")
    bulkhead(Frame(m, rot, centre=CENTRE[rot]))
    ob = smooth(m.build())
    ob.is_holdout = holdout
    return [ob]


# ---- bell (machine layer) -------------------------------------------------------------------------------------

def bell(f, hot):
    """One big bell: tube-wall regen section, the bolted mount flange, the exhaust manifold torus, a nozzle extension of
    three deep segments between two raised hoops, and a thick rolled lip. Dark open mouth, or a cyan-hot interior plus
    plume when burning."""
    _g("bell")
    prof = [(u / 10, rb(u / 10), "gm") for u in range(15, 23)]                            # inside the wall (hidden)
    prof += [(UO + 0.17, rb(UO + 0.17), "steelD"), (UO + 0.17, rb(UO + 0.17), "steelL", (24, 0.045))]
    prof += [(u, rb(u), "steelL", (24, 0.045)) for u in (2.5, 2.6)]                     # tube wall (regen section)
    prof += [(2.72, rb(2.72), "steelD", (24, 0.04)), (2.72, rb(2.72), "steelD")]
    h = 3.36                                                                              # one raised hoop
    for k, (a, b) in enumerate(((2.72, h - 0.065), (h + 0.065, 3.88))):
        for uu in (a + (b - a) * i / 5 for i in range(6)):
            prof.append((uu, rb(uu), "steel"))
        if k == 0:
            prof += [(h - 0.065, rb(h - 0.065) + 0.075, "plate"), (h + 0.065, rb(h + 0.065) + 0.075, "steelL")]
    rl = rb(3.88)
    prof += [(3.88, rl + 0.08, "plate"), (3.98, rl + 0.1, "plate"), (4.04, rl + 0.06, "steelL")]   # thick lip
    lathe(f, 0, BZ, prof, sides=96)
    _g("mouth")                                                                           # rim + inner skin, throat disc
    rin = lambda u: rb(u) - 0.07                                                          # noqa: E731
    inner = [(4.04, rl + 0.06, "steelL"), (4.04, rin(4.04), "steelD")]
    for i in range(1, 13):
        uu = 4.04 - (4.04 - 1.62) * i / 12
        inner.append((uu, rin(uu), ("cyan" if uu < 3.0 else "steelD") if hot else ("dark" if uu < 3.6 else "steelD")))
    inner[-1] = (1.62, rin(1.62), "arc" if hot else "dark")
    inner.append((1.62, 0.0, None))
    lathe(f, 0, BZ, inner, sides=64, rec=False)
    _g("torus")
    torus(f, UT, 0, BZ, rb(UT) + 0.13, 0.14, "brass", sides=64, tsides=14)
    if hot:
        _g("plume")
        lathe(f, 0, BZ, [(3.9, 0.0, "arc"), (3.9, 0.88, "arc"), (4.1, 0.9, "cyan"), (4.6, 0.74, "cyan"), (4.85, 0.64, "arc"),
                         (4.95, 0.62, "cyan"), (5.4, 0.42, "cyan"), (5.9, 0.16, "cyan"), (6.05, 0.0, None)], sides=48, rec=False)


# ---- machine (machine layer) ----------------------------------------------------------------------------------

def chamber(f):
    """Injector dome + combustion chamber converging into the throat, the propellant manifold torus and a lug band."""
    _g("chamber")
    prof = [(-0.22, 0.0, "steelL"), (-0.22, 0.24, "gm")]
    for i in range(1, 7):
        a = i / 6 * math.pi / 2
        prof.append((0.14 - 0.36 * math.cos(a), 0.24 + 0.36 * math.sin(a), "gm"))
    prof += [(0.62, 0.6, "steelL"), (0.62, 0.67, "plate"), (0.78, 0.67, "steelL"), (0.78, 0.6, "gm"), (1.0, 0.6, "gm"),
             (1.25, 0.53, "gm"), (T0, R0, None)]
    lathe(f, 0, BZ, prof, sides=64)
    _g("manifold")
    torus(f, 0.3, 0, BZ, 0.71, 0.11, "steelL", sides=64, tsides=12)
    _g("gimbal")
    f.box(-0.42, 0, BZ, 0.4, 0.46, 0.42, "steelL", top="plate", base=False)            # gimbal block
    for s in (-1, 1):
        f.box(-0.52, s * 0.3, BZ, 0.5, 0.1, 0.5, "steel", top="plate", base=False)      # yoke cheeks
    f.box(-0.81, 0, BZ, 0.08, 0.7, 0.5, "steel", top="plate", base=False)               # yoke back
    D.seg(f, (-0.42, -0.38, BZ), (-0.42, 0.38, BZ), 0.1, "brass", 12, cap="brass", capstart="brass")   # pivot pin
    _g("frame")
    for s in (-1, 1):
        for top, foot in (((-0.7, s * 0.3, BZ - 0.25), (-1.1, s * 0.66, 0.08)), ((-0.36, s * 0.3, BZ - 0.25), (0.04, s * 0.66, 0.08))):
            D.rail(f, top, foot, 0.075, "steel")
        for uu in (-1.1, 0.04):
            f.box(uu, s * 0.66, 0.0, 0.3, 0.26, 0.08, "steelD", top="steelL")
            D.seg(f, (uu, s * 0.66, 0.08), (uu, s * 0.66, 0.13), 0.06, "brass", 6, cap="brass")
    _g("act")
    for s in (-1, 1):                                                                  # gimbal actuators
        a = (UI - 0.18, s * 1.05, 2.0)
        b = ring_pt(0.7, 0.72, math.pi / 2 - s * math.pi / 4)
        f.box(b[0], b[1], b[2], 0.14, 0.14, 0.14, "steelL", base=False)                  # lug
        mid = tuple(a[i] + (b[i] - a[i]) * 0.55 for i in range(3))
        D.seg(f, a, mid, 0.09, "gm", 12, cap="steelL", capstart="steelL")
        D.seg(f, mid, b, 0.045, "brass", 8)


def turbopump(f):
    """Horizontal turbopump beside the chamber: inducer, LOX and fuel volutes, gearbox, turbine; saddles; the floor
    inlet; two big curved discharge ducts into the manifold; the turbine exhaust duct through the bulkhead."""
    _g("pump")
    prof = [(-1.92, 0.0, "steelL"), (-1.92, 0.3, "gm"), (-1.62, 0.36, "steel"), (-1.62, 0.5, "steelL"), (-1.2, 0.5, "steel"),
            (-1.2, 0.38, "gm"), (-1.08, 0.38, "steel"), (-1.08, 0.48, "steelL"), (-0.72, 0.48, "steel"), (-0.72, 0.34, "gmD"),
            (-0.6, 0.34, "brass"), (-0.6, 0.38, "brass"), (-0.52, 0.38, "brass"), (-0.52, 0.34, "gmD"),
            (-0.2, 0.34, "steel"), (-0.2, 0.42, "steelL"), (0.28, 0.42, "steel"), (0.28, 0.32, "gm"), (0.48, 0.26, "steelL"),
            (0.48, 0.0, None)]
    lathe(f, PV, PZ, prof, sides=48)
    _g("saddle")
    for uu, w, top in ((-1.14, 0.1, PZ - 0.38), (-0.36, 0.26, PZ - 0.34)):
        f.box(uu, PV, 0.0, w, 0.56, top + 0.04, "steelD", top="steel")
        f.box(uu, PV, 0.0, w + 0.18, 0.74, 0.07, "steelD", top="steelL")
    _g("inlet")
    p = curve((-2.3, PV, 0.06), (0, 0, 1), (-1.9, PV, PZ), (1, 0, 0), k=0.55)
    tube(f, p, 0.15, "gm")
    collar(f, p, 0.95, 0.2, "brass")
    f.vcyl(-2.3, PV, 0.0, 0.24, 0.08, "brass", top="brass", sides=16)
    _g("lox")
    a, b = (-1.41, PV, PZ + 0.4), ring_pt(0.3, 0.71, math.pi / 2)
    p = bezier(a, (a[0], a[1], a[2] + 0.9), (b[0], b[1], b[2] + 0.4), b, 24)
    tube(f, p, 0.15, "gm", sides=16)
    for t in (0.07, 0.9):
        collar(f, p, t, 0.2, "brass", t=0.08)
    _g("fuel")
    ang = math.radians(40)
    b = ring_pt(0.3, 0.71, ang)
    din = (0, -math.cos(ang), -math.sin(ang))
    a = (-0.9, PV, PZ + 0.38)
    p = bezier(a, (a[0], a[1], a[2] + 0.7), tuple(b[i] - din[i] * 0.55 for i in range(3)), b, 20)
    tube(f, p, 0.13, "gm", sides=16)
    for t in (0.08, 0.9):
        collar(f, p, t, 0.18, "brass", t=0.08)
    _g("exhaust")
    ang = math.radians(-40)
    rt = rb(UT) + 0.13
    b = ring_pt(UT, rt, ang)
    din = (0, -math.cos(ang), -math.sin(ang))
    p = curve((0.47, PV, PZ), (1, 0, 0), (UI - 0.1, 1.12, 0.5), (1, 0, 0), k=0.4, n=12)
    p += curve((UI - 0.1, 1.12, 0.5), (1, 0, 0), (UO + 0.2, 1.12, 0.5), (1, 0, 0), n=2)[1:]
    p += curve((UO + 0.2, 1.12, 0.5), (1, 0, 0), b, din, k=0.5, n=12)[1:]
    tube(f, p, 0.12, "gm", sides=16)
    collar(f, p, 0.06, 0.17, "brass")


def exchanger(f):
    """Finned heat exchanger on the far side with a header and two smooth coolant runs: one into the chamber jacket,
    one through the bulkhead to the nozzle jacket."""
    _g("hx")
    f.box(-0.85, -1.3, 0.0, 2.0, 0.9, 0.5, "steel", top="plate")
    D.trim(f, -0.85, -1.3, 0.5, 2.0, 0.9, "steelL")
    D.fins(f, -1.75, 0.05, -1.3, 0.5, 0.78, 0.38, 9, thick=0.09, mat="steelL", top="plate")
    D.seg(f, (0.2, -1.78, 0.4), (0.2, -0.82, 0.4), 0.12, "gm", 16, cap="steelL", capstart="steelL")
    f.box(0.2, -1.3, 0.0, 0.2, 0.7, 0.28, "steelD", top="steel")
    _g("cool")
    ang = math.radians(210)
    b = ring_pt(0.52, 0.6, ang)
    din = (0, -math.cos(ang), -math.sin(ang))
    p = curve((0.2, -1.05, 0.45), (0, 0, 1), b, din, k=0.5)
    tube(f, p, 0.08, "gm")
    collar(f, p, 0.12, 0.12, "brass", t=0.06)
    p = curve((0.3, -1.5, 0.4), (1, 0, 0), (UI, -1.05, 0.75), (1, 0, 0), k=0.45)
    tube(f, p, 0.08, "gm")
    collar(f, p, 0.2, 0.12, "brass", t=0.06)


def cabinet(f, hot):
    """Engine control cabinet at the back: inset panel, status lamp, brass grab bars."""
    _g("cab")
    f.box(-2.05, 0, 0.0, 0.7, 1.2, 0.95, "steel", top="plate")
    D.trim(f, -2.05, 0, 0.95, 0.7, 1.2, "steelL")
    D.panel(f, -2.4, -0.1, 0.55, 0.8, 0.5, "blueGrey", face="-u")
    f.box(-2.43, 0.43, 0.72, 0.06, 0.12, 0.12, "cyan" if hot else "orange", base=False)
    for zz in (0.25, 0.85):
        D.rail(f, (-2.44, -0.4, zz), (-2.44, 0.2, zz), 0.04, "brass")
    f.box(-2.05, 0, 0.95, 0.36, 0.5, 0.12, "steelD", top="steelL")


def machine(f, hot):
    chamber(f)
    turbopump(f)
    exchanger(f)
    cabinet(f, hot)
    bell(f, hot)


def engine(rot, hot, part="machine"):
    """part: hull (bulkhead layer), machine (rest, hull as holdout), cell (both, for the Blender review)."""
    if part == "hull":
        return hull_section(rot)
    m = core.Mesh(f"engine_{rot}_{int(hot)}_{part}")
    f = Frame(m, rot, centre=CENTRE[rot])
    hull = hull_section(rot, holdout=part == "machine")
    machine(f, hot)
    ob = smooth(m.build())
    return hull + [ob]
