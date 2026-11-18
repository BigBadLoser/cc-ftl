"""The prefab base tube (issue #508, family tube; the game draws it from src/render/tubeArt.ts): the short tube that joins two prefab base modules, three tiles long, a
floor tile between two wall tiles. Glass looks: the sprite keeps the glass's partial alpha (what is behind or inside shows
through), so one sprite serves the roofed and the cut view.

  tube.<look>
    glass     a clear round tube with metal ribs, a metal belly under the deck, end collars seated in a hull port at
              each module wall (picked); the hull ports are tube_port's (tube.port.e on a wall facing +x, tube.port.w
              on one facing -x)
    canopy    a solid lower hull with an amber stripe, a glass dome over it, arched ribs
    lattice   an octagonal glass tube, metal bars along its corners, ribs, a metal belly

The tube draws its own floor (the walkway, narrower than a tile: the tube's tiles take no floor tile); the crew go over
it, under the glass. One
sprite draws the whole tube (no seams between tile sprites), anchored at the centre of its east tile: it runs along grid
+x between the collars of the two hull ports, centred on v = 0. Palette set tube."""
import math

import numpy as np

from . import core
from .cable_study import _frame
from .cmbkit import Frame

PAL = "tube"
L0, L1 = -3 + 0.71875 + 0.07, 1 - 0.71875 - 0.07   # the run along u: between the two hull ports' collars (tube_port)
ZC, R = 0.78, 0.95                       # shell centre height and radius: the hull port's axis and port radius; the
                                         # walkway (the chord at z 0) flush with the rooms' floor, 1.08 wide, 1.73 high
OCT = 0.76                               # the lattice's apothem
ZB = 0.15                                # top of the metal belly (below it the shell is opaque): a kick strip, low so the walkway shows through the glass
DECK = 0.0                               # the walkway: the rooms' floor (the shell under the ground is cut off)
GLASS_ALPHA, GLASS_RIM = 0.18, 0.35     # the glass's opacity, and how much more at grazing angles
SIDES = 32
SAMPLES = 64
LOOKS = ("glass", "canopy", "lattice")
STUDY = ("glass",)                     # the looks rendered now (A picked; it has the hull ports)


def _circle(th):
    return R


def _octagon(th):
    return OCT / math.cos(((th + math.pi / 8) % (math.pi / 4)) - math.pi / 8)


def _arc(rf, t0, t1, d=0.0):
    """Points [(s, z)] (s = +v, the near side) from angle t0 to t1 (ccw, 0 = the near side) at rf + d."""
    n = max(2, round(SIDES * (t1 - t0) / math.tau)) + 1
    return [((rf(t) + d) * math.cos(t), ZC + (rf(t) + d) * math.sin(t)) for t in np.linspace(t0, t1, n)]


def _skin(f, u0, u1, prof, col, closed=False):
    A = [f.pt(u0, s, z) for s, z in prof]
    B = [f.pt(u1, s, z) for s, z in prof]
    n = len(A)
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        f.poly([A[i], A[j], B[j], B[i]], col, flip=True)


def _band(f, u0, u1, rf, t0, t1, d, col, side=None):
    """A raised band over the shell (a rib, a collar) from angle t0 to t1, standing d proud, with its two side faces."""
    O, I = _arc(rf, t0, t1, d), _arc(rf, t0, t1, 0.0)
    _skin(f, u0, u1, O, col)
    for u in (u0, u1):
        for i in range(len(O) - 1):
            f.poly([f.pt(u, *O[i]), f.pt(u, *O[i + 1]), f.pt(u, *I[i + 1]), f.pt(u, *I[i])], side or col, flip=True)


def _belly_angle(zb):
    """The near-side angle where the shell crosses height zb (the far side's is pi minus it)."""
    return math.asin(max(-1.0, min(1.0, (zb - ZC) / R)))


def _deck(f):
    """The walkway: a deck plate across the shell's chord at the floor (the part under the ground cut off), lamps along
    its edges."""
    w = 2 * math.sqrt(R * R - (ZC - DECK) ** 2)
    f.box((L0 + L1) / 2, 0, DECK - 0.12, L1 - L0, w, 0.12, "tbDeckD", top="tbDeck")
    for c in (-1, 1):
        for k in range(5):
            f.box(L0 + 0.3 + 0.55 * k, c * 0.33, DECK, 0.08, 0.05, 0.02, "tbDeckD", top="tbLamp")


def _collars(f, rf, span=0.22, d=0.1):
    for u in (L0, L1 - span):
        _band(f, u, u + span, rf, 0.0, math.tau, d, "tbRib", "tbRibL")
        _band(f, u + span * 0.3, u + span * 0.7, rf, 0.0, math.tau, d + 0.02, "tbAmb")


def glass(f, g):
    b = _belly_angle(ZB)
    _skin(f, L0, L1, _arc(_circle, math.pi - b, math.tau + b), "tbHull")                   # the belly
    _skin(g, L0, L1, _arc(_circle, b, math.pi - b), "tbGlass")
    for k in range(1, 6):
        u = L0 + 0.5 * k
        _band(f, u - 0.03, u + 0.03, _circle, 0.0, math.tau, 0.03, "tbHull", "tbHullD")
    for u in (L0, L1 - 0.1):                                                   # the ends seated in the ports
        _band(f, u, u + 0.1, _circle, 0.0, math.tau, 0.05, "tbAmb", "tbRib")


END = 1 - 0.71875 - 0.07                 # an end tile's run stops here: the port's collar (tube_port), from the tile's middle
PARTS = {"mid": (-0.5, 0.5), "west": (-END, 0.5), "east": (-0.5, END), "one": (-END, END)}   # per tile, along u


NAMES = {"x": {"west": "west", "east": "east"}, "y": {"west": "north", "east": "south"}}   # (the y tube's runs -y to +y)


def _near(axis):
    """The sign of v on the camera's side of the tube's axis: grid +y for an x tube (Frame rot 1: v = +y), grid +x for a y
    tube (Frame rot 2: v = -x)."""
    return 1 if axis == "x" else -1


def _halves(axis, t0, t1):
    """The angle spans of [t0, t1] on the camera's side of the axis (front) and on the far side (back), as {half: [spans]}.
    The vertical plane through the axis cuts the shell at +-pi/2."""
    n = _near(axis)
    lo, hi = (-math.pi / 2, math.pi / 2) if n > 0 else (math.pi / 2, 3 * math.pi / 2)
    out = {"front": [], "back": []}
    for k in range(-1, 3):                                   # the front span and its turns, clipped to [t0, t1]
        a, b = max(t0, lo + k * math.tau), min(t1, hi + k * math.tau)
        if a < b - 1e-9:
            out["front"].append((a, b))
    edges = sorted({t0, t1, *(e for s in out["front"] for e in s)})
    for a, b in zip(edges, edges[1:]):
        if not any(s[0] <= a + 1e-9 and b <= s[1] + 1e-9 for s in out["front"]) and b > a + 1e-9:
            out["back"].append((a, b))
    return out


def segment(part, axis="x", bands=True, half=None):
    """One tile of the picked glass tube (tube.x.<part>): the run along u PARTS[part] from the tile's middle, its walkway,
    the belly and glass, ribs at u +-0.25 (so none falls on a tile's edge), an amber end band where it is seated in a
    port. A tube of any length is its tiles' segments side by side: west, mid ..., east (one: a single tile). axis y:
    the same along grid +y (tube.y.<north|mid|south|one>; the tube is the same either side of its axis).
    `half`: 'back' (the walkway, the belly and the shell on the far side of the axis: drawn under the crew in the tube) or
    'front' (the glass, ribs and bands on the camera's side: drawn over them); None, the whole tile."""
    u0, u1 = PARTS[part]
    m, mg = core.Mesh(f"tube_{part}_{half}"), core.Mesh(f"tube_{part}_{half}_glass")
    f, g = (_frame(m), _frame(mg)) if axis == "x" else (Frame(m, 2, square=True), Frame(mg, 2, square=True))

    def spans(t0, t1):
        return [(t0, t1)] if half is None else _halves(axis, t0, t1)[half]

    if half != "front":
        w = 2 * math.sqrt(R * R - (ZC - DECK) ** 2)
        f.box((u0 + u1) / 2, 0, DECK - 0.12, u1 - u0, w, 0.12, "tbDeckD", top="tbDeck")
        for c in (-1, 1):
            f.box(0.0, c * 0.33, DECK, 0.08, 0.05, 0.02, "tbDeckD", top="tbLamp")
    b = _belly_angle(ZB)
    if half != "front":                                      # (the belly, a low kick strip, stays under the crew's feet)
        _skin(f, u0, u1, _arc(_circle, math.pi - b, math.tau + b), "tbHull")
    for t0, t1 in spans(b, math.pi - b):
        _skin(g, u0, u1, _arc(_circle, t0, t1), "tbGlass")
    for t0, t1 in spans(0.0, math.tau):
        for u in (-0.25, 0.25):
            if u0 + 0.12 < u < u1 - 0.12:
                _band(f, u - 0.03, u + 0.03, _circle, t0, t1, 0.03, "tbHull", "tbHullD")
        if bands and part in ("west", "one"):
            _band(f, u0, u0 + 0.1, _circle, t0, t1, 0.05, "tbAmb", "tbRib")
        if bands and part in ("east", "one"):
            _band(f, u1 - 0.1, u1, _circle, t0, t1, 0.05, "tbAmb", "tbRib")
    from .tube_port import clip_ground
    glassy = clip_ground(mg.build())
    glassy["alpha"], glassy["rim"] = GLASS_ALPHA, GLASS_RIM
    return [clip_ground(m.build()), glassy]


def _seg_job(part, axis="x", half="back"):
    """A tile's back layer (tube.<axis>.<part>: under the crew) or front layer (`.front`: the camera's half of the glass, over
    them). The back layer renders with the next tiles' back halves beside it (`extras`); the front layer alone, so its glass
    takes only its own colour and the game lays it over the back layer and the crew."""
    def run(part=part, axis=axis, half=half):
        import bpy
        from . import post
        aid = f"tube.{axis}.{NAMES[axis].get(part, part)}{'.front' if half == 'front' else ''}"
        core.clear_scene_meshes()
        post.select(PAL)
        extras = []                                     # (the next tiles' segments either side, where the tube runs on:
        for k, nb in ((-1, part in ("mid", "east")), (1, part in ("mid", "west"))):   # as far as either may run, its
            if nb and half == "back":                   # port end's (past it a mid one's floor would be baked into the
                for ob in segment("west" if k < 0 else "east", axis, bands=False, half="back"):   # glass over the bore)
                    ob.location = ob.location + (core.G(k, 0.0, 0.0) if axis == "x" else core.G(0.0, k, 0.0))
                    extras.append(ob)
        objs = segment(part, axis, half=half)
        sc = bpy.context.scene
        sc.cycles.samples = SAMPLES
        try:
            it = _render(aid, objs, extras)
        finally:
            sc.cycles.samples = core.SAMPLES
        return [it] if it else []
    return run


def canopy(f, g):
    _skin(f, L0, L1, _arc(_circle, math.pi, math.tau), "tbHull")                          # the lower half
    _band(f, L0, L1, _circle, -0.38, -0.26, 0.006, "tbAmb")                                 # stripe, near side
    _band(f, L0, L1, _circle, math.pi + 0.26, math.pi + 0.38, 0.006, "tbAmb")               # and far
    _band(f, L0, L1, _circle, -0.04, 0.0, 0.03, "tbHullD")                                  # the sill along each side
    _band(f, L0, L1, _circle, math.pi, math.pi + 0.04, 0.03, "tbHullD")
    _skin(g, L0, L1, _arc(_circle, 0.0, math.pi), "tbGlass")
    for k in range(1, 6):
        u = L0 + 0.5 * k
        _band(f, u - 0.03, u + 0.03, _circle, 0.0, math.pi, 0.03, "tbHull", "tbHullD")
    _collars(f, _circle)


def lattice(f, g):
    b = _belly_angle(ZB)
    _skin(f, L0, L1, _arc(_octagon, math.pi - b, math.tau + b), "tbHull")
    _skin(g, L0, L1, _arc(_octagon, b, math.pi - b), "tbGlass")
    for k in range(8):                                                         # bars along the corners above the belly
        t = math.pi / 8 + k * math.pi / 4
        s, z = _octagon(t) * math.cos(t), ZC + _octagon(t) * math.sin(t)
        if z > ZB + 0.05:
            f.box((L0 + L1) / 2, s * 1.02, z - 0.03, L1 - L0, 0.06, 0.06, "tbRib", top="tbRibL")
    for u in (L0 + 0.75, L0 + 1.5, L0 + 2.25):
        _band(f, u - 0.035, u + 0.035, _octagon, 0.0, math.tau, 0.03, "tbRib", "tbRibL")
    _collars(f, _octagon)


def tube(look):
    m, mg = core.Mesh(f"tube_{look}"), core.Mesh(f"tube_{look}_glass")
    f, g = _frame(m), _frame(mg)
    _deck(f)
    {"glass": glass, "canopy": canopy, "lattice": lattice}[look](f, g)
    from .tube_port import clip_ground
    glassy = clip_ground(mg.build())
    glassy["alpha"], glassy["rim"] = GLASS_ALPHA, GLASS_RIM
    return [clip_ground(m.build()), glassy]


def _render(aid, objs, extras=()):
    """Render with the glass's partial alpha kept: a px the opaque parts cover is opaque (the glass's colour over them);
    one only glass covers takes the glass's coverage as its alpha and the glass's colour, however edge-on it is seen. `extras` (the next tiles' segments): in the scene, so the glass
    takes the colour of what is behind it there, but their px are not the sprite's (it keeps the px where its own objects
    show)."""
    from . import env_build as E, post
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    own = None
    if extras:
        for ob in extras:
            ob.is_holdout = True
        _, ao = core.render(W, H, "color")
        own = post.blocks(ao > 0.02, core.SS).mean(-1) > 0.04
        for ob in extras:
            ob.is_holdout = False
    glass = [ob for ob in objs if ob.get("alpha") is not None]
    for ob in glass:                                    # (what is opaque: the solid parts alone, so a px where the
        ob.hide_render = True                           #  glass is seen edge-on, its coverage high, still lets the
    _, asol = core.render(W, H, "color")                #  sprites behind it show through)
    for ob in glass:
        ob.hide_render = False
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, asol > 0.5, core.SS, 8, True)
    cg, _ = post.downsample(rgb, a > 0.02, core.SS, 8, True)
    cov = post.blocks(a, core.SS).mean(-1)
    see = ~op & (cov > 0.04)
    if own is not None:
        op, see = op & own, see & own
    c = np.where(see[..., None], cg, c)
    al = np.where(op, 255, np.where(see, np.clip(cov * 255, 0, 255), 0)).astype(np.uint8)
    c, al = E._pad1(c), np.pad(al, 1)
    for ob in extras:
        ob.hide_render = True
    grgb, _ = core.render(W, H, "glow")
    g = E._pad1(post.glow_down(grgb, core.SS, 3))
    return E.crop_item(aid, (1, 1), c, al > 0, g, (W + 2) // 2, (H + 2) // 2, al=al)


def _job(look):
    def run(look=look):
        import bpy
        from . import post
        aid = f"tube.{look}"
        core.clear_scene_meshes()
        post.select(PAL)
        objs = tube(look)
        sc = bpy.context.scene
        sc.cycles.samples = SAMPLES
        try:
            it = _render(aid, objs)
        finally:
            sc.cycles.samples = core.SAMPLES
        return [it] if it else []
    return run


def _port_job(o, door=False):
    """tube.port.w (o 8: a wall facing away, the block alone, drawn before the wall); tube.port.<e|s>[.open], drawn in every view over the hull row (which stands full height there in every view, as
    the airlock's: its hull sprite module.airlock.hull.r<n>): the bore through the door tile's hull with the corridor
    door (closed / open) in it and the room's dark behind."""
    def run(o=o, door=door):
        import bpy
        from . import env_build as E, post, tube_port
        aid = f"tube.port.{ {2: 'e', 1: 's', 8: 'w', 4: 'n'}[o] }" + (".open" if door else "")
        core.clear_scene_meshes()
        post.select("tube+hull+walls")
        at = {2: (-1.0, 0.0), 1: (0.0, -1.0), 8: (1.0, 0.0), 4: (0.0, 1.0)}[o]   # (the door tile, from the tube's tile next to it:
        own, wide = tube_port.piece(o, at=at)                    #  the sprite's origin)
        inside, mouth = tube_port.through(o, at, door) if o in (2, 1) else ([], None)
        for ob in inside + ([mouth] if mouth else []):
            ob.hide_render = True
        sc = bpy.context.scene
        sc.cycles.samples = SAMPLES
        try:
            c, op, g, ox, oy = E.render_sprite(aid, "over", (own, wide))[:5]
            if mouth:                                   # (o 8: the bore faces away, the tube in it: no door to show)
                c, op = _mouth(own, wide, inside, mouth, c, op)
            it = E.crop_item(aid, (1, 1), c, op, g, ox, oy)
        finally:
            sc.cycles.samples = core.SAMPLES
        return [it] if it else []
    return run


def _mouth(own, wide, inside, mouth, c, op):
    """The port's px where its mouth shows through to `inside` (rendered with the block, no hull): those px from it."""
    from . import env_build as E, post
    xmin, xmax, ymin, ymax = core.extent_px(own)        # (render_sprite's frame for these own)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    every = list(wide) + list(inside) + [mouth]
    def only(show):
        for ob in every:
            ob.hide_render, ob.is_holdout = ob not in show, False
    only([mouth])
    _, a = core.render(W, H, "color")
    _, at = post.downsample(a[..., None].repeat(3, -1), a > 0.5, core.SS, 8, True)
    only(list(own) + list(inside))
    rgb, a = core.render(W, H, "color")
    ci, oi = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    for ob in every:
        ob.hide_render = True
    at, ci, oi = E._pad1(at), E._pad1(ci), E._pad1(oi)
    use = at & oi & ~op
    return np.where(use[..., None], ci, c), op | use


def _junction_job(o, t, half=None):
    """tube.junction.<e|w|s|n>[.open][.front] (on a wall facing +x / -x / +y / -y): the junction's inboard piece with its
    hatch (tube_junction), anchored at its front tile (the door tile's +y neighbour, on a y wall its +x one: drawn after the
    wall row it stands in). On the near module's wall (o 8 / 4) in two layers either side of crew in the door tile
    (tube_junction.halves): the bore, hatch and floors (`half` 'back', no suffix), the room face round it ('front')."""
    def run(o=o, t=t, half=half):
        import bpy
        from . import env_build as E, post, tube_junction
        aid = f"tube.junction.{ {2: 'e', 8: 'w', 1: 's', 4: 'n'}[o] }" + (".open" if t else "") + (".front" if half == "front" else "")
        core.clear_scene_meshes()
        post.select("tube+hull+walls")
        at = (0.0, -1.0) if o in (2, 8) else (-1.0, 0.0)
        objs = tube_junction.piece(o, t, at=at)
        sc = bpy.context.scene
        sc.cycles.samples = SAMPLES
        try:
            if half is None:
                it = E.crop_item(aid, (1, 1), *E.render_sprite(aid, "block", objs)[:5])
            else:
                back, front = tube_junction.halves(objs, o, at)
                own = front if half == "front" else back
                it = E.crop_item(aid, (1, 1), *E.render_sprite(aid, "over", (own, back + front))[:5])
        finally:
            sc.cycles.samples = core.SAMPLES
        return [it] if it else []
    return run


def _hull_job(rot):
    """tube.hull.r<1|2>.<level>[.tint] (rotation 1: a hull row facing +x, 2: +y): the far port's hull row, as the
    airlock's camera-facing one (airlock.hull: the base exterior hull full height in every view, closed by end cuts) but
    three tiles long (tube_port.ROW, the block a little narrower): no neighbour's cut hull past its ends, those tiles' own."""
    def run(rot=rot):
        from . import airlock as AL, post, tube_port, walls as W
        post.select(AL.HULL_PAL)
        row = (-2, -1, 0, 1, 2)
        keep = AL.HALF, AL.ROW, AL._stub_ends, AL._trim.__defaults__, AL._stub.__defaults__
        AL.HALF, AL.ROW, AL._stub_ends = tube_port.ROW, row, (lambda r: [])
        AL._trim.__defaults__, AL._stub.__defaults__ = (-tube_port.ROW, tube_port.ROW), (row,)
        try:
            out = []
            for lv in W.LEVELS:
                core.clear_scene_meshes()
                out.extend(AL._hull_items(f"tube.hull.r{rot}.{lv}", rot, lv))
        finally:
            AL.HALF, AL.ROW, AL._stub_ends, AL._trim.__defaults__, AL._stub.__defaults__ = keep
        return _doorway(out, rot)
    return run


def _doorway(items, rot):
    """The hull row's items with the far port's doorway cut through: its px inside the port's mouth (tube_port.through,
    as the port sprite has it, drawn over the row) cleared, so through the open hatch the room behind shows, not the
    row's hull (closed, the port's hatch fills its mouth). The mouth is placed as in the port's job (its origin the
    tube's first tile) and moved onto the row's anchor (its front tile) by the two tiles' offset on screen, as the game
    draws them (tubeArt.tubePieces)."""
    from . import post, tube_port
    core.clear_scene_meshes()
    o, at = (2, (-1.0, 0.0)) if rot == 1 else (1, (0.0, -1.0))   # (the port job's: the door tile from the first tile)
    inside, mouth = tube_port.through(o, at)
    for ob in inside:
        ob.hide_render = True
    xmin, xmax, ymin, ymax = core.extent_px([mouth])
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    _, a = core.render(W, H, "color")
    hole = post.blocks(a > 0.5, core.SS).mean(-1) > 0.5
    gx, gy = (1, -1) if rot == 1 else (-1, 1)                   # (the first tile from the row's front tile)
    sx, sy = (gx - gy) * core.TILE_W // 2, (gx + gy) * core.TILE_H // 2
    ys, xs = np.nonzero(hole)
    for it in items:
        h, w = it["rgba"].shape[:2]
        iy, ix = ys - H // 2 + sy + it["ay"], xs - W // 2 + sx + it["ax"]
        keep = (iy >= 0) & (iy < h) & (ix >= 0) & (ix < w)
        it["rgba"][iy[keep], ix[keep], 3] = 0
        if "g" in it:
            it["g"][iy[keep], ix[keep]] = 0
    return items


def jobs():
    return ([_seg_job(p, a, h) for a in ("x", "y") for p in PARTS for h in ("back", "front")] +
            [_port_job(o, d) for o in (2, 1) for d in (False, True)] + [_port_job(8), _port_job(4)] +
            [_junction_job(o, t, h) for o in (8, 4) for t in (0.0, 1.0) for h in ("back", "front")] + [_hull_job(1), _hull_job(2)])
