"""The one place the art scale lives (no bpy, so crew_spec and the pipeline checks can import it).

TILE_W x TILE_H is a floor diamond in art px; the game's `src/render/iso.ts` TILE_W/TILE_H must be the same numbers
(src/render/heights.test.ts reads them back from the manifest's `tile`). 128x64 is 2x the old 64x32 baseline.
ART_SCALE is that ratio: pixel literals written for the 64x32 baseline are multiplied by it."""
TILE_W, TILE_H = 128, 64
ART_SCALE = TILE_W // 64

# Largest sheet side in px (phone GPU texture limit); pack.py splits a family into more sheets past it.
MAX_SHEET = 4096
