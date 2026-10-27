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


# ---- v2, after the user's reference: a light pillar, a wall box light, a floor grille light ----------------------

def pillar():
    """Replaces the lamp post: a short square column, slatted light panels on all four faces, on a base with lit feet."""
    m = core.Mesh("lc_pillar")
    m.box((0, 0, 0), (0.5, 0.5, 0.03), "gmD", top="gm", base=True, bevel=0.01)              # base plate
    for sx in (-1, 1):                                                                 # four feet at the corners
        for sy in (-1, 1):
            m.box((sx * 0.22, sy * 0.22, 0.0), (0.14, 0.14, 0.05), "navy", top="steel", base=True, rz=0.785)
            m.box((sx * 0.27, sy * 0.27, 0.05), (0.07, 0.02, 0.012), "cyan", base=True, rz=-0.785 * sx * sy)
    m.box((0, 0, 0.03), (0.34, 0.34, 0.66), "navy", top="gmD", base=True)                  # the core
    for sx in (-1, 1):                                                                 # corner posts
        for sy in (-1, 1):
            m.box((sx * 0.17, sy * 0.17, 0.03), (0.06, 0.06, 0.68), "steelD", top="steelL", base=True)
    for ax, d in (("x", 1), ("x", -1), ("y", 1), ("y", -1)):                           # light panes on each face
        o = 0.172 * d
        c = (o, 0, 0.1) if ax == "x" else (0, o, 0.1)
        size = (0.012, 0.26, 0.56) if ax == "x" else (0.26, 0.012, 0.56)
        m.box(c, size, "arc", base=True)
        cs = (o * 1.04, 0, 0.1) if ax == "x" else (0, o * 1.04, 0.1)                   # a dark divider down the middle
        m.box(cs, (0.014, 0.035, 0.56) if ax == "x" else (0.035, 0.014, 0.56), "navy", base=True)
        for k in range(1, 4):                                                          # and three bars across
            z = 0.1 + k * 0.14
            cs = (o * 1.04, 0, z) if ax == "x" else (0, o * 1.04, z)
            m.box(cs, (0.014, 0.27, 0.03) if ax == "x" else (0.27, 0.014, 0.03), "navy", base=True)
    m.box((0, 0, 0.69), (0.42, 0.42, 0.04), "steel", top="steelL", base=True, bevel=0.012)   # cap
    m.box((0, 0, 0.73), (0.26, 0.26, 0.01), "gmD", base=True)                                 # its dark inset
    return [m.build()]


def wall_box(context=True):
    """A wall light: a pale box fixture on the back wall, two light bars across its front, a slot of light on top."""
    m = core.Mesh("lc_wall_box")
    if context:
        _wall(m)
    m.box((0, -0.39, 1.05), (0.8, 0.22, 0.36), "lvW2", top="lvW", base=True, bevel=0.03)    # housing
    m.box((0, -0.275, 1.09), (0.7, 0.012, 0.28), "steelD", base=True)                       # front recess
    for z in (1.11, 1.25):
        m.box((0, -0.27, z), (0.66, 0.014, 0.08), "arc", base=True)                          # two light bars
    m.box((0, -0.4, 1.41), (0.56, 0.07, 0.008), "cyan", base=True)                          # a slot of light on top
    return [m.build()]


def floor_grille():
    """A floor light: a recessed grille, a grid of small glowing crosses, lit corner ticks."""
    m = core.Mesh("lc_floor_grille")
    m.box((0, 0, 0), (0.84, 0.84, 0.012), "steelD", top="steel", base=True)                  # lip
    m.box((0, 0, 0.012), (0.72, 0.72, 0.006), "navy", base=True)                            # recessed well
    for i in range(3):
        for j in range(3):
            x, y = (i - 1) * 0.2, (j - 1) * 0.2
            m.box((x, y, 0.018), (0.1, 0.025, 0.006), "arc", base=True)                     # a cross of light
            m.box((x, y, 0.018), (0.025, 0.1, 0.006), "arc", base=True)
    for sx in (-1, 1):                                                                 # corner ticks
        for sy in (-1, 1):
            m.box((sx * 0.33, sy * 0.33, 0.018), (0.06, 0.02, 0.006), "cyan", base=True)
            m.box((sx * 0.33, sy * 0.33, 0.018), (0.02, 0.06, 0.006), "cyan", base=True)
    return [m.build()]


SPRITES = [(f"concept.{n}", (1, 1), "prop", fn) for n, fn in (
    ("floor_panel", floor_panel), ("floor_disc", floor_disc), ("floor_strips", floor_strips),
    ("wall_bar", wall_bar), ("wall_cove", wall_cove), ("wall_sconce", wall_sconce),
    ("pillar", pillar), ("wall_box", wall_box), ("floor_grille", floor_grille))]
SPRITES.append(("concept.wall_box_bare", (1, 1), "prop", lambda: wall_box(context=False)))
