"""Palette loader: reads the repo-root palette.json (single source of truth, also read by the game)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
_data = json.loads((ROOT / "palette.json").read_text())
_data.update(json.loads((ROOT / "tools/blender/palette_extra.json").read_text()))   # neon extras for combat art (not in the game palette)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(name):
    """sRGB floats (0..1) of a palette entry."""
    h = _data[name]["hex"].lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def linear(name):
    """Linear-light floats, what glTF vertex colours and factors expect."""
    return tuple(srgb_to_linear(c) for c in srgb(name))


def emissive(name):
    """Emissive strength, or None for non-glowing entries."""
    return _data[name].get("emissive")


def glow_names():
    return [n for n, v in _data.items() if "emissive" in v]


def names():
    return list(_data)
