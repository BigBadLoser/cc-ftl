"""Tandem reactor study: the approved 2x2's pressure sections in a shared frame.

Independent variant; never modifies the approved drop-in model or its lock.
Dimensions are tile units, local u is the long axis, v is across the machine.
"""
from dataclasses import asdict, dataclass
import math
from . import core
from .cmbkit import Frame
from . import core_systems_blockout as base
from .core_systems_finish import FinishMesh
from .core_systems_touchups import parameters

BODY, FRAME, RECESS = base.BODY, base.FRAME, base.RECESS


@dataclass(frozen=True)
class TandemReactor:
    footprint: tuple = (2, 3)
    core_spacing: float = 1.48
    casting_length: float = 2.80
    coolant_length: float = 2.70
    crown_radius: float = .73

    def spec(self): return asdict(self)


def offset_frame(f, u, v=0):
    return Frame(f.m, rot=f.rot, centre=f.xy(u, v))


def pressure_section(m, f, p, crown_radius):
    """Keep the small reactor's shell, inspection slots and crown dimensions."""
    m.paint(body='shield')
    base.radial(m, f, ((.49, .12), (.67, .22), (.67, .35),
                      (p.core_radius, .43), (p.core_radius, p.core_shoulder),
                      (.48, 1.43)))
    for z, r, h in ((.36, .64, .09), (1.15, .64, .10)):
        base.radial(m, f, ((r, z), (r, z + h)), col=FRAME)
    m.paint(body='crown')
    base.radial(m, f, ((.61, 1.39), (crown_radius, 1.45),
                      (crown_radius, 1.55), (.58, p.crown_top)))
    base.radial(m, f, ((.43, p.crown_top + .005),
                      (.43, p.crown_top + .035)), col=FRAME)
    m.paint(body='shield')
    base.radial(m, f, ((.28, p.crown_top + .036), (.28, p.crown_top + .045)))
    profile = ((.48, .08), (.77, .08), (p.rib_radius, .22),
               (.86, .48), (.76, .76), (.76, 1.28), (.66, 1.53),
               (.57, 1.53), (.63, 1.24), (.63, .72), (.70, .37), (.48, .30))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        base.rib(m, f, profile, a, p.rib_width, FRAME)
        base.rib(m, f, ((.50, 0), (.76, 0), (.76, .09), (.50, .09)), a, .18, FRAME)
    m.paint(recess='core_light')
    for i in range(4):
        a = i * math.pi / 2
        base.rib(m, f, ((.568, .66), (.59, .66), (.59, 1.055), (.568, 1.055)), a, .15, RECESS)
        for z in (.64, 1.055):
            base.rib(m, f, ((.56, z), (.63, z), (.63, z + .045), (.56, z + .045)), a, .21, FRAME)
    # Keep the crown locks and lifting grip: these are family landmarks.
    m.paint(frame='yellow', body='yellow')
    for i in range(4):
        base.rib(m, f, ((.29, p.crown_top + .014), (.54, p.crown_top + .014),
                        (.54, p.crown_top + .048), (.36, p.crown_top + .048),
                        (.29, p.crown_top + .036)), i * math.pi / 2, .11, FRAME)
    for u in (-.13, .13):
        f.box(u, 0, p.crown_top + .045, .065, .09, .055, FRAME)
    f.box(0, 0, p.crown_top + .096, .325, .09, .045, BODY)


def reactor(p=None, rotation=0, finished=False, powered=True):
    p = p or TandemReactor()
    small = parameters('reactor')
    m = FinishMesh('reactor_tandem_blockout', finished, powered)
    f = base.make_frame(m, p.footprint, rotation)
    for u in (-p.core_spacing / 2, p.core_spacing / 2):
        pressure_section(m, offset_frame(f, u), small, p.crown_radius)
    # One raised pressure casting, rather than a platform under two reactors.
    m.paint(body='shield')
    base.casing(m, f, 0, 0, .17, p.casting_length, 1.24, .26, cut=.20, taper=.96)
    # A shared central tie seats into both pressure shells below the crowns.
    m.paint()
    base.casing(m, f, 0, 0, .48, .55, .72, .79, cut=.08, col=FRAME)
    # Same section as the 2x2 pods, extended continuously across both cores.
    for v in (-.76, .76):
        m.paint(body='shield')
        base.casing(m, f, 0, v, .16, p.coolant_length, .34, .59, cut=.07, taper=.97)
        f.box(0, v, .31, p.coolant_length - .18, .365, .25, FRAME)
        for u in (-p.core_spacing / 2, p.core_spacing / 2):
            f.box(u, v * .79, .69, .52, .31, .17, FRAME)
    # One service face on the common manifold, two simple core indicators.
    m.paint(body='steel')
    f.box(0, .935, .38, .78, .018, .25, RECESS)
    f.box(0, .949, .425, .65, .014, .15, BODY)
    m.paint(recess='display')
    base.casing(m, f, 0, .603, 1.03, .38, .11, .16, cut=.025, col=FRAME)
    for u in (-.09, .09):
        f.box(u, .662, 1.07, .10, .016, .07, RECESS)
    return [m.build()]
