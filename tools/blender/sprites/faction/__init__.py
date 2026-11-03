"""Faction looks for the structure tiles (family `structure`): each faction has its own relief on the walls and the far
hull (wall3d.STYLE: its face layouts) and its own colours (a restyle.Look mapping the default colour roles onto its
ramps). Floors, caps and ghosts keep the default geometry and take the faction's colours. One module a look:

  navy      after Space Haven's set 4: light plates, a maroon band, a dark header carrying a round lit tube on rounded
            brackets, plate seams up the face and down the ramp
  drone     after set 5: a deep machine housing over a dark lower wall; outer corners a recessed status-light channel
  civil.vN  after set 6: flush white drawers in a fine frame, a colour band under the cap and along the skirt's foot
            (v1 coral, v2 blue, v3 amber, v4 green)
  bastion   after set 8: slate armour, a heavy cornice, a louvred bay recessed between posts over a sloped sill
            (not tied to a faction yet)
  scrap.pN  the default layout with mismatched bolted patch plates, rusty colours (see docs/STRUCTURE_LOOKS.md for
            scrapper ships built from donor looks)

A look's straight-run designs sit beside it (<look>_designs.py): each a relief_style.Design filling named slots its
faces ask for (wall3d.fill), the look's pairs every top with every ramp design.

Shared: base.py (the Look every faction is, its palette ramps), parts.py (the parts a face is built from), shell.py
(shell features several looks use). Both faces of a wall are lit, as in the Space Haven sets (the +x face only a
step darker); the dark navy-slate is the wall's cut end (the end pieces' section), in the look's own shade ramp.
Scrap keeps its plain ends."""
from .bastion import Bastion
from .civil import Civil
from .drone import Drone
from .navy import Navy
from .scrap import Scrap


def look(name):
    """navy | drone | civil.v1..v4 | bastion | scrap.p1..p4."""
    if name == "navy":
        return Navy()
    if name == "drone":
        return Drone()
    if name == "bastion":
        return Bastion()
    if name.startswith("civil.v"):
        return Civil(int(name[-1]))
    if name.startswith("scrap.p"):
        return Scrap(int(name[-1]))
    raise KeyError(name)
