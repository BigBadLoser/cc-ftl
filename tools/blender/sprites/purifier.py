"""Water purifier (family `purifier`): 2x1 at r0 (1x2 turned), idle, `.unpowered` and `.active` (`.active.f1` .. `.f3`:
bubbles rise in the sight glass), four rotations.

One machine in the life support's family (core_systems_blockout.life_support): the same kit (`casing`, chamfered
loops, the finish roles of core_systems_finish) and the same palette (the base palette, as the core systems are
quantised). A dark manifold plinth under one pale chamfered housing with a hood over the whole length. Along it, from
the access end: the ice inlet (a cyan coaming on the hood, ice heaped in its well) over the melt section with its
display, two filter cassettes proud on the front, and the water section: a tall framed sight glass showing the water
level and a domed tank cap rising through the hood, an outlet port on the end. `.active`: the water glows and the
display reads; idle: the water is lit only by the room; `.unpowered`: display dark.

Local frame (the life support's): u along the length (-u = the access end), v across (+v = front), z up."""
from . import core
from .core_systems_blockout import BODY, FRAME, RECESS, PALETTE, casing, chamfer_loop, bridge, make_frame
from .core_systems_finish import FinishMesh, PALETTE as FINISH

LENGTH, WIDTH = 1.82, 0.88
HOOD = 1.0          # hood bottom
TOP = 1.16          # hood top
MELT, FILT, TANK = -0.5, 0.0, 0.5   # section centres along u


def _inlet(m, f):
    """The ice inlet on the hood over the melt section: a cyan coaming, its inner walls dark, ice in the well."""
    u, v, top = MELT, -0.03, TOP + 0.1
    m.paint(body='vent_teal', frame='frame')
    casing(m, f, u, v, TOP - 0.01, 0.62, 0.6, top - TOP + 0.01, cut=0.08, taper=0.94, closed=False, bottom=False)
    outer = chamfer_loop(f, u, v, top, 0.62 * 0.94, 0.6 * 0.94, 0.08)
    inner = chamfer_loop(f, u, v, top, 0.46, 0.44, 0.03)
    floor = chamfer_loop(f, u, v, top - 0.06, 0.46, 0.44, 0.03)
    bridge(m, outer, inner, BODY)
    bridge(m, inner, floor, FRAME)
    m.poly(floor, "iceB", flip=True)
    for du, dv, s in ((-0.12, -0.08, 0.12), (0.06, 0.06, 0.14), (0.1, -0.1, 0.1), (-0.08, 0.1, 0.1)):
        f.box(u + du, v + dv, top - 0.06, s, s, 0.08, "iceB", top="medWhite")   # chunks above the well's floor
    m.paint()


def purifier(state, rot, frame=0):
    on, lit = state != "unpowered", state == "active"
    core.palette._data.update(PALETTE)
    core.palette._data.update(FINISH)
    m = FinishMesh(f"purifier_{state}_{frame}_{rot}", finished=True, powered=on)
    f = make_frame(m, (1, 2), (rot + 1) % 4)
    # Manifold plinth and the one housing over the whole length.
    casing(m, f, 0, -0.005, 0.0, LENGTH - 0.06, WIDTH - 0.04, 0.22, cut=0.09, col=FRAME)
    m.paint(body='pale')
    casing(m, f, 0, -0.02, 0.22, LENGTH - 0.12, WIDTH - 0.12, HOOD - 0.22, cut=0.06)
    casing(m, f, 0, 0, HOOD, LENGTH, WIDTH, TOP - HOOD, cut=0.13, taper=0.96)              # hood
    # Melt section: display and a status lamp in a recessed panel.
    m.paint(body='steel', recess='display' if lit else 'amber' if on else 'dark')
    f.box(MELT, 0.38, 0.5, 0.36, 0.02, 0.26, FRAME)
    f.box(MELT - 0.04, 0.392, 0.55, 0.2, 0.012, 0.16, RECESS)
    f.box(MELT + 0.12, 0.392, 0.62, 0.05, 0.012, 0.05, RECESS)
    # Two filter cassettes, proud of the front like the life support's scrubbers.
    for du in (-0.13, 0.13):
        m.paint(body='pale')
        casing(m, f, FILT + du, 0.34, 0.28, 0.22, 0.14, 0.62, cut=0.035)
        m.paint(body='cartridge')
        f.box(FILT + du, 0.41, 0.36, 0.13, 0.012, 0.46, BODY)
        m.paint(frame='teal')
        f.box(FILT + du, 0.408, 0.84, 0.12, 0.024, 0.05, FRAME)
    # Water section: a framed sight glass on the front, the water level in it.
    water = 'core_light' if lit else 'vent_teal'
    m.paint(body='screen', frame='frame', recess=water)
    f.box(TANK, 0.38, 0.26, 0.42, 0.02, 0.66, FRAME)                                       # glass frame
    f.box(TANK, 0.39, 0.3, 0.32, 0.012, 0.58, BODY)                                          # the empty glass above
    f.box(TANK, 0.4, 0.3, 0.32, 0.012, 0.36, RECESS)                                       # the water
    if lit:
        for i, (du, z0) in enumerate(((-0.08, 0.0), (0.05, 0.12), (-0.02, 0.22), (0.1, 0.06))):
            z = 0.32 + (z0 + 0.08 * frame) % 0.3
            f.box(TANK + du, 0.41, z, 0.04, 0.012, 0.035, "medWhite")                       # bubbles rising
    m.paint(frame='teal')
    for z in (0.47, 0.66):
        f.box(TANK + 0.14, 0.41, z, 0.04, 0.012, 0.012, FRAME)                # level ticks
    # Tank cap rising through the hood, and the outlet port on the end.
    m.paint(body='vent_teal', frame='frame')
    f.vcyl(TANK + 0.05, -0.08, TOP - 0.01, 0.27, 0.07, FRAME, sides=12)
    f.vcyl(TANK + 0.05, -0.08, TOP + 0.06, 0.24, 0.05, BODY, rtop=0.16, sides=12)
    m.paint(body='steel')
    f.box(LENGTH / 2 - 0.02, 0.05, 0.34, 0.08, 0.24, 0.24, FRAME)                            # port collar
    f.box(LENGTH / 2 + 0.01, 0.05, 0.38, 0.04, 0.14, 0.16, BODY)
    _inlet(m, f)
    return [m.build()]


def jobs(rots=range(4)):
    """Every rotation: idle (powered), .unpowered, .active and .active.f1..f3; the plain id is r0 idle."""
    out = []
    for r in rots:
        fp = (2, 1) if r % 2 == 0 else (1, 2)
        base = f"module.purifier.r{r}"
        for state, f, aid in [("idle", 0, base), ("unpowered", 0, base + ".unpowered")] + \
                [("active", f, base + ".active" + (f".f{f}" if f else "")) for f in range(4)]:
            out.append((aid, fp, "prop", lambda r=r, s=state, f=f: purifier(s, r, f)))
        if r == 0:
            out.append(("module.purifier", fp, "prop", lambda: purifier("idle", 0)))
    return out
