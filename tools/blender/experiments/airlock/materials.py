"""Isolated AIRLOCK paint swatches; never modify the game's shared palette."""
import numpy as np
from lib import palette
from sprites import post

SWATCHES = {
    "air.rose": {"hex": "#a8797c"},
    "air.roseD": {"hex": "#715459"},
    "air.blue": {"hex": "#536779"},
    "air.blueL": {"hex": "#7c8c99"},
    "air.ochre": {"hex": "#b68a43"},
    "air.ivory": {"hex": "#c3c3ae"},
    "air.green": {"hex": "#3df08a", "emissive": 2.5},
}


def install():
    palette._data.update(SWATCHES)
    post.PAL.update(SWATCHES)
    post.BASE = post.build_palette()
    post.NB = len(post.BASE)
    post.PALETTE = np.vstack([post.BASE, post.KEYS])
    post.LUT = post._lut()
    post.BAND_MAP = post._band_map()
