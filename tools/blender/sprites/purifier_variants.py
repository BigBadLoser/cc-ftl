"""Three look variants of the water purifier for review (not a family yet): the life support's kit and palette, each with
its own silhouette and key feature. `variant(name, state, rot, frame)`, name in VARIANTS.

  column   a low housing (melt and filters) at the access end and a tall glass water column at the other: the water
           level shows from every side, steel hoops round the glass
  stacks   the full-length housing with two tall filter stacks rising through the hood, a pipe bridge over them, and a
           long sight band along the front showing the water across the machine
  funnel   a big chamfered ice funnel standing over the access end, stepping down to a low tank section with a glass dome
           on top, the water seen from above"""
from . import core
from .core_systems_blockout import BODY, FRAME, RECESS, PALETTE, bridge, casing, chamfer_loop, make_frame
from .core_systems_finish import FinishMesh, PALETTE as FINISH
from .purifier import LENGTH, WIDTH

VARIANTS = ("column", "stacks", "funnel")


def _start(name, state, rot, frame):
    core.palette._data.update(PALETTE)
    core.palette._data.update(FINISH)
    on, lit = state != "unpowered", state == "active"
    m = FinishMesh(f"purifier_{name}_{state}_{frame}_{rot}", finished=True, powered=on)
    return m, make_frame(m, (1, 2), (rot + 1) % 4), on, lit


def _ice(m, f, u, v, z, su, sv, rim=0.12, wall=0.08):
    """An ice well like the life support's inlet coamings: a cyan coaming with a real top face `wall` thick, dark inner
    walls down to a bed of ice, chunks heaped on it."""
    m.paint(body='vent_teal', frame='frame')
    top = z + rim
    casing(m, f, u, v, z, su, sv, rim, cut=0.08, closed=False, bottom=False)
    outer = chamfer_loop(f, u, v, top, su, sv, 0.08)
    inner = chamfer_loop(f, u, v, top, su - 2 * wall, sv - 2 * wall, 0.05)
    bed = top - 0.07
    floor = chamfer_loop(f, u, v, bed, su - 2 * wall, sv - 2 * wall, 0.05)
    bridge(m, outer, inner, BODY)                                                            # the rim's top face
    bridge(m, inner, floor, FRAME)                                                           # inner walls
    m.poly(floor, "iceB", flip=True)
    for du, dv, sz in ((-0.1, -0.06, 0.12), (0.06, 0.05, 0.13), (0.09, -0.09, 0.12), (-0.06, 0.09, 0.12)):
        f.box(u + du * su / 0.5, v + dv * sv / 0.5, bed, sz, sz, 0.06, "iceB", top="medWhite")
    m.paint()


def _snap(m):
    """Every vertex on the pixel grid (floor: 1/16 tile = 2 px across, 1 px down; height: whole px), so edges draw clean."""
    g, h = 1 / 16, 1 / core.ZPX
    m.v = [(round(x / g) * g, round(y / g) * g, round(z / h) * h) for x, y, z in m.v]


def _display(m, f, u, lit, on, z=0.5, v=0.38):
    """A recessed display and a lamp on a dark plate, sitting just proud of the face at `v`."""
    m.paint(body='steel', recess='display' if lit else 'amber' if on else 'dark')
    f.box(u, v + 0.006, z, 0.34, 0.012, 0.24, FRAME)
    f.box(u - 0.04, v + 0.016, z + 0.05, 0.19, 0.012, 0.14, RECESS)
    f.box(u + 0.11, v + 0.016, z + 0.12, 0.05, 0.012, 0.05, RECESS)
    m.paint()


def _water(lit):
    return 'core_light' if lit else 'vent_teal'


G = 1 / 16          # the snap grid on the floor (1/16 tile = 2 px across, 1 px down)


def column(state, rot, frame=0):
    """Shells are laid out in whole grid steps and snapped (`_snap`), nested faces at least one step apart; the small
    decals after `mark` stay unsnapped, just proud of the snapped faces they sit on."""
    m, f, on, lit = _start("column", state, rot, frame)
    u, v, r = 0.5, 0.0, 5 * G                 # the column (its rings stay inside the footprint's end, u 0.875)
    FRONT = 7 * G                             # the pale panels' front face
    # Dark machinery is the body (as in the life support): a base and a core, pale panels hang over them, a hood caps it.
    casing(m, f, -6 * G, 0, 0.0, 16 * G, 12 * G, 0.3, cut=G, col=FRAME)                   # base under the housing
    f.vcyl(u, v, 0.0, r + G, 0.38, FRAME, sides=16)                                        # drum under the column
    f.box(3 * G, 0, 0.0, 4 * G, 8 * G, 0.3, FRAME)                                         # pump block between
    casing(m, f, -6 * G, -2 * G, 0.28, 14 * G, 8 * G, 0.58, cut=G, col=FRAME)              # core under the hood
    m.paint(body='pale')
    casing(m, f, -10 * G, 2.5 * G, 0.12, 8 * G, 9 * G, 0.74, cut=G)                       # melt panel (front 7G)
    casing(m, f, -2 * G, 3.5 * G, 0.16, 6 * G, 7 * G, 0.7, cut=G)                         # filter bay (front 7G)
    casing(m, f, -5 * G, 0, 0.86, 18 * G, 14 * G, 0.14, cut=2 * G, taper=0.96)            # hood
    f.vcyl(u, v, 0.86, r + 2 * G, 0.14, BODY, sides=16)                                    # collar round the column
    f.box(3 * G, v, 0.86, 4 * G, 10 * G, 0.14, BODY)                                       # its web into the hood
    m.paint(body='steel')
    f.box(3 * G, 4.5 * G, 0.06, 2 * G, G, 0.14, BODY)                                      # service port on the pump
    _ice(m, f, -9 * G, -G, 1.0, 8 * G, 9 * G, wall=1.5 * G)
    # The column: water, glass, a hoop, the cap ring and dome, a vent pipe back to the hood.
    m.paint(body='cartridge', frame='frame', recess=_water(lit))
    f.vcyl(u, v, 0.38, r, 0.48, RECESS, sides=16)                                          # the water
    f.vcyl(u, v, 1.0, r, 0.32, BODY, sides=16)                                             # the glass above it
    f.vcyl(u, v, 0.62, r + G, 0.04, FRAME, sides=16)                                       # hoop
    f.vcyl(u, v, 1.32, r + G, 0.08, FRAME, sides=16)                                       # cap ring
    m.paint(body='pale')
    f.vcyl(u, v, 1.4, r, 0.08, BODY, rtop=2.5 * G, sides=16)                               # domed cap
    m.paint(body='vent_teal')
    f.vcyl(u, v, 1.48, 1.5 * G, 0.05, BODY, sides=10)                                      # its fill hatch
    m.paint(body='steel')
    f.box(0, -4 * G, 1.0, G, G, 0.3, BODY)                                                 # vent pipe up from the hood
    f.box(2 * G, -4 * G, 1.26, 5 * G, G, 0.06, BODY)                                       # and over into the cap
    mark = len(m.v)
    _snap(m)
    # Decals, unsnapped, 0.012 proud of the snapped front (FRONT): the display, the filter cartridges.
    _display(m, f, -10 * G, lit, on, z=0.44, v=FRONT)
    for du in (-3.5 * G, -0.5 * G):
        m.paint(recess='dark')
        f.box(du, FRONT + 0.006, 0.34, 0.15, 0.012, 0.44, RECESS)
        m.paint(body='cartridge')
        f.box(du, FRONT + 0.016, 0.38, 0.11, 0.012, 0.36, BODY)
        m.paint(frame='teal')
        f.box(du, FRONT + 0.016, 0.74, 0.13, 0.012, 0.05, FRAME)
    if lit:
        for du, z0 in ((-0.1, 0.0), (0.06, 0.2), (0.0, 0.36), (0.12, 0.1)):
            f.box(u + du, v + r + 0.02, 0.4 + (z0 + 0.12 * frame) % 0.44, 0.05, 0.02, 0.04, "medWhite")
    assert mark <= len(m.v)
    return [m.build()]


def stacks(state, rot, frame=0):
    m, f, on, lit = _start("stacks", state, rot, frame)
    casing(m, f, 0, -0.005, 0.0, LENGTH - 0.06, WIDTH - 0.04, 0.22, cut=0.09, col=FRAME)
    m.paint(body='pale')
    casing(m, f, 0, -0.02, 0.22, LENGTH - 0.12, WIDTH - 0.12, 0.66, cut=0.06)
    casing(m, f, 0, 0, 0.88, LENGTH, WIDTH, 0.14, cut=0.13, taper=0.96)
    _ice(m, f, -0.58, -0.02, 1.02, 0.5, 0.56)
    _display(m, f, -0.58, lit, on, z=0.56)
    # Two filter stacks rising through the hood, banded, joined by a pipe bridge.
    for u in (0.12, 0.52):
        m.paint(body='pale', frame='frame')
        f.vcyl(u, -0.1, 1.0, 0.17, 0.06, FRAME, sides=12)
        f.vcyl(u, -0.1, 1.06, 0.15, 0.5, BODY, sides=12)
        m.paint(body='teal')
        for z in (1.16, 1.4):
            f.vcyl(u, -0.1, z, 0.16, 0.05, BODY, sides=12)
        m.paint(body='frame')
        f.vcyl(u, -0.1, 1.56, 0.16, 0.06, BODY, rtop=0.1, sides=12)
    m.paint(body='steel')
    f.box(0.32, -0.1, 1.58, 0.42, 0.08, 0.08, BODY)                                           # bridge
    # The long sight band on the front: water across the machine.
    m.paint(body='cartridge', frame='frame', recess=_water(lit))
    f.box(0.32, 0.38, 0.3, 0.98, 0.02, 0.3, FRAME)
    f.box(0.32, 0.392, 0.34, 0.9, 0.012, 0.22, BODY)
    f.box(0.32, 0.398, 0.34, 0.9, 0.012, 0.13, RECESS)
    if lit:
        for i in range(4):
            f.box(-0.08 + i * 0.25 + 0.06 * frame, 0.41, 0.36 + (i % 2) * 0.05, 0.04, 0.012, 0.03, "medWhite")
    return [m.build()]


def funnel(state, rot, frame=0):
    m, f, on, lit = _start("funnel", state, rot, frame)
    casing(m, f, 0, -0.005, 0.0, LENGTH - 0.06, WIDTH - 0.04, 0.22, cut=0.09, col=FRAME)
    m.paint(body='pale')
    casing(m, f, 0, -0.02, 0.22, LENGTH - 0.12, WIDTH - 0.12, 0.46, cut=0.06)                # low body, full length
    casing(m, f, 0, 0, 0.68, LENGTH, WIDTH, 0.12, cut=0.12, taper=0.96)                     # its hood
    _display(m, f, 0.05, lit, on, z=0.32)
    # The funnel over the access end: a neck, then a wide chamfered hopper, ice inside.
    u = -0.5
    m.paint(body='steel')
    casing(m, f, u, -0.03, 0.8, 0.36, 0.36, 0.16, cut=0.05, col=FRAME)
    m.paint(body='pale')
    casing(m, f, u, -0.03, 0.96, 0.42, 0.42, 0.46, cut=0.06, taper=1.65)
    _ice(m, f, u, -0.03, 1.42, 0.72, 0.72, rim=0.08)
    m.paint(frame='teal')
    f.box(u, 0.33, 1.1, 0.3, 0.03, 0.06, FRAME)                                              # band on its face
    # The tank section: a glass dome on the hood, the water seen from above.
    tu = 0.5
    m.paint(body='steel', frame='frame', recess=_water(lit))
    f.vcyl(tu, -0.02, 0.8, 0.36, 0.06, FRAME, sides=16)
    f.vcyl(tu, -0.02, 0.86, 0.33, 0.1, RECESS, rtop=0.3, sides=16)                           # the water's surface
    m.paint(body='cartridge')
    f.vcyl(tu, -0.02, 0.96, 0.3, 0.14, BODY, rtop=0.15, sides=16)                            # glass dome
    if lit:
        for du, dv in ((-0.12, 0.05), (0.1, -0.08), (0.02, 0.15)):
            f.box(tu + du, -0.02 + dv, 0.96 + 0.02 * frame, 0.05, 0.05, 0.03, "medWhite")
    m.paint(body='steel')
    f.box(LENGTH / 2 - 0.02, 0.05, 0.3, 0.08, 0.24, 0.22, FRAME)                             # outlet port
    f.box(LENGTH / 2 + 0.01, 0.05, 0.34, 0.04, 0.14, 0.14, BODY)
    return [m.build()]


def variant(name, state, rot, frame=0):
    return {"column": column, "stacks": stacks, "funnel": funnel}[name](state, rot, frame)


def jobs():
    """r0, idle and active, of every variant: ids module.purifier_<variant>.r0[.active]."""
    out = []
    for n in VARIANTS:
        for st, sfx in (("idle", ""), ("active", ".active")):
            out.append((f"module.purifier_{n}.r0{sfx}", (2, 1), "prop", lambda n=n, st=st: variant(n, st, 0, 1)))
    return out
