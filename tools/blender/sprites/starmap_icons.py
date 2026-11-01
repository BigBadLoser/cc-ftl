"""Structure icons for the starmap (family `starmap`): starmap.struct.<kind>, replacing the letter badges beside the nodes.

Shown at 24 px at 1x on the map, rendered at ZOOM (2) times the pixels:
a 48 px frame the map draws at half, so it holds detail when zoomed in. Anchor at the centre, lit
by the scene sun like the ships, outlined. The models are laid out in the px of the 24 px icon. Each reads by silhouette
alone at 16-20 screen px:

  station_trade      a wheel: a ring on spokes round a hub with a docking mast
  station_military   a star fort: four armoured prongs with guns round a tall command tower
  station_research   a needle: a tall spire with a big dish on top, a habitat ring and a lab module at its foot
  den                a pirate den: a hollowed rock with scrap modules bolted on and spikes
  asteroids          three loose rocks
  derelict           a slim hull broken in two, the stern tumbling away, ribs at the break, a dim red light

Livery is in the crew key colours (team.cloth panels, team.accent trim) on the stations and the den, so the map tints them
by owner. Asteroids and derelicts own nothing, so they carry no key colour. Sizes are 1x px of the 24 px layout."""
import math

from mathutils import Vector

from . import core
from .starmap_kit import frame_item, ground, place, prism, px, rock, screen_heading, start, turn

SIZE = 48                       # frame, 1x px
ZOOM = 2                        # render scale of the 24 px layout
KINDS = ("station_trade", "station_military", "station_research", "den", "asteroids", "derelict")


def box(m, c, sx, sy, z0, z1, side, top=None, heading=0.0, inset=0.0):
    """A ground box centred at c = (x, y), sx along the heading and sy across, from z0 to z1."""
    pts = turn([(sx / 2, sy / 2), (-sx / 2, sy / 2), (-sx / 2, -sy / 2), (sx / 2, -sy / 2)], heading, c)
    prism(m, pts, z0, z1, side, top, inset)


def cylinder(m, c, r, z0, z1, side, top=None, sides=16, inset=0.0):
    prism(m, [(c[0] + r * math.cos(k * math.tau / sides), c[1] + r * math.sin(k * math.tau / sides)) for k in range(sides)],
          z0, z1, side, top, inset)


def trade():
    m = core.Mesh("trade")
    ring_r, segs = px(9), 32
    for k in range(segs):                                   # the wheel: segments of a ring in the ground plane
        a = k * math.tau / segs
        c = (ring_r * math.cos(a), ring_r * math.sin(a))
        box(m, c, px(2.6), ring_r * math.tau / segs * 1.04, px(-1.2), px(1.2), "steelL", "team.cloth" if k // 2 % 2 else "plate",
            heading=a)
        if k % 8 == 3:
            box(m, c, px(1.0), px(1.0), px(1.2), px(1.8), "green")
    for k in range(4):                                      # spokes
        a = k * math.tau / 4 + math.pi / 4
        box(m, (ring_r / 2 * math.cos(a), ring_r / 2 * math.sin(a)), ring_r - px(2), px(1.2), px(-0.5), px(0.6), "steel",
            heading=a)
    cylinder(m, (0, 0), px(3.2), px(-2.5), px(2.5), "steelL", "team.accent", inset=0.15)
    cylinder(m, (0, 0), px(1.0), px(2.5), px(9), "plate", sides=8)
    cylinder(m, (0, 0), px(1.8), px(5), px(6.2), "steelL", "team.cloth", sides=10)
    box(m, (0, 0), px(1.0), px(1.0), px(9), px(10), "cyan")
    return [m.build()]


def military():
    m = core.Mesh("military")
    for k in range(4):                                      # prongs out along the grid axes (an X on screen)
        a = k * math.pi / 2
        prong = turn([(px(3), px(2.6)), (px(11), 0), (px(3), px(-2.6))], a)
        prism(m, prong, px(-1.5), px(1.6), "steel", "team.cloth", inset=0.25)
        gun = turn([(px(5), px(0.5)), (px(9.5), px(0.5)), (px(9.5), px(-0.5)), (px(5), px(-0.5))], a)
        prism(m, gun, px(1.6), px(2.5), "steelD", "plate")
        box(m, turn([(px(5.2), 0)], a)[0], px(2.2), px(2.2), px(1.6), px(2.8), "steelL", "team.accent", heading=a)
    cylinder(m, (0, 0), px(4.6), px(-2.2), px(2.2), "steelL", "team.cloth", sides=8, inset=0.12)
    box(m, (0, 0), px(3.2), px(3.2), px(2.2), px(8.5), "steel", "team.accent", heading=math.pi / 4, inset=0.1)
    box(m, (0, 0), px(0.8), px(0.8), px(8.5), px(11.5), "steelD")
    box(m, (px(0.9), px(0.9)), px(1.0), px(1.0), px(7.2), px(8.2), "red")
    return [m.build()]


def dish(m, c, axis, r, depth, col, inner):
    """A shallow parabolic dish at Blender point c facing along axis, with a feed horn on a strut."""
    a = Vector(axis).normalized()
    e1 = a.cross(Vector((0, 0, 1))).normalized() if abs(a.z) < 0.99 else Vector((1, 0, 0))
    e2 = a.cross(e1).normalized()
    rings, segs = 3, 28
    pts = lambda i, j: c + (e1 * math.cos(j * math.tau / segs) + e2 * math.sin(j * math.tau / segs)) * (r * i / rings) \
        + a * (depth * (i / rings) ** 2)  # noqa: E731
    for i in range(rings):
        for j in range(segs):
            q = [pts(i, j), pts(i + 1, j), pts(i + 1, j + 1), pts(i, j + 1)]
            m.poly(q if i else [q[0], q[1], q[2]], inner if i < rings - 1 else col)
    tip = c + a * (depth + r * 0.6)
    for j in (0, segs // 3, 2 * segs // 3):
        b = pts(rings, j)
        s = (tip - b).cross(a).normalized() * px(0.35)
        m.poly([b - s, tip - s, tip + s, b + s], "steelD")
    box(m, (tip.x, tip.y), px(1.1), px(1.1), tip.z - px(0.55), tip.z + px(0.55), "steelL")


def research():
    m = core.Mesh("research")
    cylinder(m, (0, 0), px(1.3), px(-4), px(10), "plate", sides=10)
    cylinder(m, (0, 0), px(3.6), px(-6.5), px(-2), "steelL", "team.cloth", sides=14, inset=0.35)
    ring_r, segs = px(5.2), 28                              # a habitat ring round the spire
    for k in range(segs):
        a = k * math.tau / segs
        box(m, (ring_r * math.cos(a), ring_r * math.sin(a)), px(1.8), ring_r * math.tau / segs * 1.05, px(2), px(3.4),
            "steelL", "team.cloth" if k // 2 % 2 else "plate", heading=a)
    for k in range(2):
        box(m, (0, 0), ring_r * 2 - px(1), px(0.8), px(2.3), px(3.1), "steel", heading=k * math.pi / 2 + math.pi / 4)
    box(m, (px(1.4), px(-0.2)), px(0.6), px(0.6), px(-1.5), px(9), "cyan")
    dish(m, Vector((px(-1.2), px(-1.2), px(9.5))), Vector((-0.5, -0.55, 0.75)), px(6.0), px(-1.8), "medWhite", "plate")
    box(m, (0, 0), px(0.8), px(0.8), px(10), px(13), "steelD")
    box(m, (0, 0), px(1.0), px(1.0), px(13), px(14), "red")
    return [m.build()]


def den():
    m = core.Mesh("den")
    stone = rock(Vector((0, 0, 0)), px(7.5), 31, cols=("rkM", "rkD", "rk"), squash=0.7, rough=0.3)
    box(m, (px(3.5), px(-3)), px(5), px(3.5), px(1), px(5), "rust", "team.cloth", heading=0.3)
    box(m, (px(-4), px(2.5)), px(3.4), px(3), px(2), px(5.5), "steel", "rustD", heading=-0.4)
    box(m, (px(4.3), px(-3.6)), px(1.0), px(1.0), px(5), px(6), "orange")
    box(m, (px(-2), px(-4.5)), px(1.2), px(1.2), px(1), px(2.2), "orange")
    for k in range(7):                                      # spikes all round, the upper ones raked up
        a = k * math.tau / 7 + 0.3
        z, ln = (2.6, 3.2) if k % 2 else (0.2, 3.8)
        prism(m, turn([(px(6.2), px(0.8)), (px(6.2), px(-0.8)), (px(6.2 + ln), 0)], a), px(z), px(z + 1.4), "rustD", "steelL")
    box(m, (px(-0.5), px(0.5)), px(0.6), px(0.6), px(3), px(10), "steelD")
    box(m, (px(-0.5), px(-0.8)), px(0.4), px(2.6), px(7.6), px(10), "team.accent")
    return [m.build(), stone]


def asteroids():
    return [rock(Vector((*ground(x, y), 0)), px(r), seed, squash=0.8)                          # screen px from the centre
            for x, y, r, seed in ((-3.5, -2.5, 5.6, 3), (5.5, 0.5, 4.0, 7), (-1.0, 6.5, 3.0, 11))]


def derelict():
    """A slim hull broken in two: the bow section points up-right, the stern drifts off, ribs show at the break."""
    m = core.Mesh("derelict")
    a = screen_heading(-28)
    prism(m, turn([(px(11.5), 0), (px(8), px(2.3)), (px(1.5), px(2.4)), (px(0.5), px(1)), (px(1.6), px(-0.4)),
                   (px(0.6), px(-2.4)), (px(8), px(-2.3))], a), px(-1.6), px(1.8), "steel", "gW2", inset=0.1)
    box(m, turn([(px(6), px(1.2))], a)[0], px(3.5), px(1.2), px(1.8), px(2.6), "rust", heading=a)
    box(m, turn([(px(8.5), 0)], a)[0], px(1.0), px(1.0), px(1.8), px(2.6), "emR")
    b = a + 0.45                                            # the stern, broken off and tumbling away
    at = turn([(px(-3.5), px(-1.0))], a)[0]
    prism(m, turn([(px(-0.6), px(2.4)), (px(0.4), px(0.8)), (px(-0.4), px(-0.6)), (px(0.4), px(-2.4)), (px(-7), px(-2.4)),
                   (px(-7), px(2.4))], b, at), px(-2.2), px(1.4), "steel", "rust", inset=0.08)
    for v in (1.6, -1.6):
        box(m, turn([(px(-8), px(v))], b, at)[0], px(1.6), px(1.4), px(-1.6), px(0.8), "steelD", heading=b)
    for k in range(3):                                      # bare ribs between the halves
        box(m, turn([(px(0.2 - k * 0.9), px(1.6 - k * 1.4))], a)[0], px(0.5), px(0.5), px(-1.0), px(2.2), "steelD")
    for x, y, z in ((-1.0, 5.5, 2.0), (2.5, -5.0, -1.0), (-6.0, -4.0, 1.5)):         # debris
        box(m, (px(x), px(y)), px(1.1), px(0.9), px(z), px(z + 0.9), "steel", heading=x)
    return [m.build()]


BUILD = {"station_trade": trade, "station_military": military, "station_research": research, "den": den,
         "asteroids": asteroids, "derelict": derelict}


def icon_item(kind):
    start()
    objs = BUILD[kind]()
    for ob in objs:
        ob.scale = (ZOOM,) * 3
    place(objs, SIZE)
    return [frame_item(f"starmap.struct.{kind}", SIZE)]


def jobs():
    return [lambda kind=kind: icon_item(kind) for kind in KINDS]
