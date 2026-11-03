"""Faction structure sets (family `structure`): every default wall, hull and floor tile (envtiles.SPRITES) rebuilt
through a faction look (faction/: its own relief on the walls and far hull, its own colours through restyle), under
the same id with a faction segment after the family:

  tile.<fam>.<look>.<rest of the default id>      e.g. tile.hull.navy.cap.m10.v1, tile.wall.civil.v2.end.s,
                                                       tile.hull.scrap.p3.belly.o1.m10, tile.floor.drone.a

<look> is navy | drone | civil.v1..v4 | bastion | scrap.p1..p4. Doors and the hull ghosts (see-through edge lines) are left out:
they read the same in every look, so the renderer's chain falls back to the default. Env STRUCT_LOOKS (comma list) and
STRUCT_IDS (comma list of default ids) narrow a build for previews."""
import os
import re

from . import wall3d
from .envtiles import SPRITES as DEFAULT, _variant
from .faction import look
from .restyle import restyled


LOOKS = ("navy", "drone", "civil.v1", "civil.v2", "civil.v3", "civil.v4", "bastion", "scrap.p1", "scrap.p2", "scrap.p3", "scrap.p4")


CORNER = re.compile(r"\.m\d+c\d+|\.end\.[se]\.c\d")     # corner-fill pieces: default look only for now
STRAIGHT = re.compile(r"^tile\.wall\.full\.m(10|5)$")   # straight runs: a look's variants (its pairs)
STAND_IN = "tile.hull.full.m15"                                 # (the engine's stand-in: default look only)
DEFAULT_VARIANT = re.compile(r"\.a\d+$")                       # (the default look's own; a look builds its own)


def faction_id(sid, name):
    fam, rest = sid.split(".", 2)[1], sid.split(".", 2)[2]
    return f"tile.{fam}.{name}.{rest}"


def _wrap(lk, fid, fn):
    def build():
        wall3d.STYLE = lk.relief(fid)                       # the faction's own relief on the walls and hull
        try:
            with restyled(lk, fid):
                return fn()
        finally:
            wall3d.STYLE = None
    return build


def jobs():
    names = os.environ.get("STRUCT_LOOKS", ",".join(LOOKS)).split(",")
    only = set(os.environ["STRUCT_IDS"].split(",")) if os.environ.get("STRUCT_IDS") else None
    out = []
    for name in names:
        lk = look(name)
        for sid, fp, kind, fn in DEFAULT:
            if kind == "ghost" or sid.startswith("tile.door") or sid == STAND_IN or CORNER.search(sid) or \
                    (only and sid not in only):
                continue
            if DEFAULT_VARIANT.search(sid):
                continue
            fid = faction_id(sid, name)
            out.append((fid, fp, kind, _wrap(lk, fid, fn)))
            if STRAIGHT.match(sid):
                for n, tr in enumerate(getattr(lk, "pairs", ()), 1):
                    out.append((f"{fid}.a{n}", fp, kind, _wrap(lk, f"{fid}.a{n}", _variant(fn, tr))))
    return out
