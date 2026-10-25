"""Drop-in reactor and atmosphere plant: primary geometry, no finish or floor.

All dimensions are tile units. Models use the standard front-most tile origin.
No old reactor study geometry is imported. Cavities have physical recessed backs.
"""
from dataclasses import asdict, dataclass
import math
from . import core
from .cmbkit import Frame
from .core_systems_finish import FinishMesh

BODY = 'systems.blockout.body'
FRAME = 'systems.blockout.frame'
RECESS = 'systems.blockout.recess'
PALETTE = {BODY: {'hex': '#9ba2a7'}, FRAME: {'hex': '#69747c'},
           RECESS: {'hex': '#303941'}}


@dataclass(frozen=True)
class Reactor:
    footprint: tuple = (2, 2)
    core_radius: float = .57
    core_bottom: float = .25
    core_shoulder: float = 1.26
    crown_top: float = 1.64
    rib_radius: float = .91
    rib_width: float = .16
    service_width: float = .65

    def spec(self): return asdict(self)


@dataclass(frozen=True)
class LifeSupport:
    footprint: tuple = (1, 2)
    length: float = 1.82
    width: float = .88
    top: float = 1.48
    cartridge_spacing: float = .80
    cartridge_width: float = .65
    cartridge_bottom: float = .27
    cartridge_top: float = 1.09

    def spec(self): return asdict(self)


def bridge(m, a, b, col):
    for i in range(len(a)):
        j = (i + 1) % len(a)
        m.poly([a[i], a[j], b[j], b[i]], col, flip=True)


def radial(m, f, profile, sides=12, col=BODY):
    """Closed lathed shell, using a (radius,height) section."""
    loops = [[f.pt(r * math.cos(a), r * math.sin(a), z)
              for a in ((i + .5) * math.tau / sides for i in range(sides))]
             for r, z in profile]
    m.poly(loops[0][::-1], col, flip=True)
    for a, b in zip(loops, loops[1:]): bridge(m, a, b, col)
    m.poly(loops[-1], col, flip=True)


def rib(m, f, profile, angle, width, col):
    loops = [[f.pt(r * math.cos(angle) - t * math.sin(angle),
                   r * math.sin(angle) + t * math.cos(angle), z)
              for r, z in profile] for t in (-width / 2, width / 2)]
    m.poly(loops[0], col, flip=True)
    bridge(m, loops[1], loops[0], col)
    m.poly(loops[1][::-1], col, flip=True)


def chamfer_loop(f, u, v, z, length, width, cut):
    a, b = length / 2, width / 2
    return [f.pt(u + du, v + dv, z) for du, dv in
            ((-a + cut, -b), (a - cut, -b), (a, -b + cut), (a, b - cut),
             (a - cut, b), (-a + cut, b), (-a, b - cut), (-a, -b + cut))]


def casing(m, f, u, v, z, length, width, height, cut=.06, taper=1, col=BODY, closed=True):
    a = chamfer_loop(f, u, v, z, length, width, cut)
    b = chamfer_loop(f, u, v, z + height, length * taper, width * taper, cut)
    m.poly(a[::-1], col, flip=True)
    bridge(m, a, b, col)
    if closed: m.poly(b, col, flip=True)


def make_frame(m, footprint, rotation):
    w, h = footprint if rotation % 2 == 0 else footprint[::-1]
    return Frame(m, rot=rotation, centre=(-(w - 1) / 2, -(h - 1) / 2))


def reactor(p=None, rotation=0, finished=False, powered=True):
    p = p or Reactor()
    m = FinishMesh('reactor_dropin_blockout', finished, powered)
    f = make_frame(m, p.footprint, rotation)
    # A shielded core with a broad crown, separate from the external load frame.
    m.paint(body='shield')
    radial(m, f, ((.49, .12), (.67, .22), (.67, .35),
                  (p.core_radius, .43), (p.core_radius, p.core_shoulder),
                  (.48, 1.43)), col=BODY)
    for z, r, h in ((.36, .64, .09), (1.15, .64, .10)):
        radial(m, f, ((r, z), (r, z + h)), col=FRAME)
    # Closed inspection crown. No giant exposed glowing column.
    m.paint(body='crown')
    radial(m, f, ((.61, 1.39), (.73, 1.45), (.73, 1.55),
                  (.58, p.crown_top)), col=BODY)
    radial(m, f, ((.43, p.crown_top + .005), (.43, p.crown_top + .035)), col=FRAME)
    m.paint(body='shield')
    radial(m, f, ((.28, p.crown_top + .036), (.28, p.crown_top + .045)), col=BODY)
    profile = ((.48, .08), (.77, .08), (p.rib_radius, .22),
               (.86, .48), (.76, .76), (.76, 1.28), (.66, 1.53),
               (.57, 1.53), (.63, 1.24), (.63, .72), (.70, .37), (.48, .30))
    for i in range(4):
        rib(m, f, profile, math.pi / 4 + i * math.pi / 2, p.rib_width, FRAME)
    # Two coolant pods bear directly on the lower frame; upper necks enter core.
    for v in (-.76, .76):
        m.paint(body='shield')
        casing(m, f, 0, v, .16, 1.01, .34, .59, cut=.07, taper=.93)
        f.box(0, v, .31, .79, .365, .25, FRAME)
        f.box(0, v * .79, .69, .52, .31, .17, FRAME)
    # Recessed service panel on the crew-facing pod, no external console tile.
    m.paint(body='steel')
    f.box(-.10, .935, .38, p.service_width, .018, .25, RECESS)
    f.box(-.10, .949, .425, p.service_width - .13, .014, .15, BODY)
    # Four protected inspection slots between ribs: actual framed recesses.
    m.paint(recess='core_light')
    for i in range(4):
        a = i * math.pi / 2
        rib(m, f, ((.568, .66), (.59, .66), (.59, 1.055), (.568, 1.055)),
            a, .15, RECESS)
        for z in (.64, 1.055):
            rib(m, f, ((.56, z), (.63, z), (.63, z + .045), (.56, z + .045)),
                a, .21, FRAME)
    return [m.build()]


def life_support(p=None, rotation=0, finished=False, powered=True):
    p = p or LifeSupport()
    m = FinishMesh('life_support_dropin_blockout', finished, powered)
    f = make_frame(m, p.footprint, rotation)
    # Shared lower pump/manifold and upper air handler tie all parts together.
    casing(m, f, 0, -.005, .09, p.length - .06, p.width - .04, .25, cut=.09, col=FRAME)
    casing(m, f, 0, -.105, .30, p.length - .12, .53, .85, cut=.06, col=FRAME)
    # Pressure reservoirs are visible at the ends/back; not two loose tanks.
    for u in (-p.cartridge_spacing / 2, p.cartridge_spacing / 2):
        m.paint(body='steel')
        f.vcyl(u, -.13, .30, .265, .70, BODY, sides=12)
        f.vcyl(u, -.13, .99, .265, .14, BODY, rtop=.17, sides=12)
        # Proud, removable scrubber cassette with a proper recessed face.
        m.paint(body='pale')
        casing(m, f, u, .245, p.cartridge_bottom, p.cartridge_width, .35,
               p.cartridge_top - p.cartridge_bottom, cut=.045)
        f.box(u, .424, .41, p.cartridge_width - .14, .016, .48, RECESS)
        m.paint(body='cartridge')
        f.box(u, .436, .445, p.cartridge_width - .21, .012, .40, BODY)
        # Broad top latch: geometric readability now; small hardware comes later.
        m.paint(frame='teal')
        f.box(u, .424, .945, .23, .028, .065, FRAME)
    # Chamfered hood overhangs and connects the whole cartridge bank.
    m.paint(body='pale')
    casing(m, f, 0, 0, 1.11, p.length, p.width, .25, cut=.13, taper=.96)
    # Raised inlet coamings have open tops, actual inner walls and recessed floors.
    for u in (-.41, .41):
        m.paint(body='teal')
        casing(m, f, u, -.025, 1.36, .72, .65, p.top - 1.36,
               cut=.08, taper=.94, closed=False)
        outer = chamfer_loop(f, u, -.025, p.top, .72 * .94, .65 * .94, .08)
        inner = chamfer_loop(f, u, -.025, p.top, .55, .44, .025)
        bottom = chamfer_loop(f, u, -.025, 1.37, .55, .44, .025)
        bridge(m, outer, inner, BODY)
        m.paint()
        bridge(m, inner, bottom, FRAME)
        m.poly(bottom, RECESS, flip=True)
        for du in (-.18, 0, .18):
            f.box(u + du, -.025, p.top - .06, .055, .44, .08, FRAME)
    # Common front air outlet and low service manifold cover.
    m.paint()
    f.box(0, .432, 1.18, 1.40, .012, .105, RECESS)
    for u in (-.5, -.25, 0, .25, .5):
        f.box(u, .441, 1.18, .035, .025, .105, FRAME)
    casing(m, f, -.67, .25, .25, .30, .34, .25, cut=.025, col=FRAME)
    f.box(-.67, .425, .33, .23, .012, .12, RECESS)
    return [m.build()]
