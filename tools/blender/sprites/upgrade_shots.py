"""Neutral shot sprites for the behaviour upgrades (family `upgrades`): the weapons' own shots (fx_shots.py) rebuilt with
their colours mapped to white and greys, so the renderer's per-upgrade tint (WeaponDef.look, slice 2) colours them
cleanly instead of multiplying a shot that is already cyan, orange or red.

  fx.<shot>_neutral.<k>   the same geometry and frames as fx.<shot>.<k>; fx.<shot>_neutral is frame 0
  shots: laser_bolt (6), mass_slug (4), missile (4), ion_bolt (6), fire_shell (4)

Glowing tones go to a white-to-grey glow ramp by brightness (upN0 .. upN3); the hardware (slug, missile body and band) to
the family's plain steels; smoke to plain greys. Rendered in this family's palette set, so the fx family is untouched."""
from . import core
from .fx_shots import SHOTS

USED = ("laser_bolt", "mass_slug", "missile", "ion_bolt", "fire_shell")
NEUTRAL = {
    "fxC0": "upN0", "fxI0": "upN0", "fxW": "upN0", "fxY": "upN0",      # hottest
    "fxC1": "upN1", "fxI1": "upN1", "fxO": "upN1",
    "fxC2": "upN2", "fxI2": "upN2", "fxR": "upN2",
    "fxD": "upN3",
    "fxS": "upNs", "fxSD": "upNsd",                                    # smoke
    "steel": "upSteel", "steelL": "upBolt", "plate": "upSteel", "gm": "upGun", "gmD": "upBlack", "rustD": "upSteelD",
    "missile": "upBolt", "medRed": "upBolt",
}


def _neutral(fn, k):
    core.REMAP.update(NEUTRAL)
    try:
        return fn(k)
    finally:
        for key in NEUTRAL:
            core.REMAP.pop(key, None)


def jobs():
    out = []
    for name, fn, n in SHOTS:
        if name not in USED:
            continue
        out += [(f"fx.{name}_neutral.{k}", (1, 1), "fx", lambda f=fn, k=k: _neutral(f, k)) for k in range(n)]
        out.append((f"fx.{name}_neutral", (1, 1), "fx", lambda f=fn: _neutral(f, 0)))
    return out
