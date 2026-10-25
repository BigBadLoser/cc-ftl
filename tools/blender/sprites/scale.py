"""The one place the art size lives (no bpy, so crew_spec and the pipeline checks can import it).

The art is 64x32-tile pixel art, rendered into `public/assets/1x/`. The game draws it at half resolution (each art pixel a
2x2 block of the 128x64 tile grid; `src/render/iso.ts` TILE_W/TILE_H stay 128x64). ART_SCALE is kept as the multiplier
that pixel literals written for the 64x32 baseline go through; it is fixed at 1."""
from pathlib import Path

ART_SCALE = 1
TILE_W, TILE_H = 64 * ART_SCALE, 32 * ART_SCALE

# Largest sheet side in px (phone GPU texture limit); pack.py splits a family into more sheets past it.
MAX_SHEET = 4096

REPO = Path(__file__).resolve().parents[3]


def assets_dir():
    """public/assets/1x: where the sheets, JSON and manifest.json live."""
    return REPO / "public" / "assets" / "1x"
