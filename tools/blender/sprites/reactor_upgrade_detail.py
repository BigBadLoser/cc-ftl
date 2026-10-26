"""Shared coupling, manifold and controls over the unchanged tandem blockout."""
from . import core_systems_blockout as base
from . import reactor_upgrade as blockout
from .core_systems_detail import tube
from .core_systems_finish import FinishMesh

BODY, FRAME, RECESS = base.BODY, base.FRAME, base.RECESS


def reactor(p=None, rotation=0, finished=False, powered=True):
    p = p or blockout.TandemReactor()
    obs = blockout.reactor(p, rotation, finished, powered)
    m = FinishMesh('reactor_tandem_shared_hardware', finished, powered)
    f = base.make_frame(m, p.footprint, rotation)
    # A real pressure coupling penetrates both vessels, with a central joint.
    m.paint(body='steel')
    f.hcyl(-.36, .36, 0, 1.08, .245, BODY, sides=12, cap=BODY, capstart=BODY)
    m.paint(frame='yellow')
    for u in (-.11, .07):
        f.hcyl(u, u + .04, 0, 1.08, .295, FRAME, sides=12, cap=FRAME, capstart=FRAME)
    # The shoulder yoke spans the two shells, rather than capping each singly.
    # Its front edge remains visible between the crowns at the game camera.
    m.paint(body='shield')
    base.casing(m, f, 0, .55, 1.255, 1.58, .26, .16, cut=.065)
    m.paint(frame='yellow')
    base.casing(m, f, 0, .55, 1.26, .19, .30, .18, cut=.025, col=FRAME)

    for sign in (-1, 1):
        v = sign * .78
        # One continuous header serves both vessels. All ends embed in shells;
        # the middle feed seats in the existing long coolant housing.
        m.paint(body='steel')
        tube(m, f, ((-.99, v, .97), (.99, v, .97)), .07, BODY)
        for u in (-p.core_spacing / 2 - .25, p.core_spacing / 2 + .25):
            tube(m, f, ((u, v, .97), (u, sign * .48, .97)), .065, BODY)
            m.paint(frame='yellow')
            tube(m, f, ((u, sign * .60, .97), (u, sign * .51, .97)), .095, FRAME, sides=12)
        tube(m, f, ((0, v, .715), (0, v, .97)), .085, BODY)
        m.paint(body='shield')
        base.casing(m, f, 0, v, .865, .32, .225, .205, cut=.045)
        m.paint(frame='yellow')
        f.vcyl(0, v, .725, .115, .055, FRAME, sides=12)
        # Two exchanger banks share the same casting, leaving its central
        # service access unobstructed. Broad gaps survive the native scale.
        m.paint()
        for centre in (-.83, .83):
            for du in (-.225, -.075, .075, .225):
                f.box(centre + du, sign * .933, .20, .072, .045, .105, FRAME)

    # A single control cabinet mounted on the central connection, with one
    # broad display and two coarse channel markers, not a console per core.
    m.paint(body='shield')
    base.casing(m, f, 0, .72, .965, .67, .28, .29, cut=.045)
    m.paint(recess='dark')
    f.box(0, .862, 1.025, .52, .018, .17, RECESS)
    m.paint(recess='display')
    f.box(-.07, .875, 1.055, .29, .012, .105, RECESS)
    m.paint(body='amber')
    for z in (1.065, 1.135):
        f.box(.17, .878, z, .07, .015, .035, BODY)
    # Low service hardware repeats the approved small reactor's language.
    m.paint(body='amber')
    for u in (-.18, 0, .18):
        f.box(u, .969, .472, .065, .018, .045, BODY)
    return obs + [m.build()]
