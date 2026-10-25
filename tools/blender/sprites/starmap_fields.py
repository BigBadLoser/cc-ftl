"""Nebula field tiles for the starmap (family `starmap`): starmap.nebula.haze, .body and .core, seamless square tiles
(256 px at 1x, 512 at 2x, anchor 0,0), glow only (their colour pixels are empty), one per density step of the map's
nebula field. StarmapNebula paints that field in code today from the sim's density tiles (starmapNebula.ts).

The map tiles each texture across the field and shows it only where the density passes its step (about 0.15 haze, 0.45
body, 0.8 core), added over the map at the opacity it wants, so the field gets the stepped, cloudy look of the nebula
bodies. Built like the nebula body: flat glow puffs on a jittered grid, each as strong as a noise density at its centre
(three steps inside each texture), denser puffs in front. The noise is periodic over the tile (an 8-cell lattice) and puffs
near an edge are repeated across it, so the tiles wrap."""
import numpy as np

from . import core
from .starmap_kit import Noise, P, disc, frame_item, glow_only, hue, px, start

TILE = 256                      # 1x px
CELLS = 8                       # noise lattice cells across a tile (the noise repeats after them)
# hue per strength step (or one), glow strength of its three steps, puff spacing (1x px), puff radius in spacings, the
# density below which a puff is left out (gaps)
LEVELS = {
    "haze": dict(hue="fxH2", glow=(0.05, 0.065, 0.08), step=9, r=(0.95, 1.3), gap=0.0, seed=501),
    "body": dict(hue="fxH1", glow=(0.075, 0.1, 0.13), step=7, r=(0.95, 1.3), gap=0.0, seed=502),
    "core": dict(hue=("fxH1", "fxH1", "arc"), glow=(0.13, 0.18, 0.25), step=5, r=(0.8, 1.2), gap=0.42, seed=503),
}


def field_items(name):
    start()
    spec = LEVELS[name]
    rng = np.random.default_rng(spec["seed"])
    noise = Noise(spec["seed"], n=CELLS)
    T, step = px(TILE), px(spec["step"])
    k = int(TILE / spec["step"])
    m = core.Mesh("field")
    for gy in range(k):
        for gx in range(k):
            u, v = (gx + 0.5 + rng.uniform(-0.4, 0.4)) * step, (gy + 0.5 + rng.uniform(-0.4, 0.4)) * step
            d = float(noise.fbm(np.array([u / T * CELLS, v / T * CELLS, 0.5]), 3))
            r = step * rng.uniform(*spec["r"])
            if d < spec["gap"]:
                continue
            lv = min(2, max(0, int((d - 0.35) / 0.1)))
            col = spec["hue"] if isinstance(spec["hue"], str) else spec["hue"][lv]
            look = glow_only(hue(col, spec["glow"][lv]))
            w = lv * px(2) + rng.uniform(0, px(0.5))   # one depth for the puff and its copies
            for du in (-T, 0, T):                       # copies across the edges, so the tile wraps
                for dv in (-T, 0, T):
                    cu, cv = u + du - T / 2, v + dv - T / 2
                    if abs(cu) - r < T / 2 and abs(cv) - r < T / 2:
                        disc(m, P(cu, -cv, w), r, look, segs=16)
    it = frame_item(f"starmap.nebula.{name}", TILE, halo=[m.build()], outline=False)
    return [{**it, "ax": 0, "ay": 0}]


def jobs():
    return [lambda name=name: field_items(name) for name in LEVELS]
