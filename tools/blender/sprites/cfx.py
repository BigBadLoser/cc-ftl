"""Combat fx: projectiles, muzzle flashes, shield hit ripple, explosion, point-defence tracer.

Camera-facing sprites built directly in screen space: a point (u, v) in tile units (1 unit = 45 px) becomes the Blender
point u * R + v * U, so what you draw is what you get. Projectiles point screen-right (+u); the renderer rotates them
along the flight path. Flat colour bands, selflit (emissive colours also feed the glow sheet), no noise. Frames are
separate ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0."""
import math
import numpy as np
from mathutils import Vector
from . import core

R = Vector(core._R.tolist())
U = Vector(core._U.tolist())
N = Vector((0.6123724, -0.6123724, 0.5))          # towards the camera, for layering coplanar parts


class Bb:
    def __init__(self, name):
        self.m = core.Mesh(name, selflit=True, flat=True)
        self.layer = 0

    def poly(self, pts, color):
        self.layer += 1
        off = N * (0.004 * self.layer)
        self.m.poly([R * u + U * v + off for u, v in pts], color)

    def rect(self, u0, u1, v0, v1, color):
        self.poly([(u0, v0), (u1, v0), (u1, v1), (u0, v1)], color)

    def disc(self, u, v, r, color, n=10, ry=None):
        ry = r if ry is None else ry
        self.poly([(u + r * math.cos(i * math.tau / n + 0.3), v + ry * math.sin(i * math.tau / n + 0.3)) for i in range(n)], color)

    def capsule(self, u0, u1, v, h, color, tip=0.0):
        """Streak from u0 to u1, thickness h; a positive tip adds a pointed head, a negative one a pointed tail."""
        hh = h / 2
        pts = [(u0, v - hh), (u1 - max(tip, 0), v - hh), (u1, v), (u1 - max(tip, 0), v + hh), (u0, v + hh), (u0 - min(tip, 0) * 0, v)]
        if tip < 0:
            pts = [(u0 - tip, v - hh), (u1, v - hh), (u1, v + hh), (u0 - tip, v + hh), (u0, v)]
        self.poly(pts, color)

    def star(self, u, v, r0, r1, n, color, rot=0.0):
        pts = []
        for i in range(n * 2):
            r = r1 if i % 2 == 0 else r0
            a = rot + i * math.pi / n
            pts.append((u + r * math.cos(a), v + r * math.sin(a)))
        self.poly(pts, color)

    def hexring(self, u, v, r, t, color, skip=(), rot=0.0):
        """Hexagon outline of outer radius r and thickness t; skip lists side indices to leave out."""
        for i in range(6):
            if i in skip:
                continue
            a0, a1 = rot + i * math.pi / 3, rot + (i + 1) * math.pi / 3
            ri = r - t
            self.poly([(u + r * math.cos(a0), v + r * math.sin(a0)), (u + r * math.cos(a1), v + r * math.sin(a1)),
                       (u + ri * math.cos(a1), v + ri * math.sin(a1)), (u + ri * math.cos(a0), v + ri * math.sin(a0))], color)

    def hexfill(self, u, v, r, color, rot=0.0):
        self.poly([(u + r * math.cos(rot + i * math.pi / 3), v + r * math.sin(rot + i * math.pi / 3)) for i in range(6)], color)

    def build(self):
        return [self.m.build()]


# ---- projectiles (pointing +u) -------------------------------------------------------------------------------------

def laser_bolt(k):
    b = Bb(f"laser_{k}")
    ln = (0.5, 0.58)[k]
    b.capsule(-ln / 2, ln / 2, 0, 0.13, "cyan", tip=0.09)
    b.capsule(-ln / 2 + 0.1, ln / 2 + 0.02, 0, 0.055, "arc", tip=0.06)
    if k:
        b.rect(-ln / 2 - 0.2, -ln / 2 - 0.08, -0.018, 0.018, "cyan")
    else:
        b.rect(-ln / 2 - 0.12, -ln / 2 - 0.04, -0.018, 0.018, "cyan")
    return b.build()


def mass_slug(k):
    b = Bb(f"slug_{k}")
    for i, (w, col) in enumerate(((0.62, "red"), (0.46, "orange"), (0.3, "flameY"))):     # tapering trail
        b.capsule(-0.2 - w, -0.12, 0, 0.1 - i * 0.025 + k * 0.012, col, tip=-0.12)
    b.capsule(-0.14, 0.17, 0, 0.17, "orange", tip=0.1)
    b.capsule(-0.1, 0.17, 0, 0.1, "flameY", tip=0.08)
    b.capsule(-0.02, 0.16, 0, 0.045, "flameW", tip=0.05)
    return b.build()


def missile(k):
    b = Bb(f"missile_{k}")
    fl = (0.3, 0.4, 0.34)[k]
    b.capsule(-0.2 - fl, -0.17, 0, 0.09 + 0.02 * (k == 1), "orange", tip=-0.14)          # exhaust flame
    b.capsule(-0.2 - fl * 0.6, -0.17, 0, 0.05, "flameY", tip=-0.1)
    b.rect(-0.24, -0.16, -0.075, 0.075, "steelD")                                         # engine bell
    b.poly([(-0.22, 0.05), (-0.1, 0.05), (-0.16, 0.14)], "medRed")                        # fins
    b.poly([(-0.22, -0.05), (-0.1, -0.05), (-0.16, -0.14)], "medRed")
    b.rect(-0.2, 0.12, -0.055, 0.055, "medWhite")                                         # body
    b.rect(-0.2, 0.12, -0.055, -0.02, "steelL")
    b.rect(-0.05, 0.0, -0.058, 0.058, "hivis")                                            # band
    b.poly([(0.12, -0.055), (0.12, 0.055), (0.24, 0.0)], "medRed")                        # nose
    return b.build()


def ion_bolt(k):
    b = Bb(f"ion_{k}")
    b.disc(0, 0, 0.17 + 0.015 * k, "blueN")
    b.disc(0, 0, 0.12, "magenta")
    b.disc(0, 0, 0.065, "arc")
    for i in range(4):                                                                    # arcing sparks, rotate per frame
        a = i * math.pi / 2 + k * math.pi / 4 + 0.4
        r0, r1 = 0.17, 0.27 - 0.04 * (i % 2)
        b.poly([(r0 * math.cos(a) - 0.014, r0 * math.sin(a) - 0.014), (r1 * math.cos(a) - 0.014, r1 * math.sin(a) - 0.014),
                (r1 * math.cos(a) + 0.014, r1 * math.sin(a) + 0.014), (r0 * math.cos(a) + 0.014, r0 * math.sin(a) + 0.014)], "magenta" if i % 2 else "blueN")
    b.capsule(-0.5, -0.15, 0, 0.07, "magenta", tip=-0.12) if k else b.capsule(-0.42, -0.15, 0, 0.06, "blueN", tip=-0.12)
    return b.build()


def fire_shell(k):
    b = Bb(f"fire_shell_{k}")
    b.capsule(-0.4 - 0.05 * k, -0.1, 0.0, 0.14, "red", tip=-0.12)                         # flame tail
    b.capsule(-0.3 - 0.04 * k, -0.08, 0.02 * (1 - 2 * k), 0.09, "orange", tip=-0.1)
    b.disc(0, 0, 0.14, "orange", ry=0.12)
    b.disc(0.01, 0, 0.1, "flameY", ry=0.085)
    b.disc(0.03, 0, 0.05, "flameW", ry=0.045)
    return b.build()


def pd_shot(k):
    b = Bb(f"pd_{k}")
    ln = (0.36, 0.3)[k]
    b.capsule(-ln, ln * 0.2, 0, 0.05, "flameY", tip=0.05)
    b.capsule(-ln * 0.5, ln * 0.2, 0, 0.025, "flameW", tip=0.03)
    return b.build()


# ---- muzzle flashes (radial, so one set serves every rotation) -----------------------------------------------------

def muzzle(kind, k):
    b = Bb(f"muzzle_{kind}_{k}")
    s = (0.6, 1.0, 0.7)[k]
    if kind == "laser":
        b.star(0, 0, 0.06 * s, 0.24 * s, 4, "cyan", 0.0 + k * 0.4)
        b.star(0, 0, 0.04 * s, 0.14 * s, 4, "arc", 0.78 + k * 0.4)
    elif kind == "mass":
        b.star(0, 0, 0.1 * s, 0.34 * s, 6, "orange", 0.2)
        b.star(0, 0, 0.07 * s, 0.22 * s, 6, "flameY", 0.5)
        b.disc(0, 0, 0.09 * s, "flameW")
    elif kind == "missile":
        b.disc(0, 0, 0.2 * s, "gm", n=8)
        b.disc(0, 0, 0.15 * s, "orange", n=8)
        b.disc(0, 0, 0.08 * s, "flameY", n=8)
    elif kind == "ion":
        b.star(0, 0, 0.09 * s, 0.26 * s, 8, "blueN", 0.1)
        b.star(0, 0, 0.06 * s, 0.17 * s, 8, "magenta", 0.3)
        b.disc(0, 0, 0.06 * s, "arc", n=8)
    else:   # fire
        b.disc(0, 0, 0.22 * s, "red", n=10)
        b.disc(0, 0.02, 0.16 * s, "orange", n=10)
        b.disc(0, 0.03, 0.09 * s, "flameY", n=10)
    return b.build()


# ---- shield hit ripple, explosion -----------------------------------------------------------------------------------

def shield_hit(k):
    b = Bb(f"shield_hit_{k}")
    if k == 0:
        b.hexfill(0, 0, 0.1, "arc")
        b.hexring(0, 0, 0.2, 0.05, "cyan")
    elif k == 1:
        b.hexring(0, 0, 0.36, 0.05, "cyan")
        b.hexring(0, 0, 0.17, 0.035, "arc")
        for i in range(6):                                                                  # honeycomb cells lit around the impact
            a = i * math.pi / 3 + math.pi / 6
            b.hexring(0.2 * math.cos(a) * 1.0, 0.2 * math.sin(a) * 1.0, 0.1, 0.025, "cyan", skip=(0, 3))
    elif k == 2:
        b.hexring(0, 0, 0.56, 0.04, "cyan", skip=(2,))
        b.hexring(0, 0, 0.4, 0.03, "cyan", skip=(0, 3, 4))
        for i in (0, 2, 4):
            a = i * math.pi / 3 + math.pi / 6
            b.hexfill(0.3 * math.cos(a), 0.3 * math.sin(a), 0.045, "cyan")
    else:
        b.hexring(0, 0, 0.74, 0.03, "cyan", skip=(4,))
        b.hexring(0, 0, 0.58, 0.025, "cyan", skip=(0, 2, 3))
        for i in (1, 5):
            a = i * math.pi / 3
            b.hexfill(0.45 * math.cos(a), 0.45 * math.sin(a), 0.03, "cyan")
    return b.build()


def explosion_small(k):
    b = Bb(f"explosion_{k}")
    blob = lambda r, col, n=12: b.disc(0, 0, r, col, n=n)       # noqa: E731
    if k == 0:
        blob(0.16, "orange"); blob(0.11, "flameY"); blob(0.06, "flameW")
    elif k == 1:
        b.star(0, 0, 0.2, 0.36, 8, "orange", 0.2); blob(0.22, "orange"); blob(0.16, "flameY"); blob(0.09, "flameW")
    elif k == 2:
        b.star(0, 0, 0.26, 0.46, 9, "red", 0.4); blob(0.3, "orange"); blob(0.2, "flameY"); blob(0.1, "flameW")
        for a in (0.3, 2.0, 4.1):
            b.disc(0.5 * math.cos(a), 0.42 * math.sin(a), 0.04, "flameY", n=6)
    elif k == 3:
        b.disc(0, 0.02, 0.34, "gmD", n=12); blob(0.26, "red"); blob(0.15, "orange")
        for a in (0.8, 2.5, 4.6):
            b.disc(0.56 * math.cos(a), 0.46 * math.sin(a), 0.03, "orange", n=6)
    else:
        b.disc(0, 0.04, 0.3, "steelD", n=12); b.disc(0, 0.05, 0.2, "grime", n=10)
        for a in (0.2, 1.8, 3.4, 5.0):
            b.disc(0.3 * math.cos(a), 0.25 * math.sin(a), 0.035, "red", n=6)
    return b.build()


SPRITES = []
for _name, _fn, _n in (("laser_bolt", laser_bolt, 2), ("mass_slug", mass_slug, 2), ("missile", missile, 3), ("ion_bolt", ion_bolt, 2),
                       ("fire_shell", fire_shell, 2), ("pd_shot", pd_shot, 2), ("shield_hit", shield_hit, 4),
                       ("explosion_small", explosion_small, 5)):
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
for _kind in ("laser", "mass", "missile", "ion", "fire"):
    SPRITES += [(f"fx.muzzle.{_kind}.{_k}", (1, 1), "fx", lambda kd=_kind, k=_k: muzzle(kd, k)) for _k in range(3)]
