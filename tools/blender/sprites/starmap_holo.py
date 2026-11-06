"""Station holograms (family `starmap`): starmap.holo.<kind>, the station on the station panel's SENSORS screen (#332).

Each is the same station as its starmap icon (starmap_icons.py), built again at 128 x 96 px with the detail the icon has
no room for, so a player connects the two:

  station_trade      the wheel: a ring of cargo pods on spokes, docking arms out on four sides, a mast with a beacon
  station_military   the star fort: four armoured prongs, each with a twin-gun turret, a hangar mouth, a command tower
  station_research   the needle: a spire with a big dish on top, a habitat ring, antenna masts and a lab block at its foot
  den                the pirate den: a rock with two welded hulks rammed into it, scrap bolted on, spikes and a flag

Neutral tones with clear value bands, lit by the scene sun like the icons: the panel tints it (CSS filter or shader) and
adds the glow, so nothing here glows. Same three-quarter view as the icons. Sizes are 1x px of the 128 x 96 frame.

Anchors: each model names points (dock0.., gun0.., core, ...) in model space; `holo_item` returns them in frame px with
the sprite, so the sensor screen can point a callout at a real dock."""
import math

from mathutils import Vector

from . import core, post
from .starmap_icons import box, cylinder, dish
from .starmap_kit import prism, px, rock, start, turn

W, H = 128, 96                  # frame, 1x px
KINDS = ("station_trade", "station_military", "station_research", "den")
# The neutral ramp: lit by the sun these give the panel's filter distinct value bands (light tops, mid sides, dark seams).
HI, LT, MID, DK, SEAM = "c3W1", "c3W3", "c3W5", "plate", "steelL"


def P(x, y, z):
    return Vector((px(x), px(y), px(z)))


def ring(m, r, w, z0, z1, segs, cols, a0=0.0):
    """A flat ring of r (centre line) and width w, z0..z1, its segments painted cols[k % len(cols)]."""
    for k in range(segs):
        a = a0 + k * math.tau / segs
        box(m, (px(r) * math.cos(a), px(r) * math.sin(a)), px(w), px(r) * math.tau / segs * 1.04, px(z0), px(z1),
            cols[k % len(cols)][0], cols[k % len(cols)][1], heading=a)


def trade():
    m = core.Mesh("holo_trade")
    pts = {}
    R0 = 40
    ring(m, R0, 8, -3, 3, 48, [(MID, LT), (MID, LT), (DK, MID), (DK, MID)])
    for k in range(48):                                     # a window band round the outer face
        if k % 2:
            a = k * math.tau / 48
            box(m, (px(R0 + 4.1) * math.cos(a), px(R0 + 4.1) * math.sin(a)), px(0.4), px(2.5), px(-1), px(1), SEAM,
                heading=a)
    for k in range(8):                                      # cargo pods racked on the ring, mixed sizes and tones
        a = k * math.tau / 8 + math.pi / 8
        for j, (dr, da, h, col) in enumerate(((-2, -0.07, 7, HI), (2, -0.07, 5, LT), (-2, 0.07, 5, DK),
                                              (2, 0.07, 8, MID))):
            if (k + j) % 4 == 3:
                continue
            c = (px(R0 + dr) * math.cos(a + da), px(R0 + dr) * math.sin(a + da))
            box(m, c, px(3.6), px(5), px(3), px(3 + h), DK if col in (HI, LT) else SEAM, col, heading=a + da)
    for k in range(4):                                      # spokes, diagonals on screen
        a = k * math.pi / 2
        box(m, (px(R0 / 2 + 4) * math.cos(a), px(R0 / 2 + 4) * math.sin(a)), px(R0 - 18), px(3), px(-1.5), px(1.5), DK,
            MID, heading=a)
    for k in range(4):                                      # docking arms out on the four screen sides, a collar at the tip
        a = k * math.pi / 2 + math.pi / 4
        box(m, (px(R0 + 11) * math.cos(a), px(R0 + 11) * math.sin(a)), px(14), px(3), px(-1.5), px(1.5), DK, MID,
            heading=a)
        tip = (px(R0 + 19) * math.cos(a), px(R0 + 19) * math.sin(a))
        box(m, tip, px(4), px(7), px(-3.5), px(3.5), MID, HI, heading=a)
        box(m, (px(R0 + 21.2) * math.cos(a), px(R0 + 21.2) * math.sin(a)), px(0.6), px(4), px(-2), px(2), SEAM,
            heading=a)
        pts[f"dock{k}"] = P((R0 + 21) * math.cos(a), (R0 + 21) * math.sin(a), 0)
    cylinder(m, (0, 0), px(13), px(-7), px(6), DK, LT, sides=20, inset=0.12)  # the hub
    cylinder(m, (0, 0), px(7), px(6), px(9), MID, HI, sides=16)
    for k in range(10):
        a = k * math.tau / 10
        box(m, (px(13.1) * math.cos(a), px(13.1) * math.sin(a)), px(0.4), px(2.4), px(-1), px(2), SEAM, heading=a)
    cylinder(m, (0, 0), px(2.6), px(9), px(36), MID, sides=10)   # the mast
    cylinder(m, (0, 0), px(6.5), px(19), px(23), DK, LT, sides=14)
    cylinder(m, (0, 0), px(4.5), px(28), px(30), DK, MID, sides=12)
    box(m, (0, 0), px(3), px(3), px(36), px(39), HI)
    pts["core"] = P(0, 0, 0)
    pts["beacon"] = P(0, 0, 39)
    return [m.build()], pts


def military():
    m = core.Mesh("holo_military")
    pts = {}
    for k in range(4):                                      # prongs out along the grid axes (an X on screen)
        a = k * math.pi / 2
        prism(m, turn([(px(14), px(13)), (px(50), 0), (px(14), px(-13))], a), px(-7), px(5), DK, MID, inset=0.2)
        prism(m, turn([(px(18), px(8)), (px(40), 0), (px(18), px(-8))], a), px(5), px(8), MID, LT, inset=0.25)
        tc = turn([(px(29), 0)], a)[0]                      # a twin-gun turret on each prong, barrels outward
        cylinder(m, tc, px(5), px(8), px(11), DK, MID, sides=12)
        box(m, tc, px(6), px(6), px(11), px(14), MID, HI, heading=a)
        for v in (-1.6, 1.6):
            box(m, turn([(px(37), px(v))], a)[0], px(12), px(1.6), px(11.8), px(13.4), SEAM, DK, heading=a)
        pts[f"gun{k}"] = Vector((tc[0], tc[1], px(14)))
        for u in (22, 44):                                  # armour seams across the prong
            box(m, turn([(px(u), 0)], a)[0], px(0.8), px(26 - u * 0.5), px(5), px(5.6), SEAM, heading=a)
    cylinder(m, (0, 0), px(20), px(-9), px(8), DK, LT, sides=8, inset=0.1)    # the octagonal keep
    h = -math.pi / 4                                        # the hangar, between the two front prongs, facing the camera
    hc = turn([(px(20), 0)], h)[0]
    box(m, hc, px(12), px(22), px(-8), px(6), DK, MID, heading=h)
    box(m, turn([(px(26.2), 0)], h)[0], px(0.6), px(15), px(-6), px(3), "dark", heading=h)
    box(m, turn([(px(26.4), 0)], h)[0], px(0.6), px(18), px(3), px(5), HI, heading=h)
    pts["dock0"] = P(*turn([(26.5, 0)], h)[0], -1.5)
    pts["hangar"] = pts["dock0"]
    bk = turn([(px(21), 0)], h + math.pi)[0]                # a small docking port on the far side
    box(m, bk, px(6), px(7), px(-4), px(3), MID, LT, heading=h + math.pi)
    pts["dock1"] = P(*turn([(24, 0)], h + math.pi)[0], 0)
    box(m, (0, 0), px(16), px(16), px(8), px(30), DK, MID, heading=math.pi / 4, inset=0.1)   # the command tower
    box(m, (0, 0), px(18), px(18), px(24), px(28), SEAM, LT, heading=math.pi / 4)           # the bridge band
    box(m, (0, 0), px(14), px(14), px(28), px(32), MID, HI, heading=math.pi / 4, inset=0.15)
    box(m, (0, 0), px(2), px(2), px(32), px(44), DK)
    box(m, (px(-5), px(5)), px(1.6), px(1.6), px(32), px(39), DK)
    box(m, (0, 0), px(3), px(3), px(44), px(46), HI)
    pts["core"] = P(0, 0, 0)
    pts["beacon"] = P(0, 0, 46)
    return [m.build()], pts


def research():
    m = core.Mesh("holo_research")
    pts = {}
    cylinder(m, (0, 0), px(4.5), px(-24), px(40), MID, LT, sides=14)           # the spire
    for z in (-6, 14, 28):
        cylinder(m, (0, 0), px(5.5), px(z), px(z + 2), DK, MID, sides=14)
    cylinder(m, (0, 0), px(15), px(-34), px(-18), DK, LT, sides=18, inset=0.3)  # the lab block at its foot
    cylinder(m, (0, 0), px(16), px(-26), px(-23), SEAM, MID, sides=18)
    for k, a in enumerate((math.pi * 0.25, math.pi * 1.25)):                   # lab pods either side, with a docking port
        c = turn([(px(19), 0)], a)[0]
        box(m, c, px(10), px(9), px(-31), px(-22), MID, HI, heading=a, inset=0.1)
        e = turn([(px(25), 0)], a)[0]
        box(m, e, px(3), px(5), px(-29), px(-24), DK, LT, heading=a)
        pts[f"dock{k}"] = P(*turn([(26.5, 0)], a)[0], -26.5)
    R0 = 24                                                 # the habitat ring
    ring(m, R0, 6, 3, 9, 40, [(MID, LT), (MID, LT), (DK, MID)])
    for k in range(2):
        box(m, (0, 0), px(R0 * 2 - 4), px(2.6), px(5), px(7), DK, MID, heading=k * math.pi / 2 + math.pi / 4)
    for k, a in enumerate((0.0, math.pi / 2, math.pi)):     # antenna masts on the ring, with cross-bars
        c = (px(R0) * math.cos(a), px(R0) * math.sin(a))
        top = 26 + 6 * (k % 2)
        box(m, c, px(3), px(3), px(9), px(top), MID, LT)
        for z in (top - 8, top - 3):
            box(m, c, px(1.4), px(7), px(z), px(z + 1.4), DK, heading=a)
        pts[f"mast{k}"] = Vector((c[0], c[1], px(top)))
    dish(m, Vector((px(-2), px(-2), px(42))), Vector((-0.5, -0.55, 0.75)), px(24), px(-7), HI, LT)
    small = Vector((px(R0) * math.cos(math.pi * 1.5), px(R0) * math.sin(math.pi * 1.5), px(9)))
    box(m, (small.x, small.y), px(3), px(3), px(9), px(16), MID, LT)
    dish(m, small + Vector((0, 0, px(16))), Vector((0.6, -0.3, 0.75)), px(7), px(-2.5), HI, LT)
    box(m, (0, 0), px(3), px(3), px(40), px(52), DK, MID)
    box(m, (0, 0), px(3), px(3), px(52), px(54), HI)
    pts["dish"] = P(-2, -2, 42)
    pts["core"] = P(0, 0, 0)
    pts["beacon"] = P(0, 0, 54)
    return [m.build()], pts


def hulk(m, at, heading, length, width, z0, z1, side, top, deck=None):
    """A ship hull, its pointed bow at +u, with a raised deckhouse and a dark band of ports."""
    L, Wd = length, width
    prism(m, turn([(px(L * 0.5), 0), (px(L * 0.2), px(Wd / 2)), (px(-L * 0.5), px(Wd / 2)), (px(-L * 0.5), px(-Wd / 2)),
                   (px(L * 0.2), px(-Wd / 2))], heading, at), px(z0), px(z1), side, top, inset=0.1)
    box(m, turn([(px(-L * 0.12), 0)], heading, at)[0], px(L * 0.42), px(Wd * 0.55), px(z1), px(z1 + 3.5), side,
        deck or LT, heading=heading)
    for v in (Wd / 2 + 0.1, -Wd / 2 - 0.1):
        box(m, turn([(px(-L * 0.1), px(v))], heading, at)[0], px(L * 0.5), px(0.4), px((z0 + z1) / 2 - 1),
            px((z0 + z1) / 2 + 1), SEAM, heading=heading)


def den():
    """Three hulks welded nose to tail round a small rock, mismatched scrap bolted over the joins, spikes, a flag."""
    m = core.Mesh("holo_den")
    pts = {}
    stone = rock(Vector((px(-2), px(2), px(0))), px(27), 31, cols=("rk", "rkL", "gdL"), squash=0.66, rough=0.3)
    # a long freighter hulk across the front, a stubby gunboat at the back, a cargo barge on top, all at odd angles
    hulk(m, (px(26), px(-12)), 0.15, 50, 15, -5, 7, MID, HI)
    hulk(m, (px(-26), px(-14)), 3.75, 40, 12, 1, 10, DK, MID, deck=HI)
    hulk(m, (px(4), px(8)), -0.9, 34, 11, 16, 23, LT, HI, deck=MID)
    pts["dock0"] = P(*turn([(25, 0)], 0.15, (26, -12))[0], 1)            # the bows are the docks
    pts["dock1"] = P(*turn([(20, 0)], 3.75, (-26, -14))[0], 5)
    for x, y, z, sx, sy, h, col, hd in ((-12, -6, 15, 9, 10, 6, HI, 0.5), (14, 6, 13, 8, 7, 6, DK, -0.3),  # scrap plates
                                        (-4, -20, 11, 7, 6, 5, LT, 1.1), (-16, 14, 14, 6, 6, 5, MID, 0.9)):
        box(m, (px(x), px(y)), px(sx), px(sy), px(z), px(z + h), SEAM, col, heading=hd)
    for k in range(4):                                      # a pipe run over the top
        box(m, (px(-8 + k * 6), px(-8 - k * 1.5)), px(6.5), px(2.2), px(16), px(18.2), SEAM, DK, heading=-0.25)
    for k, (x, y, z, hd) in enumerate(((12, -18, 12, -0.6), (-16, 4, 18, 2.4))):  # crude turrets
        cylinder(m, (px(x), px(y)), px(4), px(z), px(z + 3.5), DK, MID, sides=10)
        box(m, turn([(px(5), 0)], hd, (px(x), px(y)))[0], px(10), px(2), px(z + 2), px(z + 3.8), SEAM, DK, heading=hd)
        pts[f"gun{k}"] = P(x, y, z + 3.5)
    for a, z, ln in ((0.9, 6, 14), (1.6, -2, 15), (2.4, 8, 13), (3.1, -2, 14), (4.6, -2, 17), (5.3, 5, 13)):
        prism(m, turn([(px(24), px(2.6)), (px(24), px(-2.6)), (px(24 + ln), 0)], a), px(z), px(z + 4), DK, LT)
    box(m, (px(-6), px(8)), px(2.4), px(2.4), px(16), px(48), DK, MID)           # the flag mast
    box(m, (px(-6), px(2.5)), px(1.2), px(10), px(38), px(47), HI)
    pts["core"] = P(0, 0, 0)
    pts["beacon"] = P(-6, 8, 48)
    return [m.build(), stone], pts


BUILD = {"station_trade": trade, "station_military": military, "station_research": research, "den": den}


def fit(objs, w, h, margin=3):
    """Centre the objects' screen box on the origin and scale them (up or down) to fill a w x h frame with a margin.
    Returns the map of a Blender point before the move to its point after it."""
    import bpy
    bpy.context.view_layer.update()
    x0, x1, y0, y1 = core.extent_px(objs)
    k = min((w - 2 * margin) / (x1 - x0), (h - 2 * margin) / (y1 - y0))
    shift = Vector(core._R.tolist()) * ((x0 + x1) / 2 / core.PXU) + Vector(core._U.tolist()) * ((y0 + y1) / 2 / core.PXU)
    for ob in objs:
        ob.location = (ob.location - shift) * k
        ob.scale = ob.scale * k
    bpy.context.view_layer.update()
    return lambda p: (p - shift) * k


def holo_item(kind):
    """Render one hologram into the W x H frame. Returns a manifest item plus `points`: {name: [x, y]} frame px."""
    start()
    objs, pts = BUILD[kind]()
    move = fit(objs, W, H)
    rgb, a = core.render(W - 2, H - 2, "color")
    c, op = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    c, op = post.outline(c, op, True)
    points = {}
    for name, p in pts.items():
        sx, sy = core.screen_xy(move(p))
        points[name] = [round(W / 2 + sx), round(H / 2 - sy)]
    return {"id": f"starmap.holo.{kind}", "fp": (1, 1), "rgba": post.to_rgba(c, op), "ax": W // 2, "ay": H // 2,
            "points": points}
