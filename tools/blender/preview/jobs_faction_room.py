"""The walls-up pieces of every mask, per look (structure.py / faction/; "default" the default walls), and the
straight runs' designs: env STRUCT_LOOKS narrows the looks. For the open-corner and room previews."""
import os

from sprites import structure as ST
from sprites.envtiles import SPRITES, _variant
from sprites.faction import look

IDS = [f"tile.wall.full.m{m}" for m in range(16)]
BY = {sid: (kind, fn) for sid, fp, kind, fn in SPRITES}
LOOKS = os.environ.get("STRUCT_LOOKS", ",".join(ST.LOOKS)).split(",")
JOBS = {}
for name in LOOKS:
    if name == "default":                       # (the default walls, under a faction-like id)
        for sid in IDS:
            JOBS[ST.faction_id(sid, "default")] = BY[sid]
        continue
    lk = look(name)
    for sid in IDS:
        kind, fn = BY[sid]
        fid = ST.faction_id(sid, name)
        JOBS[fid] = (kind, ST._wrap(lk, fid, fn))
        if sid.endswith(("m10", "m5")):
            for n, tr in enumerate(getattr(lk, "pairs", ()), 1):
                JOBS[f"{fid}.a{n}"] = (kind, ST._wrap(lk, f"{fid}.a{n}", _variant(fn, tr)))
