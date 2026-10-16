"""Animation clips for the human armature, ported from the crew lab's pose() (same formulas, same feel).

Each clip is a function (k, n) -> pose dict for frame k of an n-frame loop; angles are three.js Euler radians.
Arms flare slightly outward (the lab's inward z-lean clipped the torso on the real arm meshes).
"""
import math

LEAN = 0.04
FPS = 24


def idle(k, n):
    u = math.tau * k / n
    b = math.sin(u)
    return {
        "hips": {"p": (0, 0.004 * b, 0), "r": (0, 0, 0.02 * math.sin(u + 1.0))},
        "spine": {"r": (LEAN, 0.08, -0.03), "s": (1 + 0.008 * b, 1 + 0.02 * b, 1)},
        "head": {"r": (0.03 * b - LEAN * 0.6, 0.2 * math.sin(u + 0.5), 0.03)},
        "arm.L": {"r": (0.05 + 0.04 * b, 0, 0.1)}, "arm.R": {"r": (0.05 - 0.04 * b, 0, -0.1)},
        "forearm.L": {"r": (-0.28, 0, 0)}, "forearm.R": {"r": (-0.35, 0, 0)},
    }


def walk(k, n):
    ph = math.tau * k / n
    f, c = math.sin(ph), math.cos(ph)
    hip_l, hip_r = -0.7 * f, 0.7 * f
    kn_l, kn_r = 0.12 + 0.85 * max(0, c), 0.12 + 0.85 * max(0, -c)
    return {
        "hips": {"p": (0, 0.034 * abs(c) - 0.014, 0), "r": (0, 0.12 * f, 0)},
        "spine": {"r": (0.08 + LEAN, -0.18 * f, 0.07 * c), "s": (1, 1, 1)},
        "head": {"r": (-LEAN * 0.6, 0.1 * f, 0)},
        "leg.L": {"r": (hip_l, 0, 0)}, "leg.R": {"r": (hip_r, 0, 0)},
        "shin.L": {"r": (kn_l, 0, 0)}, "shin.R": {"r": (kn_r, 0, 0)},
        "foot.L": {"r": (-(hip_l + kn_l) * 0.55, 0, 0)}, "foot.R": {"r": (-(hip_r + kn_r) * 0.55, 0, 0)},
        "arm.L": {"r": (0.6 * f, 0, 0.08 + 0.1 * c)}, "arm.R": {"r": (-0.6 * f, 0, -0.08 + 0.1 * c)},
        "forearm.L": {"r": (-0.3 - 0.25 * max(0, -f), 0, 0)}, "forearm.R": {"r": (-0.3 - 0.25 * max(0, f), 0, 0)},
    }


def work(k, n):
    w = math.tau * k / n
    s = math.sin(w + 0.5 * math.sin(w))  # slow wind-up, fast strike
    return {
        "hips": {"p": (0, -0.05, 0)},
        "spine": {"r": (0.22, 0.12, 0), "s": (1, 1, 1)},
        "head": {"r": (0.15, -0.1, 0)},
        "leg.L": {"r": (-0.35, 0, 0)}, "leg.R": {"r": (-0.1, 0, 0)},
        "shin.L": {"r": (0.55, 0, 0)}, "shin.R": {"r": (0.35, 0, 0)},
        "foot.L": {"r": (-0.2, 0, 0)}, "foot.R": {"r": (-0.25, 0, 0)},
        "arm.R": {"r": (-1.15 + 0.55 * s, 0, -0.05)}, "forearm.R": {"r": (-0.9 + 0.45 * s, 0, 0)},
        "arm.L": {"r": (-1.1, 0, 0.1)}, "forearm.L": {"r": (-0.45 + 0.03 * math.sin(4 * w), 0, 0)},
    }


def sleep(k, n):
    u = math.tau * k / n
    b = math.sin(u)
    return {
        "root": {"p": (0, 0.24, 0), "r": (-math.pi / 2, 0, 0)},
        "spine": {"s": (1 + 0.01 * b, 1 + 0.025 * b, 1 + 0.01 * b)},
        "head": {"r": (0, 0.35, 0.06)},
        "arm.L": {"r": (0.1, 0, 0.2)}, "arm.R": {"r": (0.05, 0, -0.22)},
        "forearm.L": {"r": (-0.35, 0, 0)}, "forearm.R": {"r": (-0.55, 0, 0)},
        "leg.L": {"r": (0, 0, 0.07)}, "leg.R": {"r": (-0.08, 0, -0.1)},
        "shin.R": {"r": (0.2, 0, 0)},
    }


# name -> (function, frames per loop)
CLIPS = {"idle": (idle, 72), "walk": (walk, 24), "work": (work, 16), "sleep": (sleep, 96)}
