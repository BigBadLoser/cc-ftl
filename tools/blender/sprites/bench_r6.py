"""Bench look study, round 6 (family `bench6`, palette set bench6, preview only): three concepts, each in its own
colours and materials.

  bn13 fuel tank: a spent olive-drab tank lying in two dark cradles, strapped, with a canvas pad along its top
  bn14 pebbles: a cluster of smooth warm-stone poufs of different sizes, each with a domed rust felt top
  bn15 truss: a gunmetal space-frame truss (three chords, zig-zag diagonals) under a carbon seat plank, titanium end caps

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_study import FP, along_u
from .exercise_r4 import build, sweep
from .exercise_r5 import loop
from .research_kit import Bench

OLIVE, OLIVE_D, CANVAS, CANVAS_D, STRAP = "b6Olive", "b6OliveD", "b6Canvas", "b6CanvasD", "b6Strap"
STONE, STONE_D, FELT, FELT_D = "b6Stone", "b6StoneD", "b6Felt", "b6FeltD"
GUN, GUN_D, CARBON, TITAN = "b6Gun", "b6GunD", "b6Carbon", "b6Titan"


def strut(k, a, b, r, col):
    sweep(k, [(*a, r, r), (*b, r, r)], col, p=2.2, n=10)


def b13():
    k = Bench("bench_b13", FP)
    for u in (-17, 17):                                                            # cradles
        sweep(k, [(u, -7, 0, 2.6, 1.6), (u, -6.5, 3, 2.6, 1.4), (u, 6.5, 3, 2.6, 1.4), (u, 7, 0, 2.6, 1.6)],
              STRAP, p=3, steps=4)
    sweep(k, [(-30, 0, 7.5, 4.5, 4.5), (-28.5, 0, 7.5, 6.6, 6.6), (-25, 0, 7.5, 7.2, 7.2), (25, 0, 7.5, 7.2, 7.2),
              (28.5, 0, 7.5, 6.6, 6.6), (30, 0, 7.5, 4.5, 4.5)], OLIVE, p=2, n=24, cap0=OLIVE_D, cap1=OLIVE_D)   # tank
    along_u(k, -31.5, -29.5, 0, 7.5, 2.4, 2.4, STRAP, p=2.2)                       # end valve
    for u in (-17, 17):
        loop(k, u, 0, 7.5, 7.7, 1.0, STRAP)                                        # strap
    along_u(k, -24, 24, 0, 15.3, 4.6, 1.1, CANVAS, p=4, taper=1, cap0=CANVAS_D, cap1=CANVAS_D)   # canvas pad
    return build(k)


PEBBLES = ((-20, -2, 9, 8, 12.5), (-3, 1, 10, 8.5, 13.5), (15, -3, 8.5, 7.5, 12), (26, 4, 5, 4.5, 8))


def b14():
    k = Bench("bench_b14", FP)
    for u, v, a, b, h in PEBBLES:
        sweep(k, [(u, v, 0, a * 0.82, b * 0.82), (u, v, h * 0.3, a, b), (u, v, h * 0.75, a * 0.97, b * 0.97),
                  (u, v, h - 0.6, a * 0.8, b * 0.8)], STONE, p=2.3, steps=6, cap0=STONE_D, cap1=STONE_D)   # pouf
        sweep(k, [(u, v, h - 1.2, a * 0.78, b * 0.78), (u, v, h + 0.3, a * 0.68, b * 0.68),
                  (u, v, h + 1.1, a * 0.42, b * 0.42), (u, v, h + 1.45, a * 0.03, b * 0.03)], FELT, p=2.2, steps=6,
              cap0=FELT_D, cap1=FELT)                                              # domed felt top
    return build(k)


def b15():
    k = Bench("bench_b15", FP)
    chords = [(-5.5, 1.2), (5.5, 1.2), (0, 9.5)]
    for v, z in chords:
        along_u(k, -27, 27, v, z, 1.1, 1.1, GUN, p=2.2)                            # chords
    for i, u in enumerate(range(-27, 27, 6)):                                      # zig-zag diagonals, both faces
        u1 = u + 6
        for v, _ in chords[:2]:
            a, b = ((u, v, 1.2), (u1, 0, 9.5)) if i % 2 == 0 else ((u, 0, 9.5), (u1, v, 1.2))
            strut(k, a, b, 0.7, GUN_D)
        strut(k, (u, -5.5, 1.2), (u, 5.5, 1.2), 0.6, GUN_D)                       # floor rungs
    for u in (-28, 28):                                                            # titanium end caps
        sweep(k, [(u - 1, 0, 0.3, 7.6, 1), (u - 1, 0, 6, 6, 1), (u - 1, 0, 11.5, 3, 1)][::(1 if u < 0 else 1)],
              TITAN, p=2.6, side=(0.0, 1.0, 0.0), cap0=TITAN, cap1=TITAN)
    along_u(k, -30, 30, 0, 12.4, 8, 1.3, CARBON, p=3.5, taper=1.5)                 # carbon seat plank
    along_u(k, -29, 29, 7.6, 12.4, 0.4, 0.5, TITAN, p=2.2)                         # its titanium edge
    return build(k)


DESIGNS = {"bn13": b13, "bn14": b14, "bn15": b15}


def jobs():
    return [(f"module.bench6.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
