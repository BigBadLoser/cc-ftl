"""Station tube look study (issue #508, preview only): the short tube that joins two prefab base modules, three tiles long, a
floor tile between two wall tiles. Glass looks: the sprite keeps the glass's partial alpha (what is behind or inside shows
through), so one sprite serves the roofed and the cut view.

  tube.<look>
    glass     a clear round tube with metal ribs, a metal belly under the deck, end collars seated in a hull port at
              each module wall (picked); the hull ports are tube_port's (tube.port.e on a wall facing +x, tube.port.w
              on one facing -x)
    canopy    a solid lower hull with an amber stripe, a glass dome over it, arched ribs
    lattice   an octagonal glass tube, metal bars along its corners, ribs, a metal belly

The deck inside is in the sprite for the study only (in the game the floor tiles and the crew go under the glass). One
sprite draws the whole tube (no seams between tile sprites), anchored at the centre of its east tile: it runs along grid
+x between the collars of the two hull ports, centred on v = 0. Palette set tube."""
import math

import numpy as np

from . import core
from .cable_study import _frame

PAL = "tube"
L0, L1 = -3 + 0.71875 + 0.07, 1 - 0.71875 - 0.07   # the run along u: between the two hull ports' collars (tube_port)
ZC, R = 1.0, 0.8                         # shell centre height and radius: the hull port's axis and port radius
OCT = 0.76                               # the lattice's apothem
ZB = 0.62                                # top of the metal belly (below it the shell is opaque): a kick panel
                                         # a third of crew height over the deck, so the ground does not show low
DECK = 0.3                               # the deck's top: the hull's floor height (walls.ZG)
GLASS_ALPHA, GLASS_RIM = 0.18, 0.35      # the glass's opacity, and how much more at grazing angles
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
    """The walkway inside (study only): a deck plate, lamps along its edges."""
    f.box((L0 + L1) / 2, 0, DECK - 0.12, L1 - L0, 0.76, 0.12, "tbDeckD", top="tbDeck")
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
    for u in ((2 * L0 + L1) / 3, (L0 + 2 * L1) / 3):                         # saddles to the ground
        f.box(u, 0, 0.0, 0.14, 1.2, ZC - R + 0.12, "tbRib", top="tbRibL")


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
    glassy = mg.build()
    glassy["alpha"], glassy["rim"] = GLASS_ALPHA, GLASS_RIM
    return [m.build(), glassy]


def _render(aid, objs):
    """Render with the glass's partial alpha kept: a px the opaque parts cover is opaque; one only glass covers takes the
    glass's coverage as its alpha and the glass's colour."""
    from . import env_build as E, post
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    cg, _ = post.downsample(rgb, a > 0.02, core.SS, 8, True)
    cov = post.blocks(a, core.SS).mean(-1)
    see = ~op & (cov > 0.04)
    c = np.where(see[..., None], cg, c)
    al = np.where(op, 255, np.where(see, np.clip(cov * 255, 0, 255), 0)).astype(np.uint8)
    c, al = E._pad1(c), np.pad(al, 1)
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
        aid = f"tube.port.{ {2: 'e', 1: 's', 8: 'w'}[o] }" + (".open" if door else "")
        core.clear_scene_meshes()
        post.select("tube+hull+walls")
        at = {2: (-1.0, 0.0), 1: (0.0, -1.0), 8: (1.0, 0.0)}[o]   # (the door tile, from the tube's tile next to it:
        own, wide = tube_port.piece(o, at=at)                    #  the sprite's origin)
        inside, mouth = tube_port.through(o, at, door) if o != 8 else ([], None)
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


def jobs():
    return [_job(look) for look in STUDY] + [_port_job(2, d) for d in (False, True)] + [_port_job(8)]
