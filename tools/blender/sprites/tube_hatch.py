"""The prefab base tube's door (issue #508, study): drawn instead of the corridor door (door_block's metal door) where a
module opens onto a tube. The same door piece (frame, feet, threshold, its fit in the wall), made a pressure hatch:
the opening's corners cut much deeper (a rounded opening, near an octagon, echoing the round hull port outside), the
jambs in hazard bands (door_frame "hazard") and a split leaf (two halves sliding into the jambs).

  tube.hatch.<x|y>[.open]"""
from . import door_block as DB

CT, CB = 0.3, 0.26     # the opening's top corners' cut, and its bottom corners' (door_block's: 0.25, 0.2)


def hatch(axis="x", is_open=False):
    was = DB.CT, DB.CBU, DB.CBZ
    DB.CT, DB.CBU, DB.CBZ = CT, CB, CB
    try:
        return DB.door(axis, is_open, leaf="split", look="metal", frame="hazard")
    finally:
        DB.CT, DB.CBU, DB.CBZ = was
