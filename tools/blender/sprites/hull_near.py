"""The cut hull's ghost: the rear ghost's back upright (hull._rise, hull._back_fill) stood on the cut hull's outer edge,
where its armour face rises from the deck-level cut (wall3d_belly, `top` FAR_LOW). A 'wire' sprite (hull_wire.render): a
line along the cut's outer edge, faint lines rising at the tile seams and where the outline turns (its chamfers), fading as
they go, and the same fading fill between them. One per hull key (hull_catalog), as the belly's pieces, on every front:
the near hull's, and a side diagonal's or a far run's where it is cut too (a step in a side, the back wall across a notch;
render/tiles.ts hidesShip): tile.hull.ghost.n.<key name>."""
from . import core
from . import hull_outline as HO
from . import wall3d_belly as B
from .hull import FADE, _dummy, _Fill
from .hull_wire import TONE, strip
from .wall3d_ext_diag import UP, _solid

BACK = tuple(f"gFillN{i}" for i in range(11))   # the fill, bottom up: as the rear's (hull.BACK) but stronger, over the
#   lit armour face below it (the rear's over dark space)
Z0 = B.FAR_LOW                             # (from the cut's top, flush with the deck)


def _top():
    from .walls import hull_top
    return Z0 + hull_top() / 6 - 0.02      # (as tall as the rear's)


def _faces(key, za, zb):
    """The parts' outer faces between za and zb: [points in order]."""
    out = []
    for f, planes, n, _, _ in B._parts(key, B.ZG):
        own = next(i for i in range(7, 7 + n) if planes[i][1] == f[1] / 32
                   and (planes[i][0].x, planes[i][0].y) == tuple(f[0]))
        planes = list(planes)
        planes[4], planes[5] = (UP, zb), (-UP, -za)
        out += [[tuple(p) for p in pts] for pts, _, i in _solid(planes) if i == own]
    return out


def _cuts():
    z1 = _top()
    lo = Z0 + (z1 - Z0) / 3                # (the bottom band a third of the height, the fade in ten bands above)
    return [Z0] + [lo + (z1 - lo) * k / (len(BACK) - 1) for k in range(len(BACK))]


def upright(key):
    """The ghost of a hull key: [plate, lines, fill]; [] if the key has no front."""
    z1 = _top()
    faces = _faces(key, Z0, z1)
    if not faces:
        return []
    name = HO.name(key)
    m = core.Mesh(f"hull_near_{name}", flat=True)
    seen = set()
    for pts in faces:
        for p, q in zip(pts, pts[1:] + pts[:1]):
            if abs(p[2] - Z0) < 1e-6 and abs(q[2] - Z0) < 1e-6:
                strip(m, p, q, TONE)                                   # (the cut's outer edge)
            elif abs(p[0] - q[0]) < 1e-6 and abs(p[1] - q[1]) < 1e-6:
                xy = (round(p[0], 4), round(p[1], 4))
                if xy in seen or xy[0] > 0.5 - 1e-4 or xy[1] > 0.5 - 1e-4:
                    continue                    # (a seam on the tile's +x / +y side: the next tile's line)
                seen.add(xy)
                for k, tone in enumerate(FADE):
                    za, zb = Z0 + (z1 - Z0) * k / len(FADE), Z0 + (z1 - Z0) * (k + 1) / len(FADE)
                    strip(m, (*xy, za), (*xy, zb), tone)
    f = _Fill(f"hull_near_fill_{name}", flat=True)
    cuts = _cuts()
    for k, tone in enumerate(BACK):
        for pts in _faces(key, cuts[k], cuts[k + 1]):
            f.poly([core.G(*p) for p in pts], tone)
    return [_dummy(f"hull_near_plate_{name}"), m.build()] + ([f.build()] if f.f else [])


def _some(k):
    """Whether a key's near ghost has faces: not where its near front lies past the tile's edge (a notch's), nor for a
    degenerate key (its belly fails too: hulltiles._guard)."""
    try:
        return bool(_faces(k, Z0, _top()))
    except ZeroDivisionError:
        return False


def sprites():
    """The walls family's jobs: (id, footprint, kind, builder) for every catalogued key."""
    from . import hull_catalog as HC
    out = []
    for k in HC.keys():
        if k and _some(k):
            out.append((f"tile.hull.ghost.n.{HO.name(k)}", (1, 1), "wire", lambda k=k: upright(k)))
    return out
