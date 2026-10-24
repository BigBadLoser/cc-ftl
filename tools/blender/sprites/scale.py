"""The one place the art scale lives (no bpy, so crew_spec and the pipeline checks can import it).

ART_SCALE (env var `ART_SCALE`, or `--scale 1|2` on build_sprites.py, which sets it before anything is imported) picks
the art set: 1 renders 64x32 tiles into `public/assets/1x/`, 2 (the default) renders 128x64 tiles into `public/assets/2x/`.
The game's `src/render/iso.ts` TILE_W/TILE_H stay 128x64 in both modes: the 1x sheets are drawn at half resolution there.
Pixel literals written for the 64x32 baseline are multiplied by ART_SCALE."""
import os
from pathlib import Path

ART_SCALE = int(os.environ.get("ART_SCALE", "2"))
if ART_SCALE not in (1, 2):
    raise SystemExit(f"ART_SCALE must be 1 or 2, got {ART_SCALE}")
TILE_W, TILE_H = 64 * ART_SCALE, 32 * ART_SCALE

# Largest sheet side in px (phone GPU texture limit); pack.py splits a family into more sheets past it.
MAX_SHEET = 4096

REPO = Path(__file__).resolve().parents[3]


def assets_dir(scale=None):
    """public/assets/<scale>x: where this scale's sheets, JSON and manifest.json live."""
    return REPO / "public" / "assets" / f"{scale or ART_SCALE}x"
