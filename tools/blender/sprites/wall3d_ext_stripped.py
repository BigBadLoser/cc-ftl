"""The exterior hull stripped of its armour: each piece (wall3d_ext_diag, by key) as a deep cavity full of the
machinery behind the plating (after hull 46's cut sides): a flared keel along the foot, ribs at each tile's edge
following the hull's profile, pipes along each side, and a cluster of housings, tanks and flanges, all lit from
above and fading to near black with depth, inside a thin frame that keeps the hull's outline. The art a damaged tile
shows: the renderer blends the intact piece into it through a damage mask as the tile's integrity drops.

The machinery along a side is laid out over two tiles (PERIOD), in two phases: phase p is the tile's (x + y) mod 2,
which flips from each tile to the next along any side, so a run repeats only every other tile and parts may cross a
tile's edge. Every part is a convex solid (a pipe a many-sided prism) clipped to the tile and to the intact piece's
solid from the same key, so it lines up with the intact piece pixel for pixel."""
import math

from mathutils import Vector

from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from . import wall3d_ext_machinery as MK
from .wall3d_ext_diag import UP, _front, _lift, _solid, _tile
from .wall3d_ext_geom import D, LEAN_RISE

CAVITY = 10 / 32                    # tiles: the inner wall this deep in from the upright face and the lean
FRAME_W = 1.5 / 32                  # the outline frame's width (the foot, the bend, the lean's top edge)
PERIOD = 2                          # tiles: the machinery's layout repeats this often along a side
FOG = 3 / 32                        # tiles of depth per ramp step darker
PIPES = ((0.62, 2.5 / 32, 8 / 32), (0.3, 4 / 32, 7.5 / 32))     # along the upright part, deep behind the kit:
                                    # height (a fraction of it), radius, depth of its axis
TRAY = (0.45, 1.2 / 32, 7 / 32, 4)  # a cable tray along the lean: height up it, each cable's radius, depth, count
KEEL = (5 / 32, 2 / 32, 3 / 32)     # the keel along the foot: height, its front this deep, the flare's bevel
LAYOUT = (("pump", 4, 0.0), ("junction", 23, 0.42), ("tanks", 37, 0.0), ("junction", 59, 0.12),
          ("actuator", 14, 0.0), ("actuator", 46, 0.0))   # the kit over a period (64 art px along a straight side;
                                    # scaled to a diagonal's): unit, where along, its foot (a fraction of the upright)
SIDES = 12                          # a pipe's sides
RAMP = ("hsXK", "hsK", "hsXD", "hsD", "hsXM", "hsXS", "hsM", "hsS", "hsL", "hsH")
RAMPS = {"grey": RAMP,
         "coolant": ("hsXK", "hsK", "bD", "gB3", "bM", "bT", "bXH", "icD", "icM", "ic"),
         "hazard": ("hsXK", "hsK", "c4T5", "c4T5", "c4T4", "c4T3", "c4T2", "c4T1", "c4T0", "c4T0")}
TONES = {"wall": ("grey", 0), "frame": ("grey", 6), "keel": ("grey", 5), "pipe": ("grey", 6), "body": ("grey", 7),
         "trim": ("grey", 8), "bracket": ("grey", 8), "cradle": ("grey", 4), "rib": ("grey", 5), "stringer": ("grey", 5), "chord": ("grey", 5), "ram": ("grey", 4),
         "coolant": ("coolant", 7), "hazard": ("hazard", 7)}   # a lit face's ramp and index at the face (each step
                                    # round from the light one darker; FOG deeper)
LIGHTS = {"light_c": "fxC2", "light_r": "fxR"}   # status lights: one glowing tone
RIB = (3 / 32, 1 / 32)              # a rib at each tile edge, the plating's frame: width, its front this deep (just
                                    # behind the skin), its web back to the inner wall
STRINGERS = ((0.5, 2 / 32), (1.0, 2.5 / 32))   # stringers round the upright part (a fraction of its height, height)
STRINGER_LEAN = (0.5, 2 / 32)       # and one along the lean (a fraction up it, height)
STRINGER_DEPTH = (1.5 / 32, 4 / 32)  # a stringer's front and back, in from the face (a flat bar behind the skin)
CHORD = 2.5 / 32                    # the top chord's height (a main member, along the lean's top edge)
BRACKET = (2 / 32, 0.5 / 32, 2.5 / 32)   # where a rib crosses a stringer: half size, front, back (the skin bolts on)


def _tone(part, m, depth):
    if part in LIGHTS:
        return LIGHTS[part]
    ramp, i = TONES[part]
    RAMP = RAMPS[ramp]
    if part != "wall":
        i += 1 if m.z > 0.6 else 0 if m.z > 0.15 else -1 if m.z > -0.4 else -3
        i -= 1 if m.x > m.y + 1e-6 else 0                   # (the side away from the light)
        i -= int(max(0.0, depth) / FOG)
    return RAMP[max(0, min(len(RAMP) - 1, i))]


class _Side:
    """A front's frame: outward normal n, along-direction t, its face's offset (n . p on the face), its lean."""

    def __init__(self, s, c, w, H):
        self.n = s.normalized()
        self.t = Vector((-self.n.y, self.n.x, 0.0))
        self.off = c / s.length
        k = D / LEAN_RISE
        self.lean = (s + w * k * UP, c - w * D + w * k * H)
        self.zb, self.H = H - LEAN_RISE, H
        self.per = 1.0 if abs(self.t.x) + abs(self.t.y) < 1.2 else math.sqrt(0.5)    # (a tile along it)

    def at(self, depth, z, u=0.0):
        return self.n * (self.off - depth) + UP * z + self.t * u

    def lean_depth(self, z):
        """How far in from the upright face's plane the lean is at height z."""
        ln, lc = self.lean
        return self.off - (lc - ln.z * z) / ln.dot(self.n)

    def on_lean(self, frac, depth, u=0.0):
        """A point on the lean a fraction up it, this deep in along its normal."""
        ln, _ = self.lean
        z = self.zb + frac * LEAN_RISE
        return self.at(self.lean_depth(z), z, u) - ln.normalized() * depth


def _pipe(centre, side, r, depth):
    planes = []
    for i in range(SIDES):
        a = 2 * math.pi * (i + 0.5) / SIDES
        n = side.n * math.cos(a) + UP * math.sin(a)
        planes.append((n, n.dot(centre) + r))
    return planes, depth - r


def _box(side, u0, u1, d0, d1, z0, z1, bevel=0.0):
    """A box in a side's terms (along, depth in from its face, height), its outer edges bevelled."""
    n, t = side.n, side.t
    planes = [(t, u1), (-t, -u0), (n, side.off - d0), (-n, -(side.off - d1)), (UP, z1), (-UP, -z0)]
    for m in ((n + UP, n - UP, n + t, n - t, UP + t, UP - t) if bevel else ()):
        m = m.normalized()
        corner = n * (side.off - d0 if m.dot(n) > 0 else side.off - d1) + UP * (z1 if m.z > 0 else z0)
        corner += t * (u1 if m.dot(t) > 0 else u0 if m.dot(t) < 0 else 0)
        planes.append((m, m.dot(corner) - bevel * 0.7))
    return planes, d0


def _parts(side, phase):
    """Each machinery part along a side, placed for the tile's phase: [(planes, front depth, kind)]."""
    L, zb = PERIOD * side.per, side.zb
    out = []
    for (z, r, dep), kind in zip(PIPES, ("coolant", "pipe")):
        out.append((*_pipe(side.at(dep, zb * z), side, r, dep), kind))
    frac, r, dep, n = TRAY
    for j in range(n):
        out.append((*_pipe(side.on_lean(frac + (j - (n - 1) / 2) * 2.2 * r / LEAN_RISE, dep), side, r, dep), "pipe"))
    ln = side.lean[0].normalized()                          # (their tray: a trough under them on the lean)
    c = side.on_lean(frac, dep + 2 * r)
    up = (UP - ln * ln.dot(UP)).normalized()
    half = (n + 1) * 1.1 * r
    out.append(([(up, up.dot(c) + half), (-up, -up.dot(c) + half), (ln, ln.dot(c) + 0.6 * r),
                 (-ln, -ln.dot(c) + 0.6 * r)], dep + 2 * r, "cradle"))
    kh, kd, kb = KEEL
    out.append((*_box(side, -9, 9, kd, CAVITY, 0.0, kh, bevel=kb), "keel"))
    s0, s1 = STRINGER_DEPTH
    for f, sh in STRINGERS:                                      # (stringers: flat bars just behind the skin)
        z = min(zb * f, zb - sh / 2)
        out.append((*_box(side, -9, 9, s0, s1, z - sh / 2, z + sh / 2), "stringer"))
    f, sh = STRINGER_LEAN
    ln, lc = side.lean
    zl = zb + f * LEAN_RISE
    out.append(([(UP, zl + sh / 2), (-UP, -(zl - sh / 2)), (ln, lc - s0 * ln.length),
                 (-ln, -(lc - s1 * ln.length))], s0, "stringer"))
    out.append(([(UP, side.H), (-UP, -(side.H - CHORD)), (ln, lc - s0 * ln.length),   # (the top chord: along the
                 (-ln, -(lc - s1 * ln.length))], s0, "chord"))                          # lean's top edge)
    scale = L / (64 * MK.P)
    for m in range(-2, 3):
        base = m * L - phase * side.per
        for k in range(PERIOD):                                  # (a rib at each tile edge: the frame)
            u, (rw, rd) = base + (k + 0.5) * side.per, RIB
            out.append((*_box(side, u - rw / 2, u + rw / 2, rd, CAVITY, 0.0, zb), "rib"))
            ln, lc = side.lean
            out.append(([(side.t, u + rw / 2), (-side.t, -(u - rw / 2)), (UP, side.H), (-UP, -zb),
                         (ln, lc - rd * ln.length)], rd, "rib"))
            hb, b0, b1 = BRACKET                                 # (brackets where it crosses the stringers)
            for f, sh in STRINGERS:
                z = min(zb * f, zb - sh / 2)
                out.append((*_box(side, u - hb, u + hb, b0, b1, z - hb, z + hb, bevel=0.5 / 32), "bracket"))
        for unit, at, foot in LAYOUT:
            u = base + at * MK.P * scale
            if unit == "pump":
                out += MK.pump(side, u, kh)
            elif unit == "junction":
                out += MK.junction(side, u, max(kh, zb * foot))
            elif unit == "tanks":
                out += MK.tanks(side, u, kh, zb * 0.8)
            else:
                out += MK.actuator(side, u, side.on_lean, LEAN_RISE * 1.1)
    return out


def _planes(g, before, after, H, tile, inset=0.0):
    """A convex run's solid (wall3d_ext_diag._part without its ridge cuts), its upright faces and leans `inset` in."""
    k = D / LEAN_RISE
    fronts = [_front(f) for f in g]
    planes = list(tile) + [(UP, H), (-UP, 0.0)]
    for s, c, w in fronts:
        lean = s + w * k * UP
        planes += [(s, c - inset * s.length), (lean, c - w * D + w * k * H - inset * lean.length)]
    planes += [_lift(HO.nearer(o, f)) for o, f in ((before, g[0]), (after, g[-1])) if o]
    return planes, fronts


def _emit(rel, planes, part, depth):
    for pts, m, _ in _solid(planes):
        rel.poly(pts, "steel", 3, m, fixed=_tone(part, m, depth))


MAIN = frozenset(("frame", "keel", "rib", "chord"))   # the structure: what still stands in a breach (piece(only=...));
STRUTS = frozenset(("stringer", "bracket"))           # the lighter members, which a breach can break
FRAME = MAIN | STRUTS


def piece(key, phase=0, H=None, margin=0.0, only=None, skip=frozenset()):
    """The stripped piece of a tile with this key, in its phase ((x + y) mod 2); only: just these parts' kinds (no
    inner wall), e.g. FRAME; skip: all but these (e.g. STRUTS: what shows where they are shot away)."""
    H = W.hull_top() if H is None else H
    tile = _tile(margin)
    rel = T.Relief(f"ext_stripped_{HO.name(key)}_{phase}{'_' + '_'.join(sorted(only)) if only else ''}{'_no_' + '_'.join(sorted(skip)) if skip else ''}")
    for stretch in HO.parse(key):
        for g, before, after in HO.groups(stretch):
            inner, _ = _planes(g, before, after, H, tile, CAVITY)
            if only is None:
                _emit(rel, inner, "wall", CAVITY)
            solid, fronts = _planes(g, before, after, H, tile)
            for f, (s, c, w) in zip(g, fronts):
                side = _Side(s, c, w, H)
                clip = solid + [_lift(HO.nearer(f, h)) for h in g if h is not f]
                rim = clip + [(-s, -(c - 2 * FRAME_W * s.length))]   # (the outline frame: the foot only; bars at the
                if (only is None or "frame" in only) and "frame" not in skip:                        # bend and the lean's top read as rails)
                    _emit(rel, rim + [(UP, FRAME_W), (-UP, 0.0)], "frame", 0.0)
                for planes, depth, kind in _parts(side, phase):
                    if (only is None or kind in only) and kind not in skip:
                        _emit(rel, clip + planes, kind, depth)
    return rel.build()
