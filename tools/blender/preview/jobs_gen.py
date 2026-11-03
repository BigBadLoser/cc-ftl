"""The generic hull pieces (wall3d_ext_diag: diagonals, far sides, notches) and their roof stand-ins for every hull key
of SHIPS (belly_shapes names, space-separated; by default the four test ships)."""
import os
import sys
from pathlib import Path

from sprites import hull_outline as HO
from sprites import wall3d_ext_diag as DG

sys.path.insert(0, str(Path(__file__).parent))
import belly_shapes as BS  # noqa: E402

KEYS = sorted({k for nm in os.environ.get("SHIPS", "oct3 taper2 s1040 s2420").split() for k in BS.keys(nm).values()})
JOBS = {f"tile.hull.ext.g.{HO.name(k)}": ("block", (lambda k=k: DG.piece(k))) if DG.uses_art(k) else
        ("wide", (lambda k=k: (DG.piece(k), DG.piece(k, margin=DG.WIDE)))) for k in KEYS if k}
JOBS.update({f"tile.roof.g.{HO.name(k) or 'full'}": ("block", (lambda k=k: DG.roof(k))) for k in KEYS})
