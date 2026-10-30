"""The floor tiles the mocks lay under the rooms (envtiles: tile.floor.a, tile.floor.b)."""
from sprites.envtiles import SPRITES

JOBS = {sid: (kind, fn) for sid, fp, kind, fn in SPRITES if sid in ("tile.floor.a", "tile.floor.b")}
