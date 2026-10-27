"""Scratch concepts for the lamp redesign (a review family, not in RENDERED, so `npm run sprites` skips it): floor lights
and wall sconces, a stand-in wall behind the sconces for context. Grid frame, origin = tile centre at floor level; the
back wall runs along x at y = -0.5."""
import math

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


# ---- v3, after review: a slim core with panels standing off it; a sloped wall light; a thin grate floor light ------

def _prism(m, x0, x1, prof, col, top=None):
    """An extrusion along x from x0 to x1 of the (y, z) profile `prof` (counter-clockwise seen from +x)."""
    n = len(prof)
    for k in range(n):
        (ya, za), (yb, zb) = prof[k], prof[(k + 1) % n]
        face = top if (top and zb == za and za == max(z for _, z in prof)) else col
        m.poly([core.G(x0, ya, za), core.G(x0, yb, zb), core.G(x1, yb, zb), core.G(x1, ya, za)], face)
    m.poly([core.G(x1, y, z) for y, z in prof], col)
    m.poly([core.G(x0, y, z) for y, z in prof][::-1], col)


def pillar_v3():
    """The light pillar: a slim dark core, four framed window panels standing off it on brackets, in a lit well."""
    m = core.Mesh("lc_pillar_v3")
    m.box((0, 0, 0), (0.58, 0.58, 0.012), "steelD", top="gm", base=True)                    # well lip
    m.box((0, 0, 0.004), (0.5, 0.5, 0.01), "navy", base=True)                               # recessed well
    for a in (0.785, -0.785):                                                          # X-shaped feet
        m.box((0, 0, 0.012), (0.6, 0.08, 0.04), "gmD", top="steel", base=True, rz=a)
    for sx in (-1, 1):                                                                 # glow at the feet's ends
        for sy in (-1, 1):
            m.box((sx * 0.2, sy * 0.2, 0.052), (0.05, 0.05, 0.008), "cyan", base=True)
    m.box((0, 0, 0.05), (0.16, 0.16, 0.66), "navy", top="gmD", base=True)                  # the slim core
    m.box((0, 0, 0.7), (0.22, 0.22, 0.04), "steel", top="steelL", base=True, bevel=0.01)    # core cap
    for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):                                  # four panels standing off it
        cx, cy = ux * 0.17, uy * 0.17
        sz = lambda w, t, h: (t, w, h) if ux else (w, t, h)                            # noqa: E731  w along the face
        m.box((cx, cy, 0.14), sz(0.26, 0.05, 0.5), "navy", top="gm", base=True)          # panel frame
        m.box((cx + ux * 0.028, cy + uy * 0.028, 0.17), sz(0.2, 0.006, 0.44), "arc", base=True)   # the window
        m.box((cx + ux * 0.032, cy + uy * 0.032, 0.17), sz(0.02, 0.006, 0.44), "navy", base=True)   # mullions: 2 x 3 panes
        for z in (0.31, 0.46):
            m.box((cx + ux * 0.032, cy + uy * 0.032, z), sz(0.2, 0.006, 0.02), "navy", base=True)
        for z in (0.2, 0.56):                                                          # brackets to the core
            m.box((ux * 0.11, uy * 0.11, z), sz(0.06, 0.08, 0.04), "steelL", base=True)
    return [m.build()]


def wall_slope(context=True):
    """The wall light: a wedge on the wall, its front sloping up to the wall, two light bars on the slope."""
    m = core.Mesh("lc_wall_slope")
    if context:
        _wall(m)
    yb, yf, z0, z1 = -0.5, -0.27, 1.0, 1.3
    prof = [(yb, z0), (yf, z0), (yf, z0 + 0.05), (yb + 0.05, z1), (yb, z1)]           # (y, z), wall at yb
    _prism(m, -0.38, 0.38, prof, "steelL", top="plate")
    _prism(m, -0.42, -0.38, prof, "gm")                                                # end caps
    _prism(m, 0.38, 0.42, prof, "gm")
    (y0, za), (y1, zb) = (yf, z0 + 0.05), (yb + 0.05, z1)
    ang = math.atan2(y0 - y1, zb - za)                                                 # tilt of the slope
    nrm = (math.cos(ang), math.sin(ang))                                               # its outward normal (y, z)
    for f in (0.3, 0.72):                                                              # two bars along the slope
        yc, zc = y0 + (y1 - y0) * f + nrm[0] * 0.006, za + (zb - za) * f + nrm[1] * 0.006
        m.box((0, yc, zc), (0.68, 0.01, 0.07), "arc", rx=ang)
    m.box((0, yf + 0.004, z0 + 0.012), (0.72, 0.01, 0.025), "cyan")                    # a thin glow along the lip
    return [m.build()]


def floor_grate():
    """The floor light: a dark well under a thin grate, small lights in a 3 x 3 pattern of its cells, a slim steel lip."""
    m = core.Mesh("lc_floor_grate")
    m.box((0, 0, 0), (0.8, 0.8, 0.01), "steelD", top="steel", base=True)                   # slim lip
    m.box((0, 0, 0.004), (0.72, 0.72, 0.008), "navy", base=True)                          # dark well
    n, w = 6, 0.72
    cell = w / n
    for i in range(n):                                                                 # small lights in every other cell
        for j in range(n):
            if i % 2 == 1 and j % 2 == 1:
                m.box((-w / 2 + (i + 0.5) * cell, -w / 2 + (j + 0.5) * cell, 0.008), (0.07, 0.07, 0.006), "arc", base=True)
    for k in range(n + 1):                                                             # thin grate bars both ways
        o = -w / 2 + k * cell
        m.box((o, 0, 0.012), (0.018, w, 0.006), "gmD", base=True)
        m.box((0, o, 0.012), (w, 0.018, 0.006), "gmD", base=True)
    return [m.build()]


# ---- v4, after review in art pixels (1 px is about 0.028 tile along a grid axis) ------------------------------------
PX = 0.028


def pillar_v4():
    """The light pillar: the core 2 px wider each side than v3, the four panels standing off it on brackets."""
    m = core.Mesh("lc_pillar_v4")
    m.box((0, 0, 0), (0.62, 0.62, 0.012), "steelD", top="gm", base=True)                    # well lip
    m.box((0, 0, 0.004), (0.54, 0.54, 0.01), "navy", base=True)                             # recessed well
    for a in (0.785, -0.785):                                                          # X-shaped feet
        m.box((0, 0, 0.012), (0.64, 0.08, 0.04), "gmD", top="steel", base=True, rz=a)
    for sx in (-1, 1):                                                                 # glow at the feet's ends
        for sy in (-1, 1):
            m.box((sx * 0.215, sy * 0.215, 0.052), (0.05, 0.05, 0.008), "cyan", base=True)
    core_w = 0.16 + 4 * PX                                                             # 0.27: 2 px more each side
    h = core_w / 2
    m.box((0, 0, 0.05), (core_w, core_w, 0.66), "navy", top="gmD", base=True)             # the core
    m.box((0, 0, 0.7), (core_w + 0.06, core_w + 0.06, 0.04), "steel", top="steelL", base=True, bevel=0.01)   # cap
    off = h + 0.06                                                                     # panel centre, clear of the core
    for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):                                  # four panels standing off it
        cx, cy = ux * off, uy * off
        sz = lambda w, t, z: (t, w, z) if ux else (w, t, z)                            # noqa: E731  w along the face
        m.box((cx, cy, 0.14), sz(0.28, 0.05, 0.5), "navy", top="gm", base=True)          # panel frame
        m.box((cx + ux * 0.028, cy + uy * 0.028, 0.17), sz(0.22, 0.006, 0.44), "arc", base=True)   # the window
        m.box((cx + ux * 0.032, cy + uy * 0.032, 0.17), sz(PX, 0.006, 0.44), "navy", base=True)   # mullions: 2 x 3 panes
        for z in (0.31, 0.46):
            m.box((cx + ux * 0.032, cy + uy * 0.032, z), sz(0.22, 0.006, PX), "navy", base=True)
        for z in (0.2, 0.56):                                                          # brackets to the core
            m.box((ux * (h + 0.012), uy * (h + 0.012), z), sz(0.06, 0.04, 0.04), "steelL", base=True)
    return [m.build()]


def wall_v4(context=True):
    """The wall light: the v2 box (vertical front, two light bars) with its top sloping up a little to the wall."""
    m = core.Mesh("lc_wall_v4")
    if context:
        _wall(m)
    yb, yf, z0, z1 = -0.5, -0.28, 1.05, 1.41
    prof = [(yb, z0), (yf, z0), (yf, z1 - 0.07), (yb, z1)]                              # top: 0.07 rise to the wall
    _prism(m, -0.4, 0.4, prof, "lvW2", top="lvW")
    m.box((0, yf + 0.005, 1.09), (0.7, 0.012, 0.24), "steelD", base=True)                  # front recess
    for z in (1.11, 1.22):
        m.box((0, yf + 0.011, z), (0.66, 0.014, 0.07), "arc", base=True)                   # two light bars
    ang = math.atan2(0.07, yf - yb)                                                    # a slot of light on the slope
    m.box((0, (yb + yf) / 2 + 0.02, z1 - 0.035 + 0.006), (0.56, 0.06, 0.006), "cyan", rx=-ang)
    return [m.build()]


def floor_v4():
    """The floor light: a 5 x 5 grate of 1 px bars over a dark well, a small light in every cell, a slim lip."""
    m = core.Mesh("lc_floor_v4")
    m.box((0, 0, 0), (0.8, 0.8, 0.01), "steelD", top="steel", base=True)                   # slim lip
    m.box((0, 0, 0.004), (0.72, 0.72, 0.008), "navy", base=True)                          # dark well
    n, w = 5, 0.72
    cell = w / n
    for i in range(n):
        for j in range(n):
            m.box((-w / 2 + (i + 0.5) * cell, -w / 2 + (j + 0.5) * cell, 0.008), (0.06, 0.06, 0.006), "arc", base=True)
    for k in range(n + 1):                                                             # 1 px grate bars both ways
        o = -w / 2 + k * cell
        m.box((o, 0, 0.012), (PX, w, 0.006), "gmD", base=True)
        m.box((0, o, 0.012), (w, PX, 0.006), "gmD", base=True)
    return [m.build()]


SPRITES = [(f"concept.{n}", (1, 1), "prop", fn) for n, fn in (
    ("floor_panel", floor_panel), ("floor_disc", floor_disc), ("floor_strips", floor_strips),
    ("wall_bar", wall_bar), ("wall_cove", wall_cove), ("wall_sconce", wall_sconce),
    ("pillar", pillar), ("wall_box", wall_box), ("floor_grille", floor_grille))]
SPRITES.append(("concept.wall_box_bare", (1, 1), "prop", lambda: wall_box(context=False)))
SPRITES += [("concept.pillar_v3", (1, 1), "prop", pillar_v3), ("concept.wall_slope", (1, 1), "prop", lambda: wall_slope(False)),
            ("concept.floor_grate", (1, 1), "prop", floor_grate)]
def floor_v4b():
    """v4 with the cells themselves lit pale blue (a grate over light): 5 x 5, 1 px bars, a brighter dot in each cell."""
    m = core.Mesh("lc_floor_v4b")
    m.box((0, 0, 0), (0.8, 0.8, 0.01), "steelD", top="steel", base=True)                   # slim lip
    m.box((0, 0, 0.004), (0.72, 0.72, 0.008), "glassL", base=True)                        # pale lit well
    n, w = 5, 0.72
    cell = w / n
    for i in range(n):
        for j in range(n):
            m.box((-w / 2 + (i + 0.5) * cell, -w / 2 + (j + 0.5) * cell, 0.008), (PX, PX, 0.006), "arc", base=True)
    for k in range(n + 1):                                                             # 1 px grate bars both ways
        o = -w / 2 + k * cell
        m.box((o, 0, 0.012), (PX, w, 0.006), "navy", base=True)
        m.box((0, o, 0.012), (w, PX, 0.006), "navy", base=True)
    return [m.build()]


SPRITES += [("concept.pillar_v4", (1, 1), "prop", pillar_v4), ("concept.wall_v4", (1, 1), "prop", lambda: wall_v4(False)),
            ("concept.floor_v4", (1, 1), "prop", floor_v4)]
SPRITES.append(("concept.floor_v4b", (1, 1), "prop", floor_v4b))


# ---- v5, own designs: three pillars, three wall lights, three floor lights -------------------------------------------

def _well(m, r=0.6):
    m.box((0, 0, 0), (r, r, 0.012), "steelD", top="gm", base=True)                          # base plate
    m.box((0, 0, 0.012), (r - 0.08, r - 0.08, 0.02), "gmD", top="navy", base=True)          # plinth


def pillar_beacon():
    """A tapered column, a tall light slit on each face, a glowing band under a flat cap."""
    m = core.Mesh("lc_p_beacon")
    _well(m, 0.5)
    m.box((0, 0, 0.03), (0.3, 0.3, 0.6), "navy", top="gmD", base=True, taper=0.8)          # tapered column
    for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):                                  # a slit on each face
        d = 0.138
        m.box((ux * d, uy * d, 0.12), (0.012, 0.07, 0.4) if ux else (0.07, 0.012, 0.4), "arc", base=True)
    m.box((0, 0, 0.63), (0.27, 0.27, 0.05), "cyan", base=True)                              # glowing band
    m.box((0, 0, 0.68), (0.34, 0.34, 0.04), "steel", top="steelL", base=True, bevel=0.01)   # cap
    return [m.build()]


def pillar_rods():
    """A dark core with four glowing rods at its corners, held top and bottom by a thin square cage."""
    m = core.Mesh("lc_p_rods")
    _well(m, 0.52)
    m.box((0, 0, 0.03), (0.2, 0.2, 0.66), "navy", top="gmD", base=True)                    # core
    for z in (0.06, 0.66):                                                             # cage rings
        m.box((0, 0, z), (0.36, 0.36, 0.04), "steel", top="steelL", base=True)
        m.box((0, 0, z), (0.28, 0.28, 0.045), "navy", base=True)                           # (hollow look)
    for sx in (-1, 1):                                                                 # corner rods
        for sy in (-1, 1):
            m.box((sx * 0.15, sy * 0.15, 0.1), (0.05, 0.05, 0.56), "arc", base=True)
    m.box((0, 0, 0.7), (0.22, 0.22, 0.03), "gmD", top="cyan", base=True)                   # lit top disc
    return [m.build()]


def pillar_bands():
    """A dark core ringed by three bands of light between steel collars, on a wide foot."""
    m = core.Mesh("lc_p_bands")
    _well(m, 0.56)
    m.box((0, 0, 0.03), (0.4, 0.4, 0.06), "gm", top="steel", base=True, bevel=0.01)        # foot
    m.box((0, 0, 0.09), (0.24, 0.24, 0.6), "navy", base=True)                              # core
    for k in range(3):                                                                 # light bands and collars
        z = 0.14 + k * 0.17
        m.box((0, 0, z), (0.28, 0.28, 0.08), "arc", base=True)
        m.box((0, 0, z + 0.08), (0.3, 0.3, 0.04), "steelD", top="steel", base=True)
    m.box((0, 0, 0.69), (0.3, 0.3, 0.03), "steel", top="steelL", base=True)                 # top
    return [m.build()]


def wall_capsule(context=False):
    """A glowing tube lying along the wall in a two-arm cradle."""
    m = core.Mesh("lc_w_capsule")
    if context:
        _wall(m)
    m.box((0, -0.47, 1.08), (0.7, 0.06, 0.22), "gmD", top="gm", base=True)                # back plate
    for x in (-0.3, 0.3):                                                              # cradle arms
        m.box((x, -0.38, 1.1), (0.06, 0.16, 0.16), "steel", top="steelL", base=True)
    for k in range(6):                                                                 # the tube, as a faceted prism
        a = k * math.pi / 3
        y, z = -0.36 + 0.06 * math.cos(a), 1.19 + 0.06 * math.sin(a)
        m.box((0, y, z - 0.03), (0.6, 0.06, 0.06), "arc", base=True, rx=a)
    for x in (-0.33, 0.33):                                                            # end caps
        m.box((x, -0.36, 1.12), (0.04, 0.14, 0.14), "gm", top="steel", base=True)
    return [m.build()]


def wall_louvre(context=False):
    """A box with louvres on its front, angled down, light spilling between them; a slight slope on top."""
    m = core.Mesh("lc_w_louvre")
    if context:
        _wall(m)
    yb, yf, z0, z1 = -0.5, -0.3, 1.02, 1.38
    _prism(m, -0.38, 0.38, [(yb, z0), (yf, z0), (yf, z1 - 0.06), (yb, z1)], "gm", top="steel")
    m.box((0, yf + 0.006, z0 + 0.04), (0.68, 0.01, 0.26), "arc", base=True)               # the light behind
    for k in range(3):                                                                 # three thin louvres, tipped down
        m.box((0, yf + 0.03, z0 + 0.1 + k * 0.08), (0.7, 0.05, 0.01), "steelL", rx=-0.35)
    return [m.build()]


def wall_panel(context=False):
    """A slim upright panel: a vertical light strip down its face, a small status light, a bevelled top."""
    m = core.Mesh("lc_w_panel")
    if context:
        _wall(m)
    yb, yf = -0.5, -0.38
    _prism(m, -0.14, 0.14, [(yb, 0.75), (yf, 0.75), (yf, 1.45), (yb, 1.5)], "lvW2", top="lvW")
    m.box((0, yf + 0.004, 0.82), (0.07, 0.01, 0.56), "arc", base=True)                     # light strip
    m.box((0.08, yf + 0.004, 1.4), (0.03, 0.01, 0.03), "cyan", base=True)                  # status light
    m.box((0, yf + 0.004, 0.77), (0.22, 0.012, 0.025), "steelD", base=True)                # foot trim
    return [m.build()]


def floor_ring():
    """A recessed ring of light round a dark centre plate."""
    m = core.Mesh("lc_f_ring")
    m.box((0, 0, 0), (0.74, 0.74, 0.01), "steelD", top="gm", base=True)
    m.cyl((0, 0, 0.01), 0.3, 0.006, "steelD", sides=24)
    m.cyl((0, 0, 0.012), 0.26, 0.006, "arc", sides=24)                                     # the ring
    m.cyl((0, 0, 0.016), 0.2, 0.006, "navy", top="gmD", sides=24)                          # dark centre
    m.cyl((0, 0, 0.022), 0.04, 0.004, "cyan", sides=8)                                     # pin light
    return [m.build()]


def floor_chevron():
    """A wayfinding plate: a glowing chevron on a dark plate, pointing along the tile's diagonal."""
    m = core.Mesh("lc_f_chevron")
    m.box((0, 0, 0), (0.74, 0.74, 0.01), "steelD", top="navy", base=True)
    th = -math.pi / 4                                                                  # along the tile's diagonal:
    rot = lambda x, y: (x * math.cos(th) - y * math.sin(th), x * math.sin(th) + y * math.cos(th))   # noqa: E731
    tip = rot(0.17, 0.0)                                                               # it reads as an arrow on screen
    for side in (-1, 1):                                                               # the chevron's two arms
        x0, y0 = rot(-0.1, side * 0.2)
        L = math.hypot(tip[0] - x0, tip[1] - y0)
        a = math.atan2(tip[1] - y0, tip[0] - x0)
        m.box(((x0 + tip[0]) / 2, (y0 + tip[1]) / 2, 0.01), (L + 0.05, 0.07, 0.008), "arc", base=True, rz=a)
    for side in (-1, 1):
        m.box((-0.3, side * 0.3, 0.01), (0.05, 0.05, 0.006), "cyan", base=True)            # corner pins
    return [m.build()]


def floor_studs():
    """A plain deck plate edged with a fine light line, a glowing stud at each corner."""
    m = core.Mesh("lc_f_studs")
    m.box((0, 0, 0), (0.78, 0.78, 0.01), "steelD", top="gm", base=True)
    m.box((0, 0, 0.01), (0.66, 0.66, 0.004), "arc", base=True)                             # fine light line
    m.box((0, 0, 0.012), (0.62, 0.62, 0.004), "gmD", base=True)                            # plate inside it
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl((sx * 0.3, sy * 0.3, 0.014), 0.04, 0.012, "cyan", sides=8)               # corner studs
    return [m.build()]


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (
    pillar_beacon, pillar_rods, pillar_bands, wall_capsule, wall_louvre, wall_panel, floor_ring, floor_chevron, floor_studs)]
SPRITES += [(f"concept.{fn.__name__}.ctx", (1, 1), "prop", lambda fn=fn: fn(True)) for fn in (wall_capsule, wall_louvre, wall_panel)]


# ---- v6, a second set of own designs ----------------------------------------------------------------------------

def pillar_hex():
    """A hexagonal lantern: glowing faces, dark ribs on its edges, a hex cap and foot."""
    m = core.Mesh("lc_p_hex")
    _well(m, 0.5)
    m.cyl((0, 0, 0.03), 0.2, 0.06, "gm", top="steel", sides=6)                              # foot
    m.cyl((0, 0, 0.09), 0.16, 0.5, "arc", sides=6)                                         # glowing body
    for k in range(6):                                                                 # dark ribs on its edges
        a = k * math.pi / 3 + math.pi / 6
        m.box((0.165 * math.cos(a), 0.165 * math.sin(a), 0.09), (0.035, 0.035, 0.5), "navy", base=True, rz=a)
    m.cyl((0, 0, 0.59), 0.2, 0.05, "steel", top="steelL", sides=6)                         # cap
    m.cyl((0, 0, 0.64), 0.1, 0.03, "gmD", top="cyan", sides=6)                              # lit finial
    return [m.build()]


def pillar_split():
    """A split column: four dark quarter-blocks with a cross-shaped slot of light between them, a steel cap."""
    m = core.Mesh("lc_p_split")
    _well(m, 0.52)
    m.box((0, 0, 0.03), (0.3, 0.3, 0.62), "arc", base=True)                                # the light inside
    for sx in (-1, 1):                                                                 # four quarter-blocks
        for sy in (-1, 1):
            m.box((sx * 0.085, sy * 0.085, 0.03), (0.14, 0.14, 0.62), "navy", top="gmD", base=True)
    m.box((0, 0, 0.65), (0.36, 0.36, 0.04), "steel", top="steelL", base=True, bevel=0.01)   # cap
    m.box((0, 0, 0.03), (0.36, 0.36, 0.05), "steelD", top="steel", base=True)               # foot ring
    return [m.build()]


def pillar_core():
    """An energy core: a glowing block held up by four slim prongs on a square plinth."""
    m = core.Mesh("lc_p_core")
    _well(m, 0.54)
    m.box((0, 0, 0.03), (0.36, 0.36, 0.14), "gm", top="steel", base=True, bevel=0.015)      # plinth
    m.box((0, 0, 0.17), (0.2, 0.2, 0.03), "cyan", base=True)                               # a lit ring on the plinth
    for sx in (-1, 1):                                                                 # four slim prongs
        for sy in (-1, 1):
            m.box((sx * 0.15, sy * 0.15, 0.17), (0.03, 0.03, 0.42), "steelD", top="steelL", base=True)
    m.box((0, 0, 0.26), (0.24, 0.24, 0.26), "arc", base=True, bevel=0.03)                   # the glowing core
    m.box((0, 0, 0.59), (0.36, 0.36, 0.03), "steel", top="steelL", base=True)               # top frame
    return [m.build()]


def wall_wedge(context=False):
    """A downlight wedge: a triangular sconce, wide at the top, its underside glowing onto the wall below."""
    m = core.Mesh("lc_w_wedge")
    if context:
        _wall(m)
    yb = -0.5
    _prism(m, -0.26, 0.26, [(yb, 1.32), (yb + 0.24, 1.5), (yb, 1.5)], "steelL", top="plate")  # the wedge
    m.box((0, yb + 0.12, 1.4), (0.46, 0.01, 0.02), "arc", base=True)                       # lit lip along its edge
    for i, w in enumerate((0.34, 0.24, 0.14)):                                         # light fanning down the wall
        m.box((0, yb + 0.01, 1.22 - i * 0.12), (w, 0.01, 0.025), "cyan", base=True)
    return [m.build()]


def wall_pods(context=False):
    """Twin pods: two small square lamps on a short rail, each with a glowing face."""
    m = core.Mesh("lc_w_pods")
    if context:
        _wall(m)
    m.box((0, -0.47, 1.18), (0.66, 0.06, 0.06), "gmD", top="gm", base=True)                # rail
    for x in (-0.18, 0.18):
        m.box((x, -0.38, 1.1), (0.2, 0.14, 0.2), "steel", top="steelL", base=True, bevel=0.02)
        m.box((x, -0.305, 1.13), (0.14, 0.01, 0.14), "arc", base=True)                     # glowing face
    return [m.build()]


def wall_wash():
    """A ceiling wash: a long thin strip high on the wall, light spilling up and down from it."""
    return _wall_wash(False)


def _wall_wash(context):
    m = core.Mesh(f"lc_w_wash{int(context)}")
    if context:
        _wall(m)
    m.box((0, -0.45, 1.62), (0.9, 0.1, 0.08), "gm", top="steel", base=True)                # strip housing
    m.box((0, -0.395, 1.6), (0.86, 0.01, 0.05), "arc", base=True)                          # its light
    m.box((0, -0.49, 1.7), (0.86, 0.01, 0.1), "cyan", base=True)                           # glow on the wall above
    return [m.build()]


def floor_slot():
    """A lane slot: one bar of light across the tile, edge to edge, so a row of them reads as a lit lane."""
    m = core.Mesh("lc_f_slot")
    m.box((0, 0, 0), (1.0, 0.24, 0.01), "steelD", top="gmD", base=True)                     # channel
    m.box((0, 0, 0.01), (0.96, 0.08, 0.006), "arc", base=True)                             # the bar
    return [m.build()]


def floor_quad():
    """Four small round lenses on a dark plate."""
    m = core.Mesh("lc_f_quad")
    m.box((0, 0, 0), (0.6, 0.6, 0.01), "steelD", top="gmD", base=True)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl((sx * 0.14, sy * 0.14, 0.01), 0.08, 0.006, "steel", sides=12)
            m.cyl((sx * 0.14, sy * 0.14, 0.012), 0.055, 0.006, "arc", sides=12)
    return [m.build()]


def floor_diamond():
    """A lit diamond outline turned 45 degrees in the tile (square on screen), a dark plate round it."""
    m = core.Mesh("lc_f_diamond")
    m.box((0, 0, 0), (0.7, 0.7, 0.01), "steelD", top="gmD", base=True)
    for k in range(4):                                                                 # four sides of the diamond
        a = k * math.pi / 2
        cx, cy = 0.17 * math.cos(a + math.pi / 4), 0.17 * math.sin(a + math.pi / 4)
        m.box((cx, cy, 0.01), (0.36, 0.05, 0.006), "arc", base=True, rz=a + 3 * math.pi / 4)
    m.cyl((0, 0, 0.01), 0.04, 0.006, "cyan", sides=8)                                       # centre pin
    return [m.build()]


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (
    pillar_hex, pillar_split, pillar_core, floor_slot, floor_quad, floor_diamond)]
SPRITES += [("concept.wall_wedge.ctx", (1, 1), "prop", lambda: wall_wedge(True)),
            ("concept.wall_pods.ctx", (1, 1), "prop", lambda: wall_pods(True)),
            ("concept.wall_wash.ctx", (1, 1), "prop", lambda: _wall_wash(True))]


# ---- v7: one piece in depth, detailed like the house modules (battery, consoles) --------------------------------

from .modkit import K  # noqa: E402


def _socket(k):
    """A floor socket: a steel lip, a dark well, four corner bolts, a feed cable out to the tile edge."""
    k.box(0, 0, 0.0, 0.74, 0.74, 0.014, "steelD", top="gm", bevel=0.006)
    k.box(0, 0, 0.004, 0.64, 0.64, 0.012, "dark")
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * 0.31, sv * 0.31, 0.014, 0.024, 0.012, "plate", sides=6)
    k.box(-0.42, -0.12, 0.0, 0.2, 0.07, 0.035, "dark", top="gmD")                           # feed cable
    k.box(-0.33, -0.12, 0.0, 0.06, 0.1, 0.05, "steelD", top="steel")                          # its clamp


def _louvred(k, u, v, z, w, h, face, frame, n=3):
    """A lamp window on a side face (face 'u' or 'v', facing +): a frame, a dark recess, n lit slats with 2 px gaps."""
    sz = (lambda a, t, c: (t, a, c)) if face == "u" else (lambda a, t, c: (a, t, c))         # noqa: E731
    du, dv = (1, 0) if face == "u" else (0, 1)
    k.box(u, v, z, *sz(w, 0.05, h), frame, top="steelL", bevel=0.008)                         # frame
    k.box(u + du * 0.026, v + dv * 0.026, z + 0.03, *sz(w - 0.06, 0.006, h - 0.06), "navy")   # dark recess
    gap = 2 * PX
    sh = (h - 0.06 - (n + 1) * gap) / n
    for i in range(n):                                                                 # lit slats
        zz = z + 0.03 + gap + i * (sh + gap)
        k.box(u + du * 0.03, v + dv * 0.03, zz, *sz(w - 0.06 - 2 * PX, 0.008, sh), "cyan" if i == 0 else "arc")


def _pillar_body(k, shell, shellTop, trim, core_col):
    core_w = 0.27
    h = core_w / 2
    k.box(0, 0, 0.014, 0.5, 0.5, 0.1, shell, top=shellTop, bevel=0.02)                      # plinth
    k.box(0, 0, 0.114, 0.38, 0.38, 0.08, "gm", top="gmD", bevel=0.01)                      # lower housing
    for i in range(3):                                                                 # vent slots on two faces
        k.box(0.191, -0.08 + i * 0.08, 0.13, 0.008, 0.05, 0.045, "dark")
        k.box(-0.08 + i * 0.08, 0.191, 0.13, 0.05, 0.008, 0.045, "dark")
    k.box(0, 0, 0.19, core_w, core_w, 0.6, core_col, top="gmD")                            # the core
    for z in (0.34, 0.56):                                                             # panel seams on the core
        k.box(0, 0, z, core_w + 0.008, core_w + 0.008, 0.012, "gmD")
    off = h + 0.03
    for f, (su, sv) in (("u", (1, 0)), ("v", (0, 1))):                                 # the two camera-side panels
        _louvred(k, su * off, sv * off, 0.24, 0.3, 0.48, f, trim)
    for su, sv in ((-1, 0), (0, -1)):                                                  # back panels (frames only)
        k.box(su * off, sv * off, 0.24, *((0.05, 0.3, 0.48) if su else (0.3, 0.05, 0.48)), trim, top="steelL")
    for su in (-1, 1):                                                                 # corner brackets top and bottom
        for sv in (-1, 1):
            for z in (0.2, 0.7):
                k.box(su * (h + 0.005), sv * (h + 0.005), z, 0.05, 0.05, 0.06, "steelD", top="steel")
    k.box(0, 0, 0.79, 0.4, 0.4, 0.05, shell, top=shellTop, bevel=0.015)                     # cap
    k.box(0, 0, 0.84, 0.26, 0.26, 0.03, "gm", top="gmD")                                   # vent block
    for i in range(4):                                                                 # vent grille on top
        k.box(0, -0.09 + i * 0.06, 0.87, 0.2, PX, 0.004, "dark")


def pillar_industrial():
    """Industrial finish: gunmetal shell, hazard edging, a status lamp, an ID plate, a short antenna."""
    k = K("lc_p_ind", (1, 1), 0)
    _socket(k)
    _pillar_body(k, "steel", "steelL", "steel", "navy")
    for i in range(5):                                                                 # hazard band on the plinth
        k.box(-0.18 + i * 0.09, 0.256, 0.035, 0.045, 0.006, 0.06, "hazY")
        k.box(0.256, -0.18 + i * 0.09, 0.035, 0.006, 0.045, 0.06, "hazY")
    k.box(0.252, 0.0, 0.03, 0.006, 0.44, 0.07, "hazK")
    k.box(0.0, 0.252, 0.03, 0.44, 0.006, 0.07, "hazK")
    k.box(0.16, 0.2, 0.84, 0.05, 0.05, 0.04, "green")                                      # status lamp
    k.cyl(-0.15, -0.15, 0.84, 0.012, 0.16, "steelL", sides=6)                              # antenna
    k.cyl(-0.15, -0.15, 1.0, 0.022, 0.02, "red", sides=6)                                  # its tip
    k.box(-0.11, 0.196, 0.13, 0.08, 0.008, 0.05, "lvW")                                    # ID plate
    return k.build()


def pillar_civic():
    """Civic finish: a cream shell with rounded edges, a cyan trim line and a lit crown, no clutter."""
    k = K("lc_p_civ", (1, 1), 0)
    _socket(k)
    _pillar_body(k, "lvW2", "lvW", "lvW2", "gmD")
    k.box(0, 0, 0.09, 0.505, 0.505, 0.014, "cyan")                                         # trim line round the plinth
    k.box(0, 0, 0.83, 0.405, 0.405, 0.008, "cyan")                                         # and round the cap
    k.box(0, 0, 0.87, 0.12, 0.12, 0.03, "arc", bevel=0.01)                                 # lit crown
    return k.build()


SPRITES += [("concept.pillar_industrial", (1, 1), "prop", pillar_industrial),
            ("concept.pillar_civic", (1, 1), "prop", pillar_civic)]


# ---- v8: stronger silhouettes and invented detail, after the wider house set (ai core, cryo pod, reactor, shield) --

def _cable(k, u0, v0, u1, v1):
    """A floor cable from (u0, v0) to (u1, v1), along u then v, with a clamp at the bend."""
    k.box((u0 + u1) / 2, v0, 0.0, abs(u1 - u0) + 0.06, 0.06, 0.03, "dark", top="gmD")
    k.box(u1, (v0 + v1) / 2, 0.0, 0.06, abs(v1 - v0) + 0.06, 0.03, "dark", top="gmD")
    k.box(u1, v0, 0.0, 0.1, 0.1, 0.045, "steelD", top="steel")


def pillar_lumen():
    """A lantern column: a cream base tapering in like the AI core, cream corner posts caging a dark louvred core, a
    cyan seam up the front corner, a service box with three amber lamps, a domed emitter on a rounded cap."""
    k = K("lc_p_lumen", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.54, 0.54, 0.03, "gmD")                                            # dark foot band
    k.box(0, 0, 0.044, 0.52, 0.52, 0.14, "lvW2", top="lvW", bevel=0.03, taper=0.78)        # tapering base
    k.box(0, 0, 0.184, 0.3, 0.3, 0.58, "navy", top="gmD")                                  # the core
    for f, (su, sv) in (("u", (1, 0)), ("v", (0, 1))):
        _louvred(k, su * 0.13, sv * 0.13, 0.22, 0.24, 0.5, f, "gmD")
    for su in (-1, 1):                                                                 # cream corner posts
        for sv in (-1, 1):
            k.box(su * 0.15, sv * 0.15, 0.184, 0.075, 0.075, 0.58, "lvW2", top="lvW", bevel=0.012)
    k.box(0.19, 0.19, 0.22, 0.012, 0.012, 0.5, "cyan")                                    # cyan seam up the front corner
    k.box(0, 0, 0.764, 0.4, 0.4, 0.08, "lvW2", top="lvW", bevel=0.035, taper=0.82)         # rounded cap
    k.cyl(0, 0, 0.844, 0.1, 0.02, "gmD", sides=12)
    k.cyl(0, 0, 0.864, 0.08, 0.05, "arc", sides=12, rtop=0.04)                            # domed emitter
    k.box(-0.08, 0.27, 0.06, 0.18, 0.1, 0.16, "gm", top="steel", bevel=0.01)               # service box on the base
    for i in range(3):
        k.box(-0.13 + i * 0.05, 0.322, 0.16, 0.03, 0.008, 0.03, "orange")                   # three amber lamps
    k.box(-0.08, 0.322, 0.085, 0.12, 0.008, 0.04, "dark")                                  # vent slot
    _cable(k, -0.17, 0.3, -0.5, 0.3)
    return k.build()


def pillar_capsule():
    """A capsule lamp: a ribbed tube of light between a heavy round base (hazard ring) and a round cap, held by two
    spines with cyan seams like the cryo pod, a red beacon on top."""
    k = K("lc_p_capsule", (1, 1), 0)
    _socket(k)
    k.cyl(0, 0, 0.014, 0.28, 0.1, "gm", top="steel", sides=16)                            # heavy base
    for i in range(16):                                                                # hazard ring round it
        a = i * math.tau / 16
        k.box(0.283 * math.cos(a), 0.283 * math.sin(a), 0.03, 0.11, 0.008, 0.06, "hazY" if i % 2 else "hazK",
              rz=a + math.pi / 2)
    k.cyl(0, 0, 0.114, 0.21, 0.06, "lvW2", top="lvW", sides=16)                           # collar
    k.cyl(0, 0, 0.174, 0.14, 0.52, "arc", sides=14)                                        # the light tube
    for j in range(3):                                                                 # steel bands round it
        k.cyl(0, 0, 0.27 + j * 0.14, 0.15, 2 * PX, "steelD", top="steel", sides=14)
    k.cyl(0, 0, 0.174, 0.145, 0.05, "cyan", sides=14)                                      # cyan glow at its foot
    for a in (0.0, math.pi / 2):                                                       # two spines, front right and left
        u, v = 0.19 * math.cos(a + math.pi / 4 - math.pi / 4), 0.19 * math.sin(a)
        u, v = (0.19, 0.0) if a == 0 else (0.0, 0.19)
        su, sv = (0.06, 0.1) if a == 0 else (0.1, 0.06)
        k.box(u, v, 0.174, su, sv, 0.52, "lvW2", top="lvW", bevel=0.012)
        k.box(u + (0.032 if a == 0 else 0), v + (0.032 if a else 0), 0.2, *((0.006, 0.02) if a == 0 else (0.02, 0.006)),
              0.46, "cyan")
    for a in (math.pi, 3 * math.pi / 2):                                               # back spines
        k.box(0.19 * math.cos(a), 0.19 * math.sin(a), 0.174, 0.08, 0.08, 0.52, "lvW2", top="lvW")
    k.cyl(0, 0, 0.694, 0.22, 0.07, "lvW2", top="lvW", sides=16)                           # cap
    k.cyl(0, 0, 0.764, 0.15, 0.04, "gm", top="steel", sides=12, rtop=0.12)
    k.cyl(0.0, 0.0, 0.804, 0.035, 0.05, "red", sides=8)                                    # beacon
    _cable(k, 0.0, -0.28, -0.5, -0.28)
    return k.build()


def pillar_flood():
    """A flood cart: a yellow work-light cart for hangars and docks, two lamp heads tilted down on a mast, a handle,
    a cable reel, stubby wheels."""
    k = K("lc_p_flood", (1, 1), 0)
    for su in (-1, 1):                                                                 # stubby wheels
        for sv in (-1, 1):
            k.box(su * 0.26, sv * 0.2, 0.0, 0.08, 0.12, 0.1, "dark", top="gmD", bevel=0.02)
    k.box(0, 0, 0.06, 0.56, 0.5, 0.26, "hazY", top="ochM", bevel=0.025)                    # yellow body
    k.box(0, 0, 0.06, 0.58, 0.52, 0.05, "gmD")                                             # bumper
    for i in range(4):                                                                 # vents on the front
        k.box(-0.15 + i * 0.1, 0.252, 0.14, 0.06, 0.008, 0.1, "dark")
    k.box(0.18, 0.252, 0.17, 0.08, 0.008, 0.08, "lvW")                                     # rating plate
    k.cyl(-0.29, 0.0, 0.12, 0.1, 0.12, "gm", top="steel", sides=12)                        # cable reel on the side
    k.cyl(-0.29, 0.0, 0.16, 0.11, 0.03, "dark", sides=12)
    k.box(0, -0.2, 0.32, 0.44, 0.04, 0.18, "steelD", top="steel")                          # push handle
    k.box(0, -0.2, 0.48, 0.48, 0.06, 0.04, "dark")
    k.box(0, 0.0, 0.32, 0.07, 0.07, 0.42, "steel", top="steelL")                           # mast
    k.box(0, 0.0, 0.7, 0.5, 0.06, 0.05, "steelD", top="steel")                             # yoke
    for u in (-0.14, 0.14):                                                            # two lamp heads, tilted down
        k.box(u, 0.05, 0.6, 0.24, 0.18, 0.2, "gm", top="steel", bevel=0.015, rx=0.5)
        k.box(u, 0.15, 0.625, 0.2, 0.01, 0.15, "arc", rx=0.5)
        k.box(u, 0.155, 0.69, 0.2, 0.012, PX, "gm", rx=0.5)
    k.cyl(0.2, 0.15, 0.32, 0.03, 0.04, "green", sides=8)                                   # power lamp
    return k.build()


SPRITES += [("concept.pillar_lumen", (1, 1), "prop", pillar_lumen),
            ("concept.pillar_capsule", (1, 1), "prop", pillar_capsule),
            ("concept.pillar_flood", (1, 1), "prop", pillar_flood)]


# ---- v9: sized against the crew (1.5 tiles tall) -----------------------------------------------------------------

def dummy():
    """A flat grey stand-in for a crew member, 1.5 tiles tall, for scale on review boards."""
    k = K("lc_dummy", (1, 1), 0)
    for u in (-0.08, 0.08):
        k.box(u, 0, 0.0, 0.12, 0.14, 0.72, "blueGrey")                                     # legs
    k.box(0, 0, 0.72, 0.36, 0.2, 0.52, "blueGrey", bevel=0.03)                             # torso
    for u in (-0.23, 0.23):
        k.box(u, 0, 0.74, 0.09, 0.11, 0.48, "blueGrey")                                    # arms
    k.cyl(0, 0, 1.26, 0.1, 0.24, "blueGrey", sides=10)                                     # head
    return k.build()


def pillar_floodtower():
    """The flood cart at crew scale: a yellow base on outrigger feet, a mast to about head height and a bit, a bank
    of four lamps on a yoke, a cable reel, a handle, a beacon."""
    k = K("lc_p_floodtower", (1, 1), 0)
    for a in (0.785, -0.785):                                                          # outriggers
        k.box(0, 0, 0.0, 0.92, 0.08, 0.06, "steelD", top="steel", rz=a)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.31, sv * 0.31, 0.0, 0.12, 0.12, 0.04, "hazY", top="ochM")          # outrigger pads
    k.box(0, 0, 0.04, 0.62, 0.54, 0.4, "hazY", top="ochM", bevel=0.03)                     # body
    k.box(0, 0, 0.04, 0.64, 0.56, 0.06, "gmD")                                             # bumper
    k.box(0, 0, 0.38, 0.64, 0.56, 0.03, "gmD")                                             # top rail
    for i in range(5):                                                                 # front vents
        k.box(-0.2 + i * 0.08, 0.272, 0.15, 0.05, 0.008, 0.16, "dark")
    k.box(0.2, 0.272, 0.2, 0.1, 0.008, 0.1, "lvW")                                         # rating plate
    k.box(0.32, 0.12, 0.14, 0.008, 0.08, 0.16, "dark")                                     # side socket
    k.box(0.322, 0.12, 0.24, 0.008, 0.04, 0.03, "green")
    k.cyl(-0.18, -0.12, 0.41, 0.12, 0.12, "gm", top="steel", sides=14)                     # cable reel on top
    k.cyl(-0.18, -0.12, 0.45, 0.13, 0.04, "dark", sides=14)
    k.box(0, 0.0, 0.41, 0.12, 0.12, 0.08, "steelD", top="steel")                           # mast collar
    k.box(0, 0.0, 0.41, 0.07, 0.07, 1.12, "steel", top="steelL")                           # mast
    k.box(0, 0.0, 0.85, 0.09, 0.09, 0.04, "steelD")                                        # telescoping joint
    k.box(0, 0.0, 1.5, 0.66, 0.08, 0.06, "steelD", top="steel")                            # yoke
    for u in (-0.17, 0.17):                                                            # four lamps, 2 x 2, tilted down
        for z in (1.32, 1.56):
            k.box(u, 0.06, z, 0.3, 0.16, 0.22, "gm", top="steel", bevel=0.015, rx=0.45)
            k.box(u, 0.15, z + 0.03, 0.25, 0.01, 0.16, "arc", rx=0.45)
            k.box(u, 0.156, z + 0.1, 0.25, 0.012, PX, "gm", rx=0.45)
    k.cyl(0.0, 0.0, 1.78, 0.04, 0.06, "orange", sides=8)                                   # beacon
    return k.build()


def pillar_pylon():
    """A wayfinding pylon: a tall cream pylon with a glowing crown, a lit sign panel with an arrow, a deck number."""
    k = K("lc_p_pylon", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.42, 0.32, 0.12, "gm", top="steel", bevel=0.015)                   # plinth
    k.box(0, 0, 0.134, 0.36, 0.26, 1.06, "lvW2", top="lvW", bevel=0.02, taper=0.9)         # tapering pylon
    k.box(0, 0.0, 0.134, 0.37, 0.27, 0.04, "navy")                                         # foot band
    k.box(0.0, 0.124, 0.5, 0.26, 0.012, 0.42, "navy")                                      # sign panel recess
    k.box(0.0, 0.13, 0.52, 0.22, 0.008, 0.38, "dark")
    # the arrow: a shaft and a head, lit cyan
    k.box(0.0, 0.135, 0.56, 0.05, 0.008, 0.2, "cyan")
    k.box(-0.04, 0.135, 0.72, 0.1, 0.008, 0.04, "cyan", rz=0.0)
    k.box(0.0, 0.136, 0.74, 0.16, 0.008, 0.04, "cyan")
    k.box(0.0, 0.136, 0.78, 0.08, 0.008, 0.04, "cyan")
    k.box(0.0, 0.124, 0.98, 0.3, 0.012, 0.05, "orange")                                     # deck stripe
    k.box(-0.06, 0.132, 0.36, 0.1, 0.008, 0.08, "lvW")                                     # deck number plate
    k.box(-0.06, 0.137, 0.38, 0.02, 0.006, 0.04, "navy")
    k.box(-0.03, 0.137, 0.38, 0.02, 0.006, 0.04, "navy")
    k.box(0, 0, 1.19, 0.34, 0.24, 0.24, "arc", bevel=0.01)                                 # glowing crown
    for i in range(3):                                                                 # crown mullions
        k.box(-0.1 + i * 0.1, 0.0, 1.19, PX, 0.25, 0.24, "gmD")
    k.box(0, 0, 1.43, 0.4, 0.3, 0.05, "lvW2", top="lvW", bevel=0.02)                       # cap
    k.cyl(0.12, -0.06, 1.48, 0.012, 0.14, "steelL", sides=6)                               # antenna
    k.cyl(0.12, -0.06, 1.62, 0.02, 0.02, "red", sides=6)
    return k.build()


def pillar_plasma():
    """A plasma lamp: a magenta coil glowing in a four-post cage over a finned base, a pressure dial, a feed pipe
    elbowing out of the deck."""
    k = K("lc_p_plasma", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.5, 0.5, 0.22, "gm", top="steel", bevel=0.025)                     # base
    for i in range(5):                                                                 # cooling fins on two faces
        k.box(0.255, -0.16 + i * 0.08, 0.04, 0.03, 0.03, 0.16, "steelL")
        k.box(-0.16 + i * 0.08, 0.255, 0.04, 0.03, 0.03, 0.16, "steelL")
    k.box(0.12, 0.26, 0.24, 0.12, 0.03, 0.12, "steelD")                                    # pressure dial housing
    k.box(0.12, 0.275, 0.25, 0.09, 0.008, 0.09, "lvW")
    k.box(0.14, 0.28, 0.28, 0.05, 0.006, 0.015, "red", rx=0.0)
    k.box(0, 0, 0.234, 0.36, 0.36, 0.05, "steelD", top="steel")                            # lower ring
    k.cyl(0, 0, 0.284, 0.1, 0.82, "magenta", sides=12)                                     # the plasma column
    for j in range(4):                                                                 # coil bands round it
        k.cyl(0, 0, 0.36 + j * 0.18, 0.11, 2 * PX, "steelD", top="steel", sides=12)
    k.cyl(0, 0, 0.284, 0.12, 0.04, "steelD", top="steel", sides=12)                        # emitter collars
    k.cyl(0, 0, 1.064, 0.12, 0.04, "steelD", top="steel", sides=12)
    for su in (-1, 1):                                                                 # four-post cage
        for sv in (-1, 1):
            k.box(su * 0.15, sv * 0.15, 0.284, 0.04, 0.04, 0.82, "lvW2", top="lvW")
    k.box(0, 0, 1.1, 0.4, 0.4, 0.07, "gm", top="steel", bevel=0.02)                        # top ring
    k.box(0, 0, 1.17, 0.22, 0.22, 0.06, "steelD", top="gmD", taper=0.7)                     # vent cap
    k.cyl(0, 0, 1.23, 0.04, 0.03, "magenta", sides=8)
    k.box(-0.22, -0.3, 0.0, 0.08, 0.2, 0.08, "steelD", top="steel")                        # feed pipe out of the deck
    k.box(-0.22, -0.2, 0.0, 0.08, 0.08, 0.18, "steelD", top="steel")
    k.box(-0.22, -0.2, 0.08, 0.1, 0.1, 0.03, "hazY")
    return k.build()


SPRITES += [("concept.dummy", (1, 1), "prop", dummy),
            ("concept.pillar_floodtower", (1, 1), "prop", pillar_floodtower),
            ("concept.pillar_pylon", (1, 1), "prop", pillar_pylon),
            ("concept.pillar_plasma", (1, 1), "prop", pillar_plasma)]


# ---- v10: default-lamp candidates, three short (chest height) and three tall (head height and up) ---------------

def _ring(k, z, r, h, n, cols, w=None, d=0.008):
    """n small boxes round a circle of radius r at height z, tangent to it, coloured in turn from `cols`."""
    w = w or 2 * math.pi * r / n * 0.9
    for i in range(n):
        a = i * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), z, w, d, h, cols[i % len(cols)], rz=a + math.pi / 2)


def short_bollard():
    """A bollard: a cream drum on a hazard-ringed foot, a lantern band of light behind mullions, a service hatch."""
    k = K("lc_s_bollard", (1, 1), 0)
    _socket(k)
    k.cyl(0, 0, 0.014, 0.25, 0.08, "gmD", top="gm", sides=16)                             # foot
    _ring(k, 0.03, 0.252, 0.05, 16, ("hazY", "hazK"))
    k.cyl(0, 0, 0.094, 0.2, 0.58, "lvW2", top="lvW", sides=16)                            # drum
    k.cyl(0, 0, 0.3, 0.203, PX, "steelD", sides=16)                                        # seam
    k.box(0.142, 0.142, 0.15, 0.12, 0.012, 0.14, "steelD", rz=3 * math.pi / 4)             # service hatch
    k.box(0.147, 0.147, 0.17, 0.08, 0.008, 0.1, "gm", rz=3 * math.pi / 4)
    k.box(0.147, 0.147, 0.34, 0.03, 0.01, 0.03, "green", rz=3 * math.pi / 4)               # status lamp
    k.cyl(0, 0, 0.674, 0.17, 0.16, "arc", sides=16)                                        # lantern band
    _ring(k, 0.674, 0.175, 0.16, 8, ("gmD",), w=0.06, d=0.04)                              # mullions
    k.cyl(0, 0, 0.834, 0.23, 0.06, "gm", top="steel", sides=16, rtop=0.19)                # cap
    k.cyl(0, 0, 0.894, 0.1, 0.03, "gmD", top="steelD", sides=12)
    return k.build()


def short_cage():
    """A cage lamp: a glowing block in a steel guard cage with a carry handle, on a bumpered plinth."""
    k = K("lc_s_cage", (1, 1), 0)
    k.box(0, 0, 0.0, 0.5, 0.5, 0.14, "gm", top="steel", bevel=0.02)                        # plinth
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.23, sv * 0.23, 0.0, 0.09, 0.09, 0.16, "dark", top="gmD", bevel=0.015)   # rubber bumpers
    k.box(0, 0.252, 0.05, 0.3, 0.006, 0.04, "hazY")                                        # stencil stripe
    k.box(0.252, 0, 0.05, 0.006, 0.3, 0.04, "hazY")
    k.box(0, 0, 0.14, 0.3, 0.3, 0.05, "gmD", top="gm")                                     # lamp foot
    k.box(0, 0, 0.19, 0.24, 0.24, 0.38, _g("arc"), bevel=0.02)                                 # the light
    k.box(0, 0, 0.57, 0.3, 0.3, 0.05, "gmD", top="gm")                                     # lamp head
    for su in (-1, 1):                                                                 # cage: corner posts
        for sv in (-1, 1):
            k.box(su * 0.18, sv * 0.18, 0.14, 0.03, 0.03, 0.52, "steel", top="steelL")
    for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):                                  # mid bars
        k.box(su * 0.18, sv * 0.18, 0.14, 0.025, 0.025, 0.52, "steel", top="steelL")
    for z in (0.3, 0.45):                                                              # hoops
        for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k.box(su * 0.18, sv * 0.18, z, 0.03 if su else 0.38, 0.38 if su else 0.03, 0.025, "steel")
    k.box(0, 0, 0.66, 0.4, 0.4, 0.04, "steelD", top="steel")                               # cage top
    for su in (-1, 1):                                                                 # carry handle
        k.box(su * 0.12, 0, 0.7, 0.03, 0.04, 0.1, "steelD")
    k.box(0, 0, 0.8, 0.27, 0.05, 0.04, "dark", top="gmD")
    _cable(k, -0.25, -0.1, -0.5, -0.1)
    return k.build()


def short_disc():
    """A downlight: a slim post under a wide cream disc, a lit rim glowing round the disc's underside."""
    k = K("lc_s_disc", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.32, 0.32, 0.1, "gm", top="steel", bevel=0.02, taper=0.8)          # base
    k.cyl(0, 0, 0.114, 0.08, 0.6, "lvW2", top="lvW", sides=12)                            # post
    for z in (0.2, 0.62):
        k.cyl(0, 0, z, 0.085, 0.03, "gmD", sides=12)                                       # bands
    k.box(0.06, 0.06, 0.32, 0.02, 0.02, 0.2, "cyan")                                       # indicator strip
    k.cyl(0, 0, 0.7, 0.31, 0.025, "cyan", sides=20)                                        # lit rim under the disc
    k.cyl(0, 0, 0.725, 0.31, 0.06, "lvW2", top="lvW", sides=20, rtop=0.27)               # the disc
    k.cyl(0, 0, 0.785, 0.12, 0.03, "gm", top="steel", sides=12)                            # vent boss
    for a in (0.0, math.pi / 2):
        k.box(0, 0, 0.815, 0.2, PX, 0.004, "dark", rz=a)
    return k.build()


def tall_halo():
    """A halo spire: a tapering cream mast, a dark upper shaft with light strips, a ring of light floating on struts."""
    k = K("lc_t_halo", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.44, 0.44, 0.14, "gm", top="steel", bevel=0.02, taper=0.85)        # base
    k.box(0, 0, 0.154, 0.24, 0.24, 0.62, "lvW2", top="lvW", bevel=0.02, taper=0.8)         # lower shaft
    k.box(0, 0, 0.774, 0.22, 0.22, 0.05, "gmD", top="gm")                                  # collar
    k.box(0, 0, 0.824, 0.15, 0.15, 0.72, "navy", top="gmD")                                # upper shaft
    k.box(0.076, 0.0, 0.86, 0.008, 0.05, 0.62, "arc")                                      # light strips
    k.box(0.0, 0.076, 0.86, 0.05, 0.008, 0.62, "arc")
    k.box(0.08, 0.08, 0.86, 0.015, 0.015, 0.62, "cyan")
    for a in (0.0, math.tau / 3, 2 * math.tau / 3):                                    # struts out to the halo
        k.box(0.14 * math.cos(a + 0.785), 0.14 * math.sin(a + 0.785), 1.5, 0.26, 0.03, 0.025, "steelD", rz=a + 0.785)
    _ring(k, 1.52, 0.28, 0.05, 20, ("arc",), d=0.04)                                      # the halo
    _ring(k, 1.505, 0.28, 0.015, 20, ("steelD",), d=0.05)                                  # its underside
    k.box(0, 0, 1.544, 0.18, 0.18, 0.05, "lvW2", top="lvW", bevel=0.015)                   # cap
    k.cyl(0, 0, 1.594, 0.015, 0.16, "steelL", sides=6)                                     # finial
    k.cyl(0, 0, 1.754, 0.025, 0.025, "red", sides=6)
    return k.build()


def tall_lantern():
    """The lumen column grown to head height: three stacked louvred windows between cream collars, corner posts,
    a cyan seam, a service box, a domed emitter."""
    k = K("lc_t_lantern", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.54, 0.54, 0.03, "gmD")
    k.box(0, 0, 0.044, 0.52, 0.52, 0.16, "lvW2", top="lvW", bevel=0.03, taper=0.78)        # tapering base
    k.box(0, 0, 0.204, 0.3, 0.3, 1.32, "navy", top="gmD")                                  # the core
    for i, z in enumerate((0.25, 0.69, 1.13)):
        for f, (su, sv) in (("u", (1, 0)), ("v", (0, 1))):
            _louvred(k, su * 0.13, sv * 0.13, z, 0.24, 0.36, f, "gmD", n=2)
    for z in (0.65, 1.09):                                                             # cream collars
        k.box(0, 0, z, 0.36, 0.36, 0.04, "lvW2", top="lvW")
    for su in (-1, 1):                                                                 # corner posts
        for sv in (-1, 1):
            k.box(su * 0.15, sv * 0.15, 0.204, 0.075, 0.075, 1.32, "lvW2", top="lvW", bevel=0.012)
    k.box(0.19, 0.19, 0.24, 0.012, 0.012, 1.24, "cyan")                                   # cyan seam
    k.box(0, 0, 1.524, 0.42, 0.42, 0.08, "lvW2", top="lvW", bevel=0.035, taper=0.82)       # cap
    k.cyl(0, 0, 1.604, 0.1, 0.02, "gmD", sides=12)
    k.cyl(0, 0, 1.624, 0.08, 0.05, "arc", sides=12, rtop=0.04)                            # domed emitter
    k.box(-0.08, 0.27, 0.06, 0.18, 0.1, 0.16, "gm", top="steel", bevel=0.01)               # service box
    for i in range(3):
        k.box(-0.13 + i * 0.05, 0.322, 0.16, 0.03, 0.008, 0.03, "orange")
    _cable(k, -0.17, 0.3, -0.5, 0.3)
    return k.build()


def tall_twin():
    """A twin-tube mast: two tubes of light clamped to a cream spine, a base with a little status screen, a fan
    housing on top."""
    k = K("lc_t_twin", (1, 1), 0)
    _socket(k)
    k.box(0, 0, 0.014, 0.5, 0.42, 0.22, "gm", top="steel", bevel=0.025)                    # base
    k.box(0.05, 0.212, 0.08, 0.2, 0.01, 0.1, "dark")                                       # status screen
    for i, (h, c) in enumerate(((0.04, "green"), (0.07, "green"), (0.03, "green"), (0.06, "orange"))):
        k.box(-0.02 + i * 0.045, 0.218, 0.095, 0.03, 0.006, h, c)
    for i in range(3):                                                                 # side vents
        k.box(0.252, -0.1 + i * 0.08, 0.08, 0.008, 0.05, 0.1, "dark")
    k.box(0, -0.1, 0.234, 0.1, 0.1, 1.28, "lvW2", top="lvW", bevel=0.015)                  # spine
    for u in (-0.1, 0.1):                                                              # the two tubes
        k.cyl(u, 0.04, 0.234, 0.07, 0.04, "steel", top="steelL", sides=12)
        k.cyl(u, 0.04, 0.274, 0.055, 1.16, _g("arc"), sides=12)
        k.cyl(u, 0.04, 1.434, 0.07, 0.04, "steel", top="steelL", sides=12)
    for z in (0.5, 0.86, 1.22):                                                        # clamps
        k.box(0, -0.02, z, 0.4, 0.24, 0.07, "lvW2", top="lvW", bevel=0.015)
        k.box(0, -0.02, z + 0.025, 0.405, 0.245, 0.02, "gmD")
    k.box(0, -0.03, 1.474, 0.4, 0.3, 0.13, "lvW2", top="lvW", bevel=0.025)                 # fan housing
    k.cyl(0, -0.03, 1.604, 0.09, 0.015, "dark", sides=14)                                   # fan
    for a in (0.3, 1.87):
        k.box(0, -0.03, 1.619, 0.16, 0.025, 0.006, "steel", rz=a)
    k.box(0.16, 0.12, 1.53, 0.04, 0.008, 0.04, _g("cyan"))                                     # indicator
    return k.build()


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (
    short_bollard, short_cage, short_disc, tall_halo, tall_lantern, tall_twin)]


# ---- v11: wall lights in the family of the two picked lamps (cage lamp, twin-tube mast) -------------------------
# The stand-in wall's face is at v = -0.5; pieces stand out from it toward +v. The crew are 1.5 tall.

WF = -0.5


def _wplate(k, u, z, w, h, col="steelD", top="steel"):
    """A mounting plate on the wall face, bottom at z, with a bolt at each corner."""
    k.box(u, WF + 0.015, z, w, 0.03, h, col, top=top)
    for su in (-1, 1):
        for zz in (z + 0.03, z + h - 0.05):
            k.box(u + su * (w / 2 - 0.035), WF + 0.033, zz, 0.025, 0.008, 0.025, "plate")


def wall_cage(context=False):
    """A bulkhead light: a glowing lens in a steel guard cage on a bolted plate, a conduit up the wall to the top."""
    k = K("lc_w_cage", (1, 1), 0)
    if context:
        _wall(k.m)
    _wplate(k, 0, 1.0, 0.5, 0.36)
    k.box(0, WF + 0.06, 1.04, 0.36, 0.06, 0.28, "gmD", top="gm", bevel=0.01)              # lamp body
    k.box(0, WF + 0.1, 1.07, 0.3, 0.02, 0.22, "arc", bevel=0.01)                           # the lens
    for u in (-0.17, 0.0, 0.17):                                                       # cage bars across it
        k.box(u, WF + 0.13, 1.04, 0.025, 0.025, 0.28, "steel", top="steelL")
    k.box(0, WF + 0.13, 1.17, 0.36, 0.025, 0.025, "steel", top="steelL")                  # and one along it
    for su in (-1, 1):
        k.box(su * 0.18, WF + 0.085, 1.04, 0.022, 0.09, 0.022, "steel")                     # cage feet
        k.box(su * 0.18, WF + 0.085, 1.298, 0.022, 0.09, 0.022, "steel")
    k.box(0.16, WF + 0.03, 1.36, 0.06, 0.06, 0.49, "gm", top="steel")                       # conduit up the wall
    k.box(0.16, WF + 0.03, 1.5, 0.08, 0.07, 0.03, "steelD")                                 # its clamp
    k.box(-0.19, WF + 0.035, 0.96, 0.08, 0.008, 0.03, "hazY")                               # hazard tab
    k.box(-0.11, WF + 0.035, 0.96, 0.04, 0.008, 0.03, "green")                              # status lamp
    return k.build()


def wall_twin(context=False):
    """A twin-tube sconce: two short tubes of light clamped across a cream back plate, steel end caps."""
    k = K("lc_w_twin", (1, 1), 0)
    if context:
        _wall(k.m)
    k.box(0, WF + 0.02, 1.0, 0.66, 0.04, 0.4, "lvW2", top="lvW", bevel=0.015)              # back plate
    k.box(0, WF + 0.042, 1.04, 0.58, 0.008, 0.32, "gmD")                                   # recess
    for z in (1.1, 1.26):                                                              # the two tubes, along the wall
        k.box(0, WF + 0.1, z, 0.5, 0.09, 0.09, _g("arc"), bevel=0.035)
        for su in (-1, 1):
            k.box(su * 0.27, WF + 0.1, z - 0.01, 0.05, 0.11, 0.11, "steel", top="steelL", bevel=0.01)   # end caps
    for u in (-0.12, 0.12):                                                            # clamps over both tubes
        k.box(u, WF + 0.1, 1.07, 0.06, 0.13, 0.33, "lvW2", top="lvW", bevel=0.01)
        k.box(u, WF + 0.12, 1.07, 0.065, 0.11, 0.02, "gmD")
    return k.build()


def wall_flood(context=False):
    """A hooded floodlight on an arm: a lamp head reaching out from a wall bracket, tilted down, a cable loop."""
    k = K("lc_w_flood", (1, 1), 0)
    if context:
        _wall(k.m)
    _wplate(k, 0, 1.2, 0.24, 0.32)
    k.box(0, WF + 0.1, 1.33, 0.07, 0.16, 0.07, "steel", top="steelL")                       # arm
    k.box(0, WF + 0.06, 1.22, 0.05, 0.08, 0.12, "steelD")                                   # brace
    k.box(0, WF + 0.26, 1.24, 0.4, 0.18, 0.24, "gm", top="steel", bevel=0.02, rx=0.2)       # lamp head
    k.box(0, WF + 0.352, 1.27, 0.34, 0.01, 0.18, "arc", rx=0.2)                             # its face
    for z in (1.31, 1.37):
        k.box(0, WF + 0.362, z, 0.34, 0.016, 2 * PX, "gm", rx=0.2)
    k.box(0, WF + 0.27, 1.47, 0.44, 0.24, 0.025, "steelD", top="steel", rx=0.2)             # visor
    k.box(-0.08, WF + 0.03, 0.9, 0.035, 0.035, 0.3, "dark")                                  # cable loop down the wall
    k.box(-0.08, WF + 0.03, 0.88, 0.1, 0.06, 0.04, "steelD", top="steel")                    # junction
    k.box(0.12, WF + 0.035, 1.4, 0.03, 0.008, 0.03, "orange")                                # status lamp
    return k.build()


SPRITES += [(f"concept.{fn.__name__}.ctx", (1, 1), "prop", lambda fn=fn: fn(True)) for fn in (wall_cage, wall_twin, wall_flood)]


# ---- v12: floor lights in the family (flush, 1x1, walkable) -------------------------------------------------------

def _floor_frame(k, s=0.82, col="steelD", top="gm"):
    """A flush deck plate with a bolt in each corner."""
    k.box(0, 0, 0.0, s, s, 0.014, col, top=top, bevel=0.005)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * (s / 2 - 0.05), sv * (s / 2 - 0.05), 0.014, 0.022, 0.008, "plate", sides=6)


def floor_twin():
    """Twin troughs: two tubes of light sunk in the deck under a cream frame, steel end caps."""
    k = K("lc_f_twin", (1, 1), 0)
    _floor_frame(k)
    k.box(0, 0, 0.014, 0.62, 0.5, 0.008, "lvW2", top="lvW")                                # cream frame
    for v in (-0.12, 0.12):
        k.box(0, v, 0.016, 0.52, 0.16, 0.008, "dark")                                      # trough
        k.box(0, v, 0.018, 0.4, 0.07, 0.01, _g("arc"))                                         # the tube
        for su in (-1, 1):
            k.box(su * 0.22, v, 0.016, 0.05, 0.1, 0.014, "steel", top="steelL")             # end caps
    return k.build()


def floor_well():
    """A grate well: a glowing well under a fine 5 x 5 grate, a bolted frame, yellow corner tabs."""
    k = K("lc_f_well", (1, 1), 0)
    _floor_frame(k)
    k.box(0, 0, 0.012, 0.52, 0.52, 0.004, "steel", top="steelL")                          # grate rim
    k.box(0, 0, 0.014, 0.46, 0.46, 0.004, "cyan")                                          # the glow
    for i in range(1, 5):                                                              # grate: 1 px bars, 5 x 5 cells
        t = -0.23 + i * 0.092
        k.box(t, 0, 0.018, 1.4 * PX, 0.46, 0.004, "dark")
        k.box(0, t, 0.018, 0.46, 1.4 * PX, 0.004, "dark")
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.3, sv * 0.3, 0.014, 0.06, 0.06, 0.006, "hazY")                     # corner tabs
    return k.build()


def floor_beacon():
    """A deck beacon: a round lens in a cream bezel, four cyan runway dashes pointing out along the deck."""
    k = K("lc_f_beacon", (1, 1), 0)
    _floor_frame(k)
    k.cyl(0, 0, 0.014, 0.17, 0.01, "lvW2", top="lvW", sides=20)                            # bezel
    k.cyl(0, 0, 0.024, 0.12, 0.006, "arc", sides=20)                                       # lens
    k.cyl(0, 0, 0.03, 0.04, 0.004, "cyan", sides=10)
    for a in range(4):                                                                 # runway dashes outward
        ang = a * math.pi / 2
        k.box(0.28 * math.cos(ang), 0.28 * math.sin(ang), 0.014, 0.12, 0.05, 0.004, "cyan", rz=ang)
    return k.build()


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (floor_twin, floor_well, floor_beacon)]


# ---- v13: glow colour on the four picked pieces (cool as built, warm white, amber) -------------------------------

TINT = {}


def _g(name):
    return TINT.get(name, name)


def _tinted(fn, tint):
    def build():
        TINT.clear()
        TINT.update(tint)
        try:
            return fn()
        finally:
            TINT.clear()
    return build


TINTS = {"warm": {"arc": "fxW", "cyan": "lampY"}, "amber": {"arc": "lampY", "cyan": "fxO"}}
for _t, _map in TINTS.items():
    SPRITES += [(f"concept.tall_twin.{_t}", (1, 1), "prop", _tinted(tall_twin, _map)),
                (f"concept.short_cage.{_t}", (1, 1), "prop", _tinted(short_cage, _map)),
                (f"concept.wall_twin.ctx.{_t}", (1, 1), "prop", _tinted(lambda: wall_twin(True), _map)),
                (f"concept.floor_twin.{_t}", (1, 1), "prop", _tinted(floor_twin, _map))]


# ---- v14: floor lights, second round, in the warm glow (main fxW, accent lampY) ---------------------------------

def floor_kerb():
    """A kerb step light: a low cream housing along the back of the tile, a slot of light in its face throwing light
    across the floor, bolted end caps."""
    k = K("lc_f_kerb", (1, 1), 0)
    k.box(0, -0.3, 0.0, 0.8, 0.26, 0.012, "steelD", top="gm")                              # footing plate
    k.box(0, -0.31, 0.012, 0.66, 0.2, 0.1, "lvW2", top="lvW", bevel=0.02)                  # housing
    k.box(0, -0.204, 0.03, 0.58, 0.014, 0.055, "dark")                                     # slot hood
    k.box(0, -0.196, 0.038, 0.54, 0.01, 0.04, "fxW")                                       # the light
    for su in (-1, 1):
        k.box(su * 0.35, -0.31, 0.012, 0.06, 0.22, 0.11, "steel", top="steelL", bevel=0.01)   # end caps
        k.cyl(su * 0.35, -0.31, 0.122, 0.018, 0.008, "plate", sides=6)
    k.box(0.22, -0.31, 0.112, 0.06, 0.03, 0.006, "lampY")                                  # warm indicator on top
    return k.build()


def floor_prisms():
    """Deck prisms: a 3 x 3 cluster of thick glass blocks set in a steel grid, lit from below, some warmer than others."""
    k = K("lc_f_prisms", (1, 1), 0)
    _floor_frame(k)
    k.box(0, 0, 0.012, 0.64, 0.64, 0.012, "steelD", top="gmD")                             # grid
    warm = {(0, 0), (1, 2), (2, 1)}
    for i in range(3):
        for j in range(3):
            u, v = -0.2 + i * 0.2, -0.2 + j * 0.2
            k.box(u, v, 0.016, 0.13, 0.13, 0.014, "lampY" if (i, j) in warm else "fxW", bevel=0.02)
    return k.build()


def floor_hatch():
    """A hatch light: a round steel lid with four dog clamps and a handle, warm light leaking out round its rim."""
    k = K("lc_f_hatch", (1, 1), 0)
    _floor_frame(k)
    k.cyl(0, 0, 0.012, 0.33, 0.008, "steelD", sides=24)                                    # seat ring
    k.cyl(0, 0, 0.016, 0.3, 0.008, "fxW", sides=24)                                        # light round the rim
    k.cyl(0, 0, 0.018, 0.255, 0.016, "steel", top="steelL", sides=24)                      # the lid
    for v in (-0.08, 0.08):                                                            # two stiffening ribs
        k.box(0, v, 0.034, 0.4, 0.035, 0.008, "steelD")
    for a in range(4):                                                                 # dog clamps
        ang = a * math.pi / 2 + math.pi / 4
        k.box(0.29 * math.cos(ang), 0.29 * math.sin(ang), 0.012, 0.07, 0.05, 0.03, "gm", top="steel", rz=ang)
    k.box(0, 0, 0.042, 0.12, 0.03, 0.02, "dark", top="gmD")                                 # handle
    k.box(0.12, 0.12, 0.034, 0.05, 0.05, 0.005, "hazY", rz=math.pi / 4)                    # hazard tab on the lid
    return k.build()


def floor_studs():
    """Runway studs: three domed studs in steel collars along the tile, warm tops, a cable channel joining them."""
    k = K("lc_f_studs", (1, 1), 0)
    k.box(0, 0, 0.0, 0.84, 0.12, 0.01, "dark", top="gmD")                                  # cable channel
    for u in (-0.27, 0.0, 0.27):
        k.cyl(u, 0, 0.0, 0.11, 0.02, "steelD", top="steel", sides=16)                       # collar
        k.cyl(u, 0, 0.02, 0.075, 0.03, "steel", top="steelL", sides=16)
        k.cyl(u, 0, 0.05, 0.06, 0.03, "fxW", sides=14, rtop=0.035)                          # warm dome
        k.cyl(u, 0, 0.05, 0.065, 0.008, "lampY", sides=14)                                  # gold ring under it
    return k.build()


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (floor_kerb, floor_prisms, floor_hatch, floor_studs)]


# ---- v15: floor lights that go INTO the floor -------------------------------------------------------------------
# Geometry below z = 0 would draw over the floor in front of the tile, so each piece carries a holdout surface at floor
# level with the opening cut out of it: only what shows through the opening survives (as the crew layers do).

from . import steelkit as SK  # noqa: E402


def _holdout_sq(name, hu, hv):
    """A holdout sheet at floor level, 2.4 tiles across, with a rectangular hole hu x hv in the middle."""
    k = K(name, (1, 1), 0)
    R = 1.2
    k.box(0, (hv / 2 + R) / 2, 0.0, 2 * R, R - hv / 2, 0.001, "dark")
    k.box(0, -(hv / 2 + R) / 2, 0.0, 2 * R, R - hv / 2, 0.001, "dark")
    k.box((hu / 2 + R) / 2, 0, 0.0, R - hu / 2, hv, 0.001, "dark")
    k.box(-(hu / 2 + R) / 2, 0, 0.0, R - hu / 2, hv, 0.001, "dark")
    ob = k.build()[0]
    ob.is_holdout = True
    return ob


def _holdout_round(name, r, n=24):
    """A holdout sheet at floor level with a round hole of radius r."""
    k = K(name, (1, 1), 0)
    R = 1.4
    for i in range(n):
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        SK.face(k, [(r * math.cos(a0), r * math.sin(a0), 0.001), (R * math.cos(a0), R * math.sin(a0), 0.001),
                    (R * math.cos(a1), R * math.sin(a1), 0.001), (r * math.cos(a1), r * math.sin(a1), 0.001)],
                (0, 0, 1), "dark")
    ob = k.build()[0]
    ob.is_holdout = True
    return ob


def _shaft(k, hu, hv, z0, z1, bands):
    """The four walls of a rectangular shaft from z0 down to z1, in horizontal colour bands from the top down (lit
    warmer near the light at the bottom)."""
    n = len(bands)
    for i, col in enumerate(bands):
        za, zb = z0 + (z1 - z0) * (i + 1) / n, z0 + (z1 - z0) * i / n
        h = zb - za
        k.box(0, -hv / 2 - 0.01, za, hu + 0.04, 0.02, h, col)
        k.box(0, hv / 2 + 0.01, za, hu + 0.04, 0.02, h, col)
        k.box(-hu / 2 - 0.01, 0, za, 0.02, hv, h, col)
        k.box(hu / 2 + 0.01, 0, za, 0.02, hv, h, col)


def _rim(k, hu, hv, w=0.05, h=0.014):
    """A steel lip round an opening."""
    k.box(0, -hv / 2 - w / 2, 0.0, hu + 2 * w, w, h, "steel", top="steelL")
    k.box(0, hv / 2 + w / 2, 0.0, hu + 2 * w, w, h, "steel", top="steelL")
    k.box(-hu / 2 - w / 2, 0, 0.0, w, hv, h, "steel", top="steelL")
    k.box(hu / 2 + w / 2, 0, 0.0, w, hv, h, "steel", top="steelL")


WARM_WALL = ("gmD", "rustD", "ochD", "ochM")                                             # top (dark) to bottom (lit warm)


def floor_well2():
    """A grated well: a square shaft a fifth of a tile deep, a warm lamp at the bottom lighting its walls, a 5 x 5
    grate over the opening, a bolted lip."""
    k = K("lc_f_well2", (1, 1), 0)
    s, d = 0.52, 0.12
    _shaft(k, s, s, 0.0, -d, WARM_WALL)
    k.box(0, 0, -d - 0.02, s + 0.04, s + 0.04, 0.02, "steelD")                             # shaft floor
    k.box(0, 0, -d, 0.48, 0.48, 0.02, "fxW", bevel=0.01)                                   # the lamp
    k.box(0, 0, -d + 0.02, 0.1, 0.1, 0.006, "lampY")
    _rim(k, s, s)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * 0.275, sv * 0.275, 0.014, 0.018, 0.006, "plate", sides=6)
    for i in range(1, 5):                                                              # the grate
        t = -s / 2 + i * s / 5
        k.box(t, 0, 0.0, 1.4 * PX, s, 0.012, "steelD", top="steel")
        k.box(0, t, 0.0, s, 1.4 * PX, 0.012, "steelD", top="steel")
    return [*k.build(), _holdout_sq("lc_f_well2_h", s, s)]


def floor_trench():
    """A light trench: a narrow slot across the tile, a warm tube lying at the bottom on two brackets, its walls lit."""
    k = K("lc_f_trench", (1, 1), 0)
    hu, hv, d = 0.74, 0.24, 0.1
    _shaft(k, hu, hv, 0.0, -d, WARM_WALL)
    k.box(0, 0, -d - 0.02, hu + 0.04, hv + 0.04, 0.02, "steelD")
    for u in (-0.24, 0.24):
        k.box(u, 0, -d, 0.04, hv, 0.03, "steelD", top="steel")                             # brackets
    k.box(0, 0, -d + 0.02, hu - 0.06, 0.11, 0.05, "fxW", bevel=0.025)                      # the tube
    _rim(k, hu, hv, w=0.04)
    for u in (-0.12, 0.12):                                                            # two clips over the slot
        k.box(u, 0, 0.0, 0.035, hv + 0.08, 0.016, "steelD", top="steel")
    return [*k.build(), _holdout_sq("lc_f_trench_h", hu, hv)]


def floor_bowl():
    """A lens bowl: a round recess sloping down to a warm lens, a steel ring round its mouth."""
    k = K("lc_f_bowl", (1, 1), 0)
    r0, r1, d, n = 0.14, 0.28, 0.1, 24
    for i in range(n):                                                                 # the sloping inner wall, in two bands
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        for (ra, za), (rb, zb), col in (((r1, 0.0), ((r0 + r1) / 2, -d / 2), "rustD"), (((r0 + r1) / 2, -d / 2), (r0, -d), "ochM")):
            ca, sa, cb, sb = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
            mid = (a0 + a1) / 2
            SK.face(k, [(ra * ca, ra * sa, za), (ra * cb, ra * sb, za), (rb * cb, rb * sb, zb), (rb * ca, rb * sa, zb)],
                    (-math.cos(mid), -math.sin(mid), 0.6), col)
    k.cyl(0, 0, -d - 0.01, r0 + 0.01, 0.012, "fxW", sides=n)                                # the lens
    k.cyl(0, 0, -d + 0.002, 0.045, 0.004, "lampY", sides=12)
    _ring(k, 0.0, r1 + 0.025, 0.014, 24, ("steel",), d=0.05)                                # steel ring round the mouth
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        k.cyl((r1 + 0.03) * math.cos(ang), (r1 + 0.03) * math.sin(ang), 0.014, 0.016, 0.006, "plate", sides=6)
    return [*k.build(), _holdout_round("lc_f_bowl_h", r1)]


def floor_terrace():
    """A terraced pit: three square steps down to a warm light panel, each ledge a shade lighter than the one above."""
    k = K("lc_f_terrace", (1, 1), 0)
    sizes, step = (0.62, 0.48, 0.34), 0.05
    cols = ("gm", "ochD", "ochM")
    for i, s in enumerate(sizes):
        z = -i * step
        _shaft(k, s, s, z, z - step, (("gmD", "rustD", "ochD")[i],))
        nxt = sizes[i + 1] if i + 1 < len(sizes) else None
        if nxt:                                                                        # the ledge round the next opening
            w = (s - nxt) / 2
            k.box(0, -(nxt / 2 + w / 2), z - step - 0.01, s, w, 0.01, cols[i], top=cols[i])
            k.box(0, nxt / 2 + w / 2, z - step - 0.01, s, w, 0.01, cols[i], top=cols[i])
            k.box(-(nxt / 2 + w / 2), 0, z - step - 0.01, w, nxt, 0.01, cols[i], top=cols[i])
            k.box(nxt / 2 + w / 2, 0, z - step - 0.01, w, nxt, 0.01, cols[i], top=cols[i])
    zb = -len(sizes) * step
    k.box(0, 0, zb - 0.01, sizes[-1], sizes[-1], 0.01, "fxW")                              # light panel at the bottom
    for t in (-0.06, 0.06):
        k.box(t, 0, zb, PX, sizes[-1], 0.004, "lampY")
    _rim(k, sizes[0], sizes[0], w=0.04)
    return [*k.build(), _holdout_sq("lc_f_terrace_h", sizes[0], sizes[0])]


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (floor_well2, floor_trench, floor_bowl, floor_terrace)]


# ---- v16: sunk floor lights with covered openings (walkable: grates, glass, slats, rungs) -----------------------

def _holdout_bands(name, hu, bands):
    """A holdout sheet at floor level with rectangular holes hu wide, one per (v0, v1) band, bands sorted by v."""
    k = K(name, (1, 1), 0)
    R = 1.2
    edges = [-R] + [x for b in bands for x in b] + [R]
    for i in range(0, len(edges), 2):                                                  # full-width strips between holes
        v0, v1 = edges[i], edges[i + 1]
        if v1 > v0:
            k.box(0, (v0 + v1) / 2, 0.0, 2 * R, v1 - v0, 0.001, "dark")
    for v0, v1 in bands:                                                               # either side of each hole
        k.box((hu / 2 + R) / 2, (v0 + v1) / 2, 0.0, R - hu / 2, v1 - v0, 0.001, "dark")
        k.box(-(hu / 2 + R) / 2, (v0 + v1) / 2, 0.0, R - hu / 2, v1 - v0, 0.001, "dark")
    ob = k.build()[0]
    ob.is_holdout = True
    return ob


def floor_glass():
    """A glass-topped well: a shallow lit shaft under a flush glass pane, glints across the glass, a bolted frame."""
    k = K("lc_f_glass", (1, 1), 0)
    s, d = 0.5, 0.1
    _shaft(k, s, s, 0.0, -d, WARM_WALL)
    k.box(0, 0, -d - 0.02, s + 0.04, s + 0.04, 0.02, "steelD")
    k.box(0, 0, -d, 0.46, 0.46, 0.02, _g("lampY"), bevel=0.01)                                   # the lamp
    for su in (-1, 1):                                                                 # lamp clips in the corners
        for sv in (-1, 1):
            k.box(su * 0.2, sv * 0.2, -d + 0.02, 0.05, 0.05, 0.01, "steelD")
    _rim(k, s, s, w=0.06, h=0.016)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * 0.28, sv * 0.28, 0.016, 0.018, 0.006, "plate", sides=6)
    k.box(0, 0, 0.0, 2 * PX, s, 0.012, "steelD", top="steel")                              # mullions: four panes
    k.box(0, 0, 0.0, s, 2 * PX, 0.012, "steelD", top="steel")
    for su in (-1, 1):                                                                 # a glint in each far pane
        k.box(su * 0.12 - 0.02, -0.17, 0.003, 0.12, 0.025, 0.003, "fxW")
    return [*k.build(), _holdout_sq("lc_f_glass_h", s, s)]


def floor_vent():
    """A slatted vent light: angled blades across a shallow lit recess, the light glowing up between them."""
    k = K("lc_f_vent", (1, 1), 0)
    hu, hv, d = 0.58, 0.42, 0.1
    _shaft(k, hu, hv, 0.0, -d, WARM_WALL)
    k.box(0, 0, -d - 0.02, hu + 0.04, hv + 0.04, 0.02, "steelD")
    k.box(0, 0, -d, hu - 0.04, hv - 0.04, 0.02, _g("lampY"))                                     # the light
    n = 5
    for i in range(n):                                                                 # angled blades
        v = -hv / 2 + (i + 0.5) * hv / n
        k.box(0, v, -0.02, hu, 0.05, 0.016, "steelD", top="steel", rx=0.35)
    for u in (-hu / 2 + 0.02, 0.0, hu / 2 - 0.02):                                       # blade carriers
        k.box(u, 0, -0.04, 0.025, hv, 0.04, "steelD")
    _rim(k, hu, hv, w=0.05, h=0.016)
    k.box(hu / 2 - 0.02, hv / 2 + 0.025, 0.016, 0.06, 0.02, 0.004, "hazY")                 # hazard tick on the rim
    return [*k.build(), _holdout_sq("lc_f_vent_h", hu, hv)]


def floor_rails():
    """Rail lights: two narrow lit slots side by side, steel rungs across each, a bolted strip between them."""
    k = K("lc_f_rails", (1, 1), 0)
    hu, hv, d, gap = 0.74, 0.15, 0.05, 0.12
    bands = []
    for sv in (-1, 1):
        vc = sv * (gap / 2 + hv / 2)
        bands.append((vc - hv / 2, vc + hv / 2))
        for col_i, col in enumerate(WARM_WALL):                                        # shaft walls, offset to vc
            za = -d * (col_i + 1) / len(WARM_WALL)
            h = d / len(WARM_WALL)
            k.box(0, vc - hv / 2 - 0.01, za, hu + 0.04, 0.02, h, col)
            k.box(0, vc + hv / 2 + 0.01, za, hu + 0.04, 0.02, h, col)
            k.box(-hu / 2 - 0.01, vc, za, 0.02, hv, h, col)
            k.box(hu / 2 + 0.01, vc, za, 0.02, hv, h, col)
        k.box(0, vc, -d - 0.02, hu + 0.04, hv + 0.04, 0.02, "steelD")
        k.box(0, vc, -d, hu - 0.04, hv - 0.04, 0.03, _g("lampY"), bevel=0.012)                   # the light
        for i in range(5):                                                             # rungs
            u = -hu / 2 + (i + 0.5) * hu / 5
            k.box(u, vc, 0.0, 2 * PX, hv + 0.02, 0.012, "steelD", top="steel")
        k.box(0, vc - hv / 2 - 0.015, 0.0, hu + 0.06, 0.03, 0.014, "steel", top="steelL")   # lips
        k.box(0, vc + hv / 2 + 0.015, 0.0, hu + 0.06, 0.03, 0.014, "steel", top="steelL")
        for su in (-1, 1):
            k.box(su * (hu / 2 + 0.02), vc, 0.0, 0.04, hv, 0.014, "steel", top="steelL")
    for u in (-0.25, 0.0, 0.25):                                                       # bolts on the middle strip
        k.cyl(u, 0, 0.0, 0.018, 0.008, "plate", sides=6)
    bands.sort()
    return [*k.build(), _holdout_bands("lc_f_rails_h", hu, bands)]


def floor_wheel():
    """A wheel-grate well: a round lit shaft under a spoked grate with a hub, a bolted ring round it."""
    k = K("lc_f_wheel", (1, 1), 0)
    r, d, n = 0.28, 0.1, 24
    for i in range(n):                                                                 # the round shaft wall, banded
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        mid = (a0 + a1) / 2
        for j, col in enumerate(WARM_WALL):
            za, zb = -d * j / len(WARM_WALL), -d * (j + 1) / len(WARM_WALL)
            SK.face(k, [(r * math.cos(a0), r * math.sin(a0), za), (r * math.cos(a1), r * math.sin(a1), za),
                        (r * math.cos(a1), r * math.sin(a1), zb), (r * math.cos(a0), r * math.sin(a0), zb)],
                    (-math.cos(mid), -math.sin(mid), 0), col)
    k.cyl(0, 0, -d - 0.02, r + 0.02, 0.02, "steelD", sides=n)
    k.cyl(0, 0, -d, r - 0.02, 0.02, _g("lampY"), sides=n)                                        # the light
    _ring(k, -0.004, 0.15, 0.014, 20, ("steel",), d=0.03)                                  # inner ring of the grate
    for a in range(8):                                                                 # spokes
        ang = a * math.pi / 4
        k.box(0.16 * math.cos(ang), 0.16 * math.sin(ang), -0.004, 0.25, 2 * PX, 0.016, "steelD", top="steel", rz=ang)
    k.cyl(0, 0, -0.004, 0.05, 0.02, "steel", top="steelL", sides=12)                       # hub
    k.cyl(0, 0, 0.016, 0.02, 0.004, _g("lampY"), sides=8)
    _ring(k, 0.0, r + 0.03, 0.016, 28, ("steel",), d=0.06)                                 # bolted ring
    for a in range(6):
        ang = a * math.tau / 6
        k.cyl((r + 0.03) * math.cos(ang), (r + 0.03) * math.sin(ang), 0.016, 0.016, 0.006, "plate", sides=6)
    return [*k.build(), _holdout_round("lc_f_wheel_h", r)]


SPRITES += [(f"concept.{fn.__name__}", (1, 1), "prop", fn) for fn in (floor_glass, floor_vent, floor_rails, floor_wheel)]

SPRITES += [(f"concept.{fn.__name__}.warm", (1, 1), "prop", _tinted(fn, {"lampY": "fxW"}))
            for fn in (floor_glass, floor_vent, floor_rails, floor_wheel)]
