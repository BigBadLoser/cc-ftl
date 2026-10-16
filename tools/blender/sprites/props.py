"""Environment sprite models (grid frame, origin = centre of the FRONT-most footprint tile at floor level).
Each builder returns the Blender objects. SPRITES lists (id, footprint (w,h), kind, builder)."""
import math
from . import core

H = 1.0          # full wall height (tiles)
T = 0.2          # wall thickness


def _h(i, j, s=0):
    return ((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) % 100


def floor(variant):
    m = core.Mesh(f"floor_{variant}")

    def fn(i, j):
        n = 16
        if variant == "a":
            if i == 0 or j == 0:
                return "seam"
            if i == 1 or j == 1:
                return "plateB"
            if (i, j) in ((3, 3), (12, 3), (3, 12), (12, 12)):
                return "bolt"
            return "plateC" if _h(i, j) < 9 else "plateA"
        if variant == "b":
            if i == 0 or j == 0 or i == 8:
                return "seam"
            if i == 1 or j == 1 or i == 9:
                return "plateB"
            return "grime" if _h(i, j, 2) < 14 else "plateB" if _h(i, j, 3) < 7 else "plateA"
        if i in (0, 15) or j in (0, 15):
            return "seam" if (i == 0 or j == 0) else "steel"
        if 2 <= i <= 13 and 2 <= j <= 13:
            return "dark" if (i // 2 + j // 2) % 2 == 0 else "steelD"
        return "plateA"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), 16, 16, fn)
    return [m.build()]


def _wall_face(m, axis, t, h, style):
    """Decal pattern on the visible long face. axis 'x': wall along gx at the back (gy=-.5) edge."""
    def fn(i, j):
        hz = style == "hull"
        if j < 2:
            return ("hazY" if (i + j) // 2 % 2 == 0 else "hazK") if hz else "steelD"
        if j >= 14:
            return "steelL" if not hz else "steel"
        if i in (0, 8, 15):
            return "seam"
        if hz:
            if _h(i, j, 5) < 7:
                return "rustD"
            return "steelD" if j % 6 else "seam"
        if j in (3, 12) or i in (1, 7, 9, 14):
            return "steel"
        if (i, j) in ((2, 4), (6, 4), (2, 11), (6, 11), (10, 4), (13, 11)):
            return "bolt"
        return "plateA" if i < 8 else "plateB"
    e = 0.003
    if axis == "x":
        m.pattern((-0.5, -0.5 + t + e, 0), (1, 0, 0), (0, 0, h), 16, 16, fn)
    else:
        m.pattern((-0.5 + t + e, -0.5, 0), (0, 1, 0), (0, 0, h), 16, 16, fn)


def wall(axis="x", style="std", h=H, extra=None):
    t = 0.3 if style == "hull" else T
    m = core.Mesh(f"wall_{style}_{axis}")
    size = (1, t, h) if axis == "x" else (t, 1, h)
    cen = (0, -0.5 + t / 2, 0) if axis == "x" else (-0.5 + t / 2, 0, 0)
    m.box(cen, size, "steelD" if style == "hull" else "steel", top="steelL" if style != "hull" else "steel", base=True)
    if h > 0.5:
        _wall_face(m, axis, t, h, style)
    else:
        ee = 0.003
        if axis == "x":
            m.pattern((-0.5, -0.5 + t + ee, 0), (1, 0, 0), (0, 0, h), 16, 6, lambda i, j: "steelD" if j < 2 else "steel" if i % 8 else "seam")
        else:
            m.pattern((-0.5 + t + ee, -0.5, 0), (0, 1, 0), (0, 0, h), 16, 6, lambda i, j: "steelD" if j < 2 else "steel" if i % 8 else "seam")
    if extra:
        extra(m, axis, t)
    return [m.build()]


def _on_wall(m, axis, t, c_along, z, size_along, size_h, depth, color):
    """Place a thin box on the visible face of a wall."""
    if axis == "x":
        m.box((c_along, -0.5 + t + depth / 2, z), (size_along, depth, size_h), color, base=True)
    else:
        m.box((-0.5 + t + depth / 2, c_along, z), (depth, size_along, size_h), color, base=True)


def light_extra(color_panel, bracket="gmD"):
    def f(m, axis, t):
        _on_wall(m, axis, t, 0, 0.66, 0.34, 0.12, 0.07, bracket)
        _on_wall(m, axis, t, 0, 0.685, 0.26, 0.06, 0.085, color_panel)
    return f


def beacon_extra(m, axis, t):
    _on_wall(m, axis, t, 0, 0.62, 0.16, 0.16, 0.06, "gmD")
    _on_wall(m, axis, t, 0, 0.64, 0.1, 0.12, 0.1, "red")


def door(axis="x"):
    m = core.Mesh(f"door_{axis}")
    t = T + 0.04
    a = lambda c, s, z, h, d, col: _on_wall(m, axis, 0.0, c, z, s, h, d, col)  # noqa: E731
    # frame straddles the wall slot; geometry centred in the wall strip
    def box(along, sz_along, z, hh, thick, off, col, top=None):
        if axis == "x":
            m.box((along, -0.5 + off, z), (sz_along, thick, hh), col, top=top, base=True)
        else:
            m.box((-0.5 + off, along, z), (thick, sz_along, hh), col, top=top, base=True)
    box(-0.4, 0.2, 0, H, t, t / 2, "steelL", "plate")
    box(0.4, 0.2, 0, H, t, t / 2, "steelL", "plate")
    box(0, 1.0, H - 0.2, 0.2, t, t / 2, "gmD", "gm")
    box(0, 0.6, 0, 0.8, 0.1, t / 2 + 0.02, "steel", "steelL")
    box(0, 0.5, 0, 0.14, 0.11, t / 2 + 0.02, "hazY")
    box(0, 0.3, 0.56, 0.12, 0.115, t / 2 + 0.02, "steelD")
    box(-0.27, 0.06, 0.62, 0.1, 0.13, t / 2 + 0.02, "cyan")
    box(0.27, 0.06, 0.62, 0.1, 0.13, t / 2 + 0.02, "orange")
    box(0.0, 0.18, H - 0.1, 0.05, t + 0.02, t / 2, "magenta")
    return [m.build()]


def console():
    m = core.Mesh("console")
    m.box((0, -0.2, 0), (0.84, 0.46, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    m.box((0, -0.18, 0), (0.7, 0.5, 0.12), "dark", base=True)
    th = 0.5
    n = (0, math.cos(th), math.sin(th))
    up = (0, -math.sin(th), math.cos(th))
    c0 = (0, -0.3, 0.74)
    m.box(c0, (0.78, 0.07, 0.4), "gmD", rx=th, bevel=0.012)
    for k in range(6):
        u = -0.14 + k * 0.058
        p = tuple(c0[i] + n[i] * 0.045 + up[i] * u for i in range(3))
        m.box(p, (0.62, 0.02, 0.036), "magenta", rx=th)
    m.box((0, -0.04, 0.53), (0.66, 0.2, 0.04), "steelL", bevel=0.008)
    for k in range(5):
        m.box((-0.24 + k * 0.12, 0.0, 0.56), (0.07, 0.07, 0.03), "cyan" if k % 2 else "orange")
    m.box((0.34, 0.05, 0.62), (0.05, 0.05, 0.12), "gm", bevel=0.01)
    return [m.build()]


def reactor():
    m = core.Mesh("reactor")
    cx = cy = -0.5
    m.box((cx, cy, 0), (1.92, 1.92, 0.12), "steelD", top="plateA", base=True, bevel=0.02)
    for k in range(10):
        m.box((cx - 0.9 + k * 0.2, cy + 0.95, 0.12), (0.12, 0.05, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
        m.box((cx + 0.95, cy - 0.9 + k * 0.2, 0.12), (0.05, 0.12, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    m.cyl((cx, cy, 0.12), 0.72, 0.78, "steel", sides=8, top="steelL")
    m.cyl((cx, cy, 0.5), 0.745, 0.08, "gmD", sides=8)
    m.cyl((cx, cy, 0.9), 0.55, 0.3, "gm", sides=8, top="plate")
    for a in (0, 45, 90):
        r = 0.72 * math.cos(math.pi / 8) + 0.005
        ar = math.radians(a)
        m.box((cx + r * math.cos(ar), cy + r * math.sin(ar), 0.2), (0.025, 0.11, 0.55), "cyan", rz=ar, base=True)
    m.cyl((cx, cy, 1.02), 0.3, 0.7, "cyan", sides=8)
    m.cyl((cx, cy, 1.72), 0.36, 0.06, "steelL", sides=8)
    m.cyl((cx, cy, 1.04), 0.37, 0.05, "steelL", sides=8)
    for a in (0, 45, 90):
        ar = math.radians(a)
        m.box((cx + 0.5 * math.cos(ar), cy + 0.5 * math.sin(ar), 1.0), (0.02, 0.1, 0.16), "orange", rz=ar, base=True)
    m.box((cx + 0.15, cy + 0.84, 0.12), (0.7, 0.2, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    for k in range(4):
        m.box((cx + 0.15 - 0.24 + k * 0.16, cy + 0.9, 0.5), (0.08, 0.06, 0.04), ("magenta", "cyan", "orange", "cyan")[k])
    m.box((cx + 0.15, cy + 0.94, 0.3), (0.5, 0.03, 0.12), "dark")
    m.box((cx - 0.55, cy - 0.55, 0.12), (0.22, 0.22, 0.9), "rust", top="rustD", base=True, bevel=0.02)
    return [m.build()]


def _crate(m, c, s, body, top, post, rz=0.0, z0=0.0):
    m.box((c[0], c[1], z0), (s, s, s * 0.8), body, top=top, base=True, rz=rz, bevel=0.015)
    h = s * 0.8
    k = s / 2 - 0.025
    ca, sa = math.cos(rz), math.sin(rz)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * k, sy * k
            m.box((c[0] + x * ca - y * sa, c[1] + x * sa + y * ca, z0), (0.06, 0.06, h + 0.01), post, top=post, base=True, rz=rz)
    m.box((c[0], c[1], z0 + h * 0.5), (s + 0.012, s + 0.012, 0.035), post, base=True, rz=rz)


def crates():
    m = core.Mesh("crates")
    _crate(m, (-0.1, -0.1), 0.72, "rust", "rustD", "steel")
    _crate(m, (-0.1, -0.1), 0.5, "steel", "steelL", "gm", rz=0.18, z0=0.58)
    m.box((0.15, -0.46, 0.14), (0.22, 0.012, 0.16), "hazY", base=True)
    m.box((0.3, 0.28, 0), (0.34, 0.34, 0.3), "steelD", top="steel", base=True, bevel=0.015, rz=-0.15)
    m.box((0.3, 0.28, 0.12), (0.355, 0.355, 0.04), "orange", base=True, rz=-0.15)
    return [m.build()]


def _tile_wall(axis, style, h, extra):
    return lambda: wall(axis, style, h, extra)


SPRITES = [
    ("floor_a", (1, 1), "floor", lambda: floor("a")),
    ("floor_b", (1, 1), "floor", lambda: floor("b")),
    ("floor_c", (1, 1), "floor", lambda: floor("c")),
    ("wall_x", (1, 1), "wall", _tile_wall("x", "std", H, None)),
    ("wall_y", (1, 1), "wall", _tile_wall("y", "std", H, None)),
    ("wall_low_x", (1, 1), "wall", _tile_wall("x", "std", 0.3, None)),
    ("wall_low_y", (1, 1), "wall", _tile_wall("y", "std", 0.3, None)),
    ("hull_x", (1, 1), "wall", _tile_wall("x", "hull", H, None)),
    ("hull_y", (1, 1), "wall", _tile_wall("y", "hull", H, None)),
    ("door_x", (1, 1), "wall", lambda: door("x")),
    ("door_y", (1, 1), "wall", lambda: door("y")),
    ("wall_light_x", (1, 1), "light", _tile_wall("x", "std", H, light_extra("arc"))),
    ("wall_light_y", (1, 1), "light", _tile_wall("y", "std", H, light_extra("arc"))),
    ("emerg_light_x", (1, 1), "light", _tile_wall("x", "std", H, beacon_extra)),
    ("emerg_light_y", (1, 1), "light", _tile_wall("y", "std", H, beacon_extra)),
    ("console", (1, 1), "prop", console),
    ("reactor", (2, 2), "prop", reactor),
    ("crates", (1, 1), "prop", crates),
]
