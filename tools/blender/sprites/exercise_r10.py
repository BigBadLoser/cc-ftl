"""Exercise look study round 15 (family `exercise10`, palette set gym, preview only, r0): the sparring droid rebuilt in
the robot crew's style (robots.py) with the same kit (robot_kit.Part): crisp tapered livery plates over a dark exposed
frame, dark hinge discs at the joints, grey plating on the limbs, a dark sensor head with a livery brow and one eye, a
thin amber seam. The droid's upper body sits on round 9's weighted base, post and gimbal ring; it faces +v (crew stand
in front of it), green eye, red gloves up in guard.

  v4a worker: the worker robot's chest, ribs and sensor head on the post
  v4b heavy: the security robot's sloped, broad chest, the head low and forward, pistons up the sides, thicker arms
  v4c shell head: the worker's body with a smooth livery head, a dark glass face and one round eye

Robot parts are in tiles in the character frame (x right, f forward, z up)."""
import math

from .exercise_r4 import FRAME, FRAME_D, build, sweep
from .exercise_r5 import loop
from .exercise_study import FP
from .research_kit import Bench
from .robot_kit import Part

CLOTH, ACCENT, MID, DARK, DARK_L, STEEL = "gymLivery", "gymAmber", "gymSlate", "gymRubber", "gymSlateD", "gymRail"
EYE, GLOVE = "gymEyeG", "gymRed"
V = -16                                                                            # the droid's v (px)
SCALE = 1.2                                                                        # the robot parts' scale (crew size)
LIFT = 0.61 - 0.43 * SCALE                                                         # the spine's foot on the gimbal (tiles)


def stand(k):
    sweep(k, [(0, V, 0, 11, 11), (0, V, 3, 10, 10), (0, V, 6, 6, 6), (0, V, 8, 3, 3)], FRAME_D, p=2.0)   # base
    sweep(k, [(0, V, 8, 2, 2), (0, V, 24, 2, 2)], "gymRail")                       # post
    loop(k, 0, V, 24, 6, 1, FRAME, plane="uv")                                     # gimbal ring


def hinge(p, c, r, w, col=DARK):
    p.cyl(c, r, w, col, axis="x")


def piston(p, a, b, r=0.022):
    m = tuple((u + v) / 2 for u, v in zip(a, b))
    p.strut(a, m, r * 1.45, DARK_L)
    p.strut(m, b, r, STEEL)


def along(a, b, u):
    d = [q - p for p, q in zip(a, b)]
    n = math.sqrt(sum(c * c for c in d))
    return tuple(p + c / n * u for p, c in zip(a, d))


def sensor_head(p, f, z, k=1.0, pitch=0.0, brow=1.0):
    """robots._sensor_head in the gym colours: a dark wedge, a livery brow plate, one eye, on a short neck."""
    c, sn = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    rot = (pitch, 0, 0) if pitch else None

    def at(df, dz):
        return (0, f + df * c - dz * sn, z + df * sn + dz * c)
    p.cyl(at(-0.01, -0.075 * k), 0.045 * k, 0.06 * k, DARK, rot=rot)
    p.rbox(at(0, 0), (0.15 * k, 0.1 * k, 0.2 * k), DARK, r=0.03 * k, taper=0.7, axis="f", rot=rot)
    p.rbox(at(-0.02 * k, 0.045 * k), (0.17 * k * brow, 0.045 * k * brow, 0.2 * k * brow), CLOTH, r=0.02 * k,
           taper=0.75, axis="f", rot=rot)
    p.ball(at(0.105 * k, -0.005 * k), (0.03 * k, 0.015 * k, 0.025 * k), EYE, rot=rot)


def shell_head(p, c, s, eye_r):
    """robots._head in the gym colours: a livery shell, a dark glass face, one round eye."""
    x, f, z = c
    p.ball(c, s, CLOTH)
    p.ball((x, f + s[1] * 0.42, z - s[2] * 0.1), (s[0] * 0.86, s[1] * 0.66, s[2] * 0.7), DARK)
    p.ball((x, f + s[1] * 1.04, z - s[2] * 0.08), (eye_r, eye_r * 0.5, eye_r), EYE)


def arms(p, sh_x=0.245, sh_z=1.02, el=(0.3, 0.1, 0.8), wr=(0.17, 0.27, 0.98), k=1.0, plate=CLOTH, sh_f=0.0, pose=None,
         mitts=False):
    """Guard arms: a hinge disc and a livery shoulder plate, a dark strut with a grey plate to a big dark elbow hinge,
    a grey forearm plate to the red glove held up in front of the face."""
    for sx in (1, -1):
        el_, wr_ = pose[sx] if pose else (el, wr)                                  # (pose: per side (elbow, wrist))
        sh = (sx * sh_x, sh_f, sh_z)                                               # (sh_f: shoulders forward; the
        e = (sx * el_[0], el_[1] + sh_f * 0.5, el_[2])                             #  elbow and glove follow half as far)
        w = (sx * wr_[0], wr_[1] + sh_f * 0.5, wr_[2])
        hinge(p, sh, 0.06 * k, 0.09 * k)
        p.rbox((sx * (sh_x + 0.02), sh_f, sh_z + 0.04), (0.15 * k, 0.19 * k, 0.14 * k), plate, r=0.03, taper=0.8,
               rot=(0, sx * 12, 0))                                                # shoulder plate
        p.strut(sh, e, 0.03 * k, DARK)
        p.plate(along(sh, e, 0.06), along(e, sh, 0.05), 0.085 * k, 0.09 * k, MID, taper=1.1, r=0.02)   # upper arm
        hinge(p, e, 0.055 * k, 0.13 * k)                                           # elbow
        p.plate(along(e, w, 0.04), along(w, e, 0.04), 0.1 * k, 0.11 * k, MID, taper=0.8, r=0.02)       # forearm
        p.rbox(along(w, e, 0.01), (0.07 * k, 0.07 * k, 0.05 * k), DARK_L, r=0.015)                    # wrist
        if mitts:                                                                  # a focus mitt held up, facing out
            p.ball((w[0], w[1] + 0.03, w[2] + 0.04), (0.07 * k, 0.04 * k, 0.085 * k), DARK_L)
            p.ball((w[0], w[1] + 0.055, w[2] + 0.04), (0.08 * k, 0.03 * k, 0.095 * k), GLOVE)
        else:
            p.ball((w[0], w[1] + 0.05, w[2] + 0.03), (0.075 * k, 0.085 * k, 0.08 * k), GLOVE)


def worker_chest(p):
    p.cyl((0, 0, 0.66), 0.07, 0.1, DARK)                                           # waist on the gimbal
    p.rbox((0, 0, 0.78), (0.17, 0.12, 0.17), DARK, r=0.03)                          # abdomen core
    for z in (0.74, 0.815):
        p.rbox((0, 0.005, z), (0.2, 0.135, 0.04), DARK_L, r=0.02)                  # ribs
    p.rbox((0, 0, 0.875), (0.33, 0.21, 0.045), ACCENT, r=0.03)                     # seam
    p.rbox((0, 0.005, 0.985), (0.37, 0.23, 0.18), CLOTH, r=0.03, taper=1.1)        # chest plate
    p.rbox((0, 0.09, 0.98), (0.2, 0.08, 0.13), MID, r=0.02, taper=0.8)             # sternum plate
    p.rbox((0, 0, 1.078), (0.22, 0.03, 0.2), MID, r=0.05, taper=0.75, axis="f")    # head socket rim
    p.rbox((0, 0, 1.082), (0.18, 0.03, 0.16), DARK, r=0.035, taper=0.75, axis="f")


def droid(name, upper):
    def f():
        k = Bench(name, FP)
        stand(k)
        p = Part(f"{name}.upper", "t")
        p.strut((0, 0, 0.43), (0, 0, 0.72), 0.045, DARK)                         # spine up out of the gimbal
        upper(p)
        out = build(k)
        ob = p.build((0.0, 0.0, 0.0))                                              # (origin: the droid's axis)
        ob.scale = (SCALE,) * 3                                                    # the robot parts, scaled about it,
        ob.location = (0.0, -(V / 32 - 0.5), LIFT)                                 # set on the footprint, raised
        out.append(ob)
        return out
    return f


def v4a(p):
    worker_chest(p)
    sensor_head(p, 0.02, 1.165)
    arms(p)


def v4b(p, sh_f=0.0, **kw):
    p.cyl((0, 0, 0.66), 0.08, 0.1, DARK)
    p.rbox((0, 0, 0.77), (0.2, 0.14, 0.16), DARK, r=0.03)                          # abdomen
    for sx in (1, -1):                                                             # side pistons, waist to chest
        piston(p, (sx * 0.1, -0.02, 0.68), (sx * 0.15, 0.0, 0.9))
    p.rbox((0, 0, 0.86), (0.36, 0.24, 0.045), ACCENT, r=0.03)                      # seam
    p.rbox((0, 0.05, 1.0), (0.34, 0.31, 0.3), CLOTH, r=0.04, taper=1.4, rot=(-12, 0, 0))   # sloped broad chest
    p.rbox((0, 0.2, 1.04), (0.2, 0.06, 0.15), DARK_L, r=0.03, taper=1.15, rot=(-12, 0, 0))  # chest inset
    sensor_head(p, 0.12, 1.2, 1.0, pitch=-12, brow=1.15)
    kw = {"el": (0.36, 0.12, 0.8), "wr": (0.2, 0.3, 1.0), **kw}
    arms(p, sh_x=0.3, sh_z=1.04, k=1.2, sh_f=sh_f, **kw)


def v4c(p):
    worker_chest(p)
    p.cyl((0, 0.0, 1.1), 0.045, 0.06, DARK)                                        # neck
    shell_head(p, (0, 0.02, 1.19), (0.1, 0.1, 0.095), 0.028)
    arms(p)


DESIGNS = {"v4a": droid("ex_v4a", v4a), "v4b": droid("ex_v4b", v4b), "v4c": droid("ex_v4c", v4c)}
for _i, _df in enumerate((0.05, 0.09, 0.13), 1):                                   # v4b, shoulders moved forward
    DESIGNS[f"v4b{_i}"] = droid(f"ex_v4b{_i}", lambda p, df=_df: v4b(p, df))


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]


# ---- round 18: v4b, shoulders 0.07 forward, other stances -------------------------------------------------------------
SH_F = 0.07
POSES = {
    "v4d": dict(el=(0.3, 0.1, 0.86), wr=(0.15, 0.24, 1.16)),                       # high guard: gloves by the face,
                                                                                   # elbows down and in
    "v4e": dict(pose={1: ((0.32, 0.2, 0.9), (0.13, 0.46, 1.06)),                    # boxer's stance: lead hand out,
                      -1: ((0.33, 0.06, 0.84), (0.16, 0.2, 1.12))}),                # rear hand by the chin
    "v4f": dict(el=(0.44, 0.1, 0.88), wr=(0.27, 0.34, 1.02), mitts=True),          # holding focus mitts out
}
for _n, _kw in POSES.items():
    DESIGNS[_n] = droid(f"ex_{_n}", lambda p, kw=_kw: v4b(p, SH_F, **kw))
