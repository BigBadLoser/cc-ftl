"""Faction structure sets (family `structure`): every default wall, hull and floor tile (envtiles.SPRITES) rebuilt
through a faction look (structure_looks, restyle), under the same id with a faction segment after the family:

  tile.<fam>.<look>.<rest of the default id>      e.g. tile.hull.navy.full.m10.v1, tile.wall.civil.v2.end.s,
                                                       tile.hull.scrap.p3.belly.o1.m10, tile.floor.drone.a

<look> is navy | drone | civil.v1..v4 | scrap.p1..p4. The far hull (up and cut) and the full-height walls of every
look but scrap also come in three alt variants `<id>.a1..a3`: one small feature in the middle of the tile (a vent, a
hatch, a porthole, a status light ...) that leaves the edges alone, so alts tile with the plain pieces. Doors and the hull ghosts (see-through edge lines) are left out:
they read the same in every look, so the renderer's chain falls back to the default. Env STRUCT_LOOKS (comma list) and
STRUCT_IDS (comma list of default ids) narrow a build for previews."""
import os
import re

from .envtiles import SPRITES as DEFAULT
from .restyle import restyled
from .structure_looks import Civil, Drone, Navy
from .structure_scrap import Scrap


def look(name):
    """navy | drone | civil.v1..v4 | scrap.p1..p4 (from the default look)."""
    if name == "navy":
        return Navy()
    if name == "drone":
        return Drone()
    if name.startswith("civil.v"):
        return Civil(int(name[-1]))
    if name.startswith("scrap.p"):
        return Scrap(int(name[-1]))
    raise KeyError(name)


LOOKS = ("navy", "drone", "civil.v1", "civil.v2", "civil.v3", "civil.v4", "scrap.p1", "scrap.p2", "scrap.p3", "scrap.p4")


ALT = re.compile(r"^tile\.(hull\.(full\.)?|wall\.full\.)m\d+$")      # pieces with alt variants .a1..a3
CORNER = re.compile(r"\.m\d+c\d+|\.end\.[se]\.c\d")     # corner-fill pieces: default look only for now


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
            if kind == "ghost" or sid.startswith("tile.door") or CORNER.search(sid) or (only and sid not in only):
                continue
            fid = faction_id(sid, name)
            out.append((fid, fp, kind, _wrap(lk, fid, fn)))
            if not name.startswith("scrap") and ALT.match(sid):
                for n in (1, 2, 3):
                    out.append((f"{fid}.a{n}", fp, kind, _wrap(lk, f"{fid}.a{n}", fn)))
    return out
