"""Belly pieces (wall3d_belly) in one bay look (LOOK: 20 plain, 21 grille, 22 blister, 26 fins, 27 plate, 28
conduit) for every hull key of SHIPS (belly_shapes names, space-separated): the under layer (below the deck) and
the over layer at the shortest view level ("low": the far hull cut at the rim)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import belly_shapes as BS  # noqa: E402
from sprites import hull_outline as HO  # noqa: E402
from sprites import wall3d_belly as B  # noqa: E402
from sprites import walls as W  # noqa: E402

LK = int(os.environ.get("LOOK", "20"))
KEYS = sorted({k for nm in os.environ.get("SHIPS", "oct3 taper2 s1040 s2420").split() for k in BS.keys(nm).values()
               if k})
JOBS = {f"tile.hull.belly.low.{HO.name(k)}": ("wide", (lambda k=k: B.wide(k, W.ZG, look=LK))) for k in KEYS}
JOBS.update({f"tile.hull.belly.under.{HO.name(k)}": ("wide", (lambda k=k: B.wide(k, W.ZG, "under", look=LK)))
             for k in KEYS})
