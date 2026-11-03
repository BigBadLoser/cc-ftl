"""Airlock (module.airlock), inboard: the unloaders either side of the pod, the keep-out squares in front of their chutes
and the walk zone's corner marks. Built in the module frame of airlock.py, which renders them (items)."""

from . import core
from .airlock import (CREAM, CREAM_D, CREAM_S, CREAM_T, RED, SLATE, SLATE_K, SLATE_L, SLATE_T, _clip, frame,
                      prism)

UV, UHW = 1.0, 0.3                 # unloader centre v (built on the +v side; symmetric), half width
CW, CU0, CU1, CB = 0.23, -1.46, -1.06, -1.12   # chute: inner half width, mouth, back of the frame, inner back wall
UNLOADER = (                       # (u/z outline, v0, v1 about UV, body, top)
    ([(-0.3, 0), (-0.3, 0.5), (-0.04, 0.68), (0.36, 0.68), (0.46, 0.58), (0.46, 0)], -UHW, UHW, CREAM, CREAM_T),
    ([(-1.06, 0), (-1.06, 0.5), (-0.3, 0.5), (-0.3, 0)], 0.02 - UHW, UHW - 0.02, CREAM, CREAM_T),     # body
    ([(CU0, 0), (CU0, 0.5), (CU1, 0.5), (CU1, 0)], -UHW - 0.01, -CW, SLATE_T, SLATE_L),              # chute walls
    ([(CU0, 0), (CU0, 0.5), (CU1, 0.5), (CU1, 0)], CW, UHW + 0.01, SLATE_T, SLATE_L),
    ([(CU0, 0.41), (CU0, 0.5), (CU1, 0.5), (CU1, 0.41)], -CW, CW, SLATE_T, SLATE_L),                # roof
    ([(CU0, 0), (CU0, 0.07), (CU1, 0.07), (CU1, 0)], -CW, CW, SLATE_K, SLATE),                      # floor sill
    ([(CB, 0.07), (CB, 0.41), (CU1, 0.41), (CU1, 0.07)], -CW, CW, SLATE, SLATE),                    # back wall
    ([(-1.42, 0.5), (-1.32, 0.88), (-0.98, 0.88), (-0.9, 0.5)], -UHW, UHW, CREAM, CREAM_T),         # hood
)


def _unloader_details():
    """(u, v, z, su, sv, sz, colour) boxes on the unloader."""
    out = [(0.16, UV, 0.68, 0.3, 0.42, 0.02, CREAM_D),                                             # top panel
           (0.16, UV - 0.1, 0.7, 0.05, 0.05, 0.006, CREAM_S), (0.16, UV + 0.1, 0.7, 0.05, 0.05, 0.006, CREAM_S),
           (0.465, UV, 0.04, 0.01, 2 * UHW - 0.06, 0.08, RED),                                     # back base red
           (CB - 0.006, UV, 0.16, 0.01, 2 * CW - 0.06, 0.03, SLATE_K),                              # chute inside:
           (CB - 0.006, UV, 0.28, 0.01, 2 * CW - 0.06, 0.03, SLATE_K),                              # back wall slats
           (-1.3, UV, 0.395, 0.2, 2 * CW - 0.14, 0.012, "glassL"),                                 # light panel
           (CU0 - 0.004, UV, 0.44, 0.012, 2 * CW + 0.04, 0.03, SLATE_L)]                           # mouth lip
    out += [(u, UV, 0.07, 0.045, 2 * CW - 0.04, 0.03, "steelL") for u in (-1.41, -1.33, -1.25, -1.17)]   # rollers
    out += [(-1.38, UV, 0.56, 0.03, 2 * UHW - 0.18, 0.22, "dark"),                                # hood visor
            (-1.4, UV - 0.06, 0.66, 0.012, 0.05, 0.03, "lampY"), (-1.4, UV + 0.04, 0.7, 0.012, 0.05, 0.03, "lampY"),
            (-1.4, UV - 0.02, 0.6, 0.012, 0.05, 0.03, "lampY")]
    for s in (-1, 1):
        sv = UV + s * (UHW + 0.004)
        out += [(0.08, sv, 0.04, 0.72, 0.008, 0.08, RED),                                         # base red
                (-1.12, sv, 0.6, 0.18, 0.008, 0.06, RED)]                                         # hood red
        out += [(-0.98 + k * 0.07, UV + s * (UHW - 0.016), 0.1, 0.035, 0.008, 0.2, "dark") for k in range(4)]  # vents
        out += [(-0.45, UV + s * (UHW - 0.016), 0.36, 0.3, 0.008, 0.025, CREAM_S)]
    return out


def _crate(f):
    """A cargo crate on the chute's rollers, standing half out of the mouth so it reads from the camera: larger than the
    game's crate (rust body, steel corner posts, a mid band and a hazard-yellow top strap, a lit tag)."""
    cu, su, sv, sz, z0 = CU0 - 0.1, 0.42, 0.46, 0.36, 0.08
    f.box(cu, UV, z0, su, sv, sz, "rust", top="rustD")
    for du in (-1, 1):
        for dv in (-1, 1):
            f.box(cu + du * (su / 2 - 0.025), UV + dv * (sv / 2 - 0.025), z0, 0.06, 0.06, sz + 0.01, "steelL",
                  top="steelL")
    f.box(cu, UV, z0 + sz * 0.45, su + 0.012, sv + 0.012, 0.04, "steelL", top="steelL")
    f.box(cu, UV, z0 + sz, su * 0.9, 0.08, 0.012, "hazY", top="hazY")
    f.box(cu - su / 2 - 0.004, UV, z0 + sz * 0.7, 0.012, 0.12, 0.08, "lampY", top="lampY")


def unloader(rot, half, loaded=False):
    """An unloader along u at v = 1 (the -v side is the same sprite), cut at u = -0.5 into its two tiles: a taller
    back block against the hull, a lower body with vents, and at the inboard end a hollow slate chute open toward the
    keep-out square (a roller bed on its floor, a light panel overhead, a slatted back wall) under a hood with a dark
    visor and amber lights; red trim low on the sides and on the hood. loaded: a crate sits on the rollers (the front
    half only)."""
    m = core.Mesh(f"airlock_unloader_{rot}_{half}_{int(loaded)}")
    f = frame(m, rot)
    lo, hi = (-0.5, 0.5) if half == "back" else (-1.5, -0.5)
    for shape, v0, v1, col, top in UNLOADER:
        part = _clip(shape, lo, hi)
        if len(part) >= 3:
            prism(f, part, UV + v0, UV + v1, col, top)
    for u, v, z, su, sv, sz, col in _unloader_details():
        if lo <= u < hi:
            f.box(u, v, z, su, sv, sz, col, top=col)
    if loaded:
        _crate(f)
    return [m.build()]


def keepout(rot):
    """The keep-out square in front of a chute (built on the tile at u -2, v 1): a faint painted outline with muted rust-hazard
    corner brackets, inset. Paint on the deck (no plate), low contrast against the floor."""
    m = core.Mesh(f"airlock_keepout_{rot}")
    f = frame(m, rot)
    uc, vc, ins, ln, bw, z = -2.0, UV, 0.07, 0.2, 0.03, 0.004
    lo, hi = -0.5 + ins, 0.5 - ins
    for e in (lo + bw / 2, hi - bw / 2):
        f.box(uc + e, vc, 0, bw, hi - lo, z, "steel", top="steel")
        f.box(uc, vc + e, 0, hi - lo, bw, z, "steel", top="steel")
    for su in (-1, 1):
        for sv in (-1, 1):
            cu, cv = uc + su * (hi - bw / 2), vc + sv * (hi - bw / 2)
            f.box(cu - su * ln / 2, cv, 0, ln, bw * 1.8, z * 1.5, "rust", top="rust")
            f.box(cu, cv - sv * ln / 2, 0, bw * 1.8, ln, z * 1.5, "rust", top="rust")
    return [m.build()]


def walk(rot):
    """The walk zone's marks (built on the tile at u -1, v 0): a faint steel-grey L at each corner. Paint on the deck."""
    m = core.Mesh(f"airlock_walk_{rot}")
    f = frame(m, rot)
    uc, ins, ln, bw, z = -1.0, 0.08, 0.2, 0.035, 0.004
    for su in (-1, 1):
        for sv in (-1, 1):
            cu, cv = uc + su * (0.5 - ins), sv * (0.5 - ins)
            f.box(cu - su * ln / 2, cv, 0, ln, bw, z, "steel", top="steel")
            f.box(cu, cv - sv * ln / 2, 0, bw, ln, z, "steel", top="steel")
    return [m.build()]
