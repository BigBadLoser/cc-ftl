"""Mechanical pass layered over the approved drop-in blockouts.

The approved mesh is returned intact. New components occupy separate objects;
all plumbing endpoints penetrate the casing or a purpose-built flange.
"""
import math
from mathutils import Vector
from . import core
from . import core_systems_blockout as base

BODY, FRAME, RECESS = base.BODY, base.FRAME, base.RECESS


def tube(m, f, points, radius, col, sides=8):
    """Closed pipe swept through a bevelled centreline, in local coordinates."""
    points = [Vector(p) for p in points]
    loops = []
    for i, p in enumerate(points):
        prev, nxt = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        tangent = (nxt - prev).normalized()
        ref = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
        a = tangent.cross(ref).normalized()
        b = tangent.cross(a).normalized()
        loops.append([f.pt(*(p + radius * (a * math.cos(t) + b * math.sin(t))))
                      for t in (j * math.tau / sides for j in range(sides))])
    m.poly(loops[0][::-1], col, flip=True)
    for a, b in zip(loops, loops[1:]): base.bridge(m, a, b, col)
    m.poly(loops[-1], col, flip=True)


def reactor(p=None, rotation=0):
    p = p or base.Reactor()
    obs = base.reactor(p, rotation)
    m = core.Mesh('reactor_service_hardware')
    f = base.make_frame(m, p.footprint, rotation)
    # Individual isolator feet ground the frame; there is no continuous slab.
    for i in range(4):
        base.rib(m, f, ((.50, 0), (.76, 0), (.76, .09), (.50, .09)),
                 math.pi / 4 + i * math.pi / 2, .18, FRAME)
    # Pressure-cover locking dogs bridge the recessed hub to the crown casting.
    for i in range(4):
        base.rib(m, f, ((.29, p.crown_top + .014), (.54, p.crown_top + .014),
                        (.54, p.crown_top + .048), (.36, p.crown_top + .048),
                        (.29, p.crown_top + .036)),
                 i * math.pi / 2, .11, FRAME)
    # Short coolant returns seat on each pod and enter the pressure body.
    # Top of pod .75, body surface at u=.25 is v~.51: both ends overlap.
    for sign in (-1, 1):
        v = sign * .76
        f.vcyl(.25, v, .725, .10, .07, FRAME, sides=12)
        tube(m, f, ((.25, v, .75), (.25, v, .91),
                    (.25, sign * .71, .97), (.25, sign * .48, .97)),
             .060, BODY)
        tube(m, f, ((.25, sign * .59, .97), (.25, sign * .51, .97)),
             .091, FRAME, sides=12)
        # Broad heat-exchanger fins below the service face, not over the panel.
        for u in (-.30, -.10, .10, .30):
            f.box(u, sign * .919, .20, .065, .055, .105, FRAME)
    # Raised socket and face on the existing low service panel.
    f.box(-.10, .960, .448, .36, .025, .095, RECESS)
    for u in (-.22, -.10, .02):
        f.box(u, .976, .472, .05, .012, .045, BODY)
    # Crew-readable sensor block directly fixed to the upper shield band.
    base.casing(m, f, 0, .603, 1.185, .31, .11, .16, cut=.025, col=FRAME)
    f.box(0, .662, 1.225, .23, .016, .07, RECESS)
    # One lifting bridge: a real clearance under the grip, not a solid block.
    for u in (-.13, .13):
        f.box(u, 0, p.crown_top + .045, .065, .09, .055, FRAME)
    f.box(0, 0, p.crown_top + .096, .325, .09, .045, BODY)
    return obs + [m.build()]


def life_support(p=None, rotation=0):
    p = p or base.LifeSupport()
    obs = base.life_support(p, rotation)
    m = core.Mesh('life_support_service_hardware')
    f = base.make_frame(m, p.footprint, rotation)
    for u in (-.67, .67):
        for v in (-.26, .26):
            f.box(u, v, 0, .24, .17, .105, FRAME)
    for u in (-p.cartridge_spacing / 2, p.cartridge_spacing / 2):
        # Pulls stand off the cassette face but stay inside the one-tile width.
        for du in (-.085, .085):
            f.box(u + du, .463, .655, .045, .04, .06, FRAME)
        f.box(u, .482, .668, .22, .024, .045, BODY)
        # Hinged hold-down latch on the existing upper latch seat.
        f.box(u, .448, .966, .15, .027, .028, BODY)
        # Two short lower guide cleats carried by the shared base casting.
        for du in (-.23, .23):
            f.box(u + du, .442, .30, .07, .035, .10, BODY)
    # A connection neck overlaps the end casing. The blanking plate closes it.
    f.hcyl(.77, .90, -.105, .78, .14, FRAME, sides=12, cap=FRAME, capstart=FRAME)
    f.hcyl(.88, .94, -.105, .78, .19, BODY, sides=12, cap=BODY, capstart=BODY)
    f.hcyl(.94, .955, -.105, .78, .135, RECESS, sides=12, cap=RECESS)
    # Pressure equalisation manifold behind the reservoirs; all joins overlap.
    tube(m, f, ((-.54, -.415, .84), (.54, -.415, .84)), .045, BODY)
    for u in (-p.cartridge_spacing / 2, p.cartridge_spacing / 2):
        tube(m, f, ((u, -.35, .68), (u, -.415, .735), (u, -.415, .84)), .045, BODY)
        tube(m, f, ((u, -.36, .68), (u, -.40, .715)), .07, FRAME)
    # Gauge/control housing fits the protected divider between the cartridges.
    f.box(0, .427, .77, .13, .04, .23, FRAME)
    f.box(0, .452, .845, .085, .018, .11, RECESS)
    # Segmented bolted side plate, with one lifting handle on the casing end.
    f.box(-.845, -.105, .49, .025, .36, .41, BODY)
    for v in (-.20, -.01):
        f.box(-.87, v, .66, .05, .045, .055, FRAME)
    f.box(-.901, -.105, .67, .025, .24, .04, BODY)
    return obs + [m.build()]
