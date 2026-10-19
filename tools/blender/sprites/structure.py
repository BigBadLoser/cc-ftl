"""Faction structure sets (family `structure`): every default wall, hull and floor tile (envtiles.SPRITES) rebuilt
through a faction look (structure_looks, restyle), under the same id with a faction segment after the family:

  tile.<fam>.<look>.<rest of the default id>      e.g. tile.hull.navy.full.m10.v1, tile.wall.civil.v2.end.s,
                                                       tile.hull.scrap.p3.belly.o1.m10, tile.floor.drone.a

<look> is navy | drone | civil.v1..v4 | scrap.p1..p4. Doors and the hull ghosts (see-through edge lines) are left out:
they read the same in every look, so the renderer's chain falls back to the default. Env STRUCT_LOOKS (comma list) and
STRUCT_IDS (comma list of default ids) narrow a build for previews."""
import os

from .envtiles import SPRITES as DEFAULT
from .restyle import restyled
from .structure_looks import LOOKS, look


def faction_id(sid, name):
    fam, rest = sid.split(".", 2)[1], sid.split(".", 2)[2]
    return f"tile.{fam}.{name}.{rest}"


def _wrap(lk, fid, fn):
    def build():
        with restyled(lk, fid):
            return fn()
    return build


def jobs():
    names = os.environ.get("STRUCT_LOOKS", ",".join(LOOKS)).split(",")
    only = set(os.environ["STRUCT_IDS"].split(",")) if os.environ.get("STRUCT_IDS") else None
    out = []
    for name in names:
        lk = look(name)
        for sid, fp, kind, fn in DEFAULT:
            if kind == "ghost" or sid.startswith("tile.door") or (only and sid not in only):
                continue
            fid = faction_id(sid, name)
            out.append((fid, fp, kind, _wrap(lk, fid, fn)))
    return out
