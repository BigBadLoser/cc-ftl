"""Scratch concepts for the lamp redesign (a review family, not in RENDERED, so `npm run sprites` skips it): floor lights
and wall sconces, a stand-in wall behind the sconces for context. Grid frame, origin = tile centre at floor level; the
back wall runs along x at y = -0.5."""
from . import core


def _wall(m):
    m.box((0, -0.62, 0), (1.0, 0.24, 1.85), "wallM", top="wallD", base=True)               # stand-in wall (context only)


def floor_panel():
    m = core.Mesh("lc_floor_panel")
    m.box((0, 0, 0), (0.74, 0.74, 0.014), "steelD", top="steel", base=True)                # frame
    m.box((0, 0, 0.014), (0.6, 0.6, 0.008), "arc", base=True)                             # the glowing panel
    for a in (0.0,):
        m.box((0, a, 0.022), (0.6, 0.04, 0.006), "steelD", base=True)                     # mullions
        m.box((a, 0, 0.022), (0.04, 0.6, 0.006), "steelD", base=True)
    return [m.build()]


def floor_disc():
    m = core.Mesh("lc_floor_disc")
    m.cyl((0, 0, 0), 0.3, 0.014, "gmD", sides=20, top="gmD")                               # bezel
    m.cyl((0, 0, 0.014), 0.24, 0.006, "steelL", sides=20)                                  # trim ring
    m.cyl((0, 0, 0.02), 0.19, 0.008, "arc", sides=20)                                      # the lens
    return [m.build()]


def floor_strips():
    m = core.Mesh("lc_floor_strips")
    m.box((0, 0, 0), (0.86, 0.5, 0.012), "gmD", top="gmD", base=True)                     # recessed channel
    for b in (-0.14, 0.14):
        m.box((0, b, 0.012), (0.82, 0.07, 0.008), "arc", base=True)                       # two light strips
    return [m.build()]


def wall_bar(context=True):
    m = core.Mesh("lc_wall_bar")
    if context:
        _wall(m)
    m.box((0, -0.47, 0.55), (0.14, 0.06, 0.9), "gm", top="steel", base=True, bevel=0.01)   # housing
    m.box((0, -0.435, 0.6), (0.07, 0.02, 0.8), "arc", base=True)                          # vertical light bar
    return [m.build()]


def wall_cove(context=True):
    m = core.Mesh("lc_wall_cove")
    if context:
        _wall(m)
    m.box((0, -0.45, 1.5), (0.8, 0.1, 0.08), "gm", top="steel", base=True, bevel=0.01)    # a shelf near the top
    m.box((0, -0.43, 1.46), (0.74, 0.07, 0.04), "arc", base=True)                         # light under it
    m.box((0, -0.47, 1.25), (0.74, 0.02, 0.2), "arc", base=True)                          # its wash on the wall
    return [m.build()]


def wall_sconce(context=True):
    m = core.Mesh("lc_wall_sconce")
    if context:
        _wall(m)
    m.box((0, -0.47, 1.05), (0.1, 0.06, 0.34), "gmD", base=True)                          # mount plate
    m.box((0, -0.38, 1.18), (0.32, 0.18, 0.12), "gm", top="steelL", base=True, bevel=0.015, rx=-0.25)   # angled head
    m.box((0, -0.36, 1.16), (0.26, 0.14, 0.02), "arc", base=True, rx=-0.25)              # its lens, facing down
    return [m.build()]


SPRITES = [(f"concept.{n}", (1, 1), "prop", fn) for n, fn in (
    ("floor_panel", floor_panel), ("floor_disc", floor_disc), ("floor_strips", floor_strips),
    ("wall_bar", wall_bar), ("wall_cove", wall_cove), ("wall_sconce", wall_sconce))]
