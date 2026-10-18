"""Shield generators (interior, 1x2 four rotations + 1x1 small), the four consoles and the AI core.

Consoles and the AI core are 1x1 and front-facing like `module.console` (operator on +y). The shield generator uses the
cmbkit local frame (u = long axis); the emitter dish sits at +u."""
import math
from . import core, cmbkit
from .cmbkit import Frame, platform


def _console_base(m, screen_col, accent):
    """Shared desk + tilted screen housing. Returns (centre, normal, up) of the screen plane."""
    m.box((0, -0.2, 0), (0.84, 0.46, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    m.box((0, -0.18, 0), (0.7, 0.5, 0.12), "dark", base=True)
    th = 0.5
    n = (0, math.cos(th), math.sin(th))
    up = (0, -math.sin(th), math.cos(th))
    c0 = (0, -0.3, 0.74)
    m.box(c0, (0.84, 0.09, 0.44), "gmD", rx=th, bevel=0.012)
    m.box((0, -0.04, 0.53), (0.7, 0.2, 0.04), "steelL", bevel=0.008)
    return c0, n, up, th


def _on_screen(m, c0, n, up, th, u, w, v, h, color, lift=0.052):
    """A flat rectangle on the screen plane: u across, v along the slope (centred on the screen centre)."""
    p = tuple(c0[i] + n[i] * lift + up[i] * v + (u if i == 0 else 0.0) for i in range(3))
    m.box(p, (w, 0.012, h), color, rx=th)


def weapons_console():
    m = core.Mesh("weapons_console")
    c0, n, up, th = _console_base(m, "orange", "red")
    sc = lambda *a, **k: _on_screen(m, c0, n, up, th, *a, **k)  # noqa: E731
    sc(0, 0.7, 0, 0.34, "dark")                                                     # screen glass
    for k in range(3):                                                              # target list bars
        sc(-0.24, 0.12, 0.12 - k * 0.1, 0.06, "orange")
    sc(0.08, 0.035, 0.0, 0.3, "red")                                               # crosshair
    sc(0.08, 0.3, 0.0, 0.035, "red")
    sc(0.08, 0.06, 0.0, 0.06, "flameY")
    sc(0.22, 0.06, 0.1, 0.06, "orange")                                            # blips
    sc(0.0, 0.06, -0.12, 0.06, "orange")
    m.box((0, -0.3, 0.9), (0.84, 0.05, 0.03), "red", rx=th)                         # warning bar on the bezel
    m.cyl((-0.26, 0.0, 0.54), 0.1, 0.05, "hazY", sides=8)                           # guarded fire button
    m.cyl((-0.26, 0.0, 0.59), 0.07, 0.05, "red", sides=8)
    m.cyl((0.24, 0.0, 0.54), 0.045, 0.2, "gm", sides=6)                             # joystick
    m.cyl((0.24, 0.0, 0.74), 0.065, 0.06, "red", sides=6)
    return [m.build()]


def shield_console():
    m = core.Mesh("shield_console")
    c0, n, up, th = _console_base(m, "cyan", "cyan")
    sc = lambda *a, **k: _on_screen(m, c0, n, up, th, *a, **k)  # noqa: E731
    sc(0, 0.7, 0, 0.34, "dark")
    for (w, h, off) in ((0.28, 0.28, 0), (0.18, 0.18, 0)):                          # concentric shield rings
        sc(0, w, off + h / 2, 0.04, "cyan")
        sc(0, w, off - h / 2, 0.04, "cyan")
        sc(-w / 2, 0.04, off, h, "cyan")
        sc(w / 2, 0.04, off, h, "cyan")
    sc(0, 0.06, 0, 0.06, "arc")
    for k in range(3):                                                              # layer pips
        sc(-0.28, 0.05, 0.1 - k * 0.1, 0.05, "cyan")
    for k, x in enumerate((-0.24, 0.0, 0.24)):                                      # slider tracks and knobs
        m.box((x, 0.0, 0.55), (0.05, 0.22, 0.02), "dark", base=True)
        m.box((x, -0.06 + 0.06 * k, 0.57), (0.08, 0.05, 0.05), "cyan", base=True)
    m.box((0.0, -0.3, 0.9), (0.84, 0.05, 0.03), "cyan", rx=th)
    return [m.build()]


def helm():
    m = core.Mesh("helm")
    c0, n, up, th = _console_base(m, "green", "green")
    sc = lambda *a, **k: _on_screen(m, c0, n, up, th, *a, **k)  # noqa: E731
    sc(0, 0.7, 0, 0.34, "dark")
    for k in range(4):                                                              # nav grid
        sc(0, 0.6, -0.12 + k * 0.08, 0.025, "green")
    for k in range(4):
        sc(-0.24 + k * 0.16, 0.025, 0, 0.3, "green")
    for k, w in enumerate((0.16, 0.1, 0.05)):                                       # course chevron (white)
        sc(0.0, w, -0.03 + k * 0.045, 0.04, "flameW")
    sc(0.22, 0.05, 0.1, 0.05, "flameW")                                             # waypoint
    m.box((0, -0.3, 0.9), (0.84, 0.05, 0.03), "green", rx=th)
    m.cyl((0.0, 0.02, 0.54), 0.04, 0.2, "gm", sides=6)                              # wheel stalk
    m.cyl((0.0, 0.02, 0.72), 0.17, 0.04, "steelL", sides=8)                         # wheel disc
    m.cyl((0.0, 0.02, 0.74), 0.11, 0.03, "dark", sides=8)
    m.box((0.0, 0.02, 0.73), (0.38, 0.04, 0.04), "gm")
    m.box((0.0, 0.02, 0.73), (0.04, 0.38, 0.04), "gm")
    m.box((0.0, 0.02, 0.76), (0.07, 0.07, 0.04), "green")
    for sx in (-1, 1):                                                              # throttles
        m.box((sx * 0.33, 0.04, 0.54), (0.05, 0.05, 0.14), "gm", base=True)
        m.box((sx * 0.33, 0.04, 0.68), (0.07, 0.07, 0.05), "flameW")
    return [m.build()]


def ai_core():
    """Server tower: a tall rack with drive bays blinking magenta and a data spine."""
    m = core.Mesh("ai_core")
    m.dz = -0.1                                                                              # no floor slab
    m.box((0, 0, 0.1), (0.7, 0.7, 1.15), "gmD", top="gm", base=True, bevel=0.015)           # tower body
    m.box((0, 0, 1.25), (0.76, 0.76, 0.06), "steelL", top="plate", base=True, bevel=0.01)    # cap
    m.box((0, 0, 0.1), (0.76, 0.76, 0.06), "steel", base=True)                                # plinth lip
    for k in range(6):                                                                        # drive bays on both faces
        z = 0.22 + k * 0.17
        for (cx, cy, sx, sy) in ((0.0, 0.352, 0.5, 0.014), (0.352, 0.0, 0.014, 0.5)):
            m.box((cx, cy, z), (sx, sy, 0.11), "dark", base=True)
            lx, ly = (0.0, 0.0) if sy < sx else (0.0, 0.0)
        m.box((-0.12, 0.362, z + 0.03), (0.2, 0.014, 0.05), "magenta" if k % 2 == 0 else "dark", base=True)
        m.box((0.362, -0.12, z + 0.03), (0.014, 0.2, 0.05), "magenta" if k % 2 == 0 else "dark", base=True)
        m.box((0.14, 0.362, z + 0.03), (0.05, 0.014, 0.05), "cyan" if k % 3 == 1 else "magenta", base=True)
        m.box((0.362, 0.14, z + 0.03), (0.014, 0.05, 0.05), "cyan" if k % 3 == 1 else "magenta", base=True)
    m.box((0.36, 0.36, 0.14), (0.05, 0.05, 1.08), "magenta", base=True)                      # data spine (front corner)
    m.cyl((-0.15, -0.15, 1.31), 0.1, 0.12, "gm", sides=8, top="plate")                        # core antenna
    m.cyl((-0.15, -0.15, 1.43), 0.035, 0.22, "steelL", sides=6)
    m.box((-0.15, -0.15, 1.64), (0.07, 0.07, 0.07), "magenta", base=True)
    return [m.build()]


# ---- shield generator ------------------------------------------------------------------------------------------

def _dish(f, u, v, r, z0):
    f.vcyl(u, v, z0, r * 0.7, 0.1, "steelD", top="steel")                               # base
    f.vcyl(u, v, z0 + 0.1, 0.13, 0.4, "gm", top="plate")                                # pylon
    f.vcyl(u, v, z0 + 0.3, 0.17, 0.05, "cyan")                                          # pylon ring (glow)
    f.vcyl(u, v, z0 + 0.5, 0.2, 0.2, "plate", rtop=r)                                   # dish cone
    f.vcyl(u, v, z0 + 0.7, r, 0.03, "gm", rtop=r * 0.95)
    f.vcyl(u, v, z0 + 0.73, r * 0.8, 0.012, "dark")                                     # concave interior
    f.vcyl(u, v, z0 + 0.74, r * 0.62, 0.01, "cyan")                                     # glowing ring
    f.vcyl(u, v, z0 + 0.75, r * 0.48, 0.012, "steelD")
    f.vcyl(u, v, z0 + 0.76, 0.07, 0.3, "cyan", rtop=0.05)                               # emitter spire
    f.vcyl(u, v, z0 + 1.06, 0.06, 0.05, "arc", rtop=0.01)
    for k in range(4):                                                                  # field nodes
        a = math.pi / 4 + k * math.pi / 2
        x, y = u + (r + 0.0) * math.cos(a) * 0.96, v + (r + 0.0) * math.sin(a) * 0.96
        f.vcyl(x, y, z0 + 0.7, 0.025, 0.2, "gm", sides=4)
        f.vcyl(x, y, z0 + 0.9, 0.04, 0.05, "cyan", sides=4)


def shield_gen(rot):
    m = core.Mesh(f"shield_gen_{rot}")
    f = Frame(m, rot)
    platform(f)
    _dish(f, 0.45, 0, 0.4, 0.1)
    f.box(-0.5, 0, 0.1, 0.85, 0.8, 0.5, "steel", top="steelL")                          # power bank
    f.box(-0.5, 0, 0.6, 0.7, 0.66, 0.06, "gmD", top="gm")
    for sv in (-1, 1):
        f.box(-0.5, sv * 0.405, 0.2, 0.6, 0.02, 0.07, "cyan")
        for k in range(3):
            f.box(-0.72 + k * 0.22, sv * 0.405, 0.35, 0.1, 0.02, 0.1, "dark")
    f.hcyl(-0.1, 0.35, 0, 0.3, 0.06, "gm")                                              # conduit to the pylon
    f.hcyl(0.0, 0.05, 0, 0.3, 0.075, "cyan")
    f.hcyl(0.2, 0.25, 0, 0.3, 0.075, "cyan")
    return [m.build()]


def shield_gen_small():
    m = core.Mesh("shield_gen_small")
    f = Frame(m, 0, square=True)
    f.m.dz = -0.1                                                                       # no floor slab
    _dish(f, 0.0, 0.0, 0.32, 0.1)
    return [m.build()]


SPRITES = []
for _r in range(4):
    _sfx = "" if _r == 0 else f".r{_r}"
    SPRITES.append((f"module.shield_gen{_sfx}", (1, 2) if _r in (0, 2) else (2, 1), "prop", lambda r=_r: shield_gen(r)))
SPRITES += [("module.shield_gen_small", (1, 1), "prop", shield_gen_small),
            ("module.weapons_console", (1, 1), "prop", weapons_console),
            ("module.shield_console", (1, 1), "prop", shield_console),
            ("module.helm", (1, 1), "prop", helm),
            ("module.ai_core", (1, 1), "prop", ai_core)]
