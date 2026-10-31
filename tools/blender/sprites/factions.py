"""Faction looks for the structure tiles (family `structure`): each faction has its own relief on the walls and the far
hull (wall3d.STYLE: its face layouts, factions_relief.py) and its own colours (a restyle.Look mapping the default colour
roles onto its ramps). Floors, caps and ghosts keep the default geometry and take the faction's colours.

  navy      after Space Haven's set 4: light plates, a maroon band, a dark header carrying a round lit tube on rounded
            brackets, plate seams up the face and down the ramp
  drone     after set 5: a deep machine housing over a dark lower wall; outer corners a recessed status-light channel
  civil.vN  after set 6: flush white drawers in a fine frame, a colour band under the cap and along the skirt's foot
            (v1 coral, v2 blue, v3 amber, v4 green)
  bastion   after set 8: slate armour, a heavy cornice, a louvred bay recessed between posts over a sloped sill
            (not tied to a faction yet)
  scrap.pN  the default layout with mismatched bolted patch plates, rusty colours (see docs/STRUCTURE_LOOKS.md for
            scrapper ships built from donor looks)

Both faces of a wall are lit, as in the Space Haven sets (the +x face only a step darker); the dark navy-slate is the
wall's cut end (the end pieces' section), in the look's own shade ramp. Scrap keeps its plain ends."""
from . import factions_relief as R
from . import factions_variants as FV
from . import wall3d as T
from . import walls as W
from .restyle import STEP, Look, ramp
from .structure_looks import FLOOR_STEP

# base colours: wall (partitions), hull (far hull, belly), trim (accents), second (a second tone: headers, recesses,
# frames), shade (faces toward +x), floor
BASES = {
    "fN": dict(wall="#a9b4c4", hull="#97a3b3", trim="#8c3a46", second="#24344a", shade="#3d5a80", floor="#3e4651"),
    "fD": dict(wall="#6b7a82", hull="#5e6d75", trim="#1f2a30", second="#2c3a41", shade="#364757", floor="#2c3236"),
    "fC1": dict(wall="#c9d1d1", hull="#bec6c7", trim="#c4553f", second="#8e989c", shade="#3d5a7c", floor="#5a5852"),
    "fC2": dict(wall="#c9d1d1", hull="#bec6c7", trim="#3d74c4", second="#8e989c", shade="#3d5a7c", floor="#50565b"),
    "fC3": dict(wall="#cfcdc5", hull="#c3c0b7", trim="#d39a2e", second="#948f85", shade="#46526e", floor="#57534b"),
    "fC4": dict(wall="#c8d0ca", hull="#bcc5be", trim="#3f9a66", second="#8a968d", shade="#3b5d6a", floor="#4b544c"),
    "fB": dict(wall="#4a5469", hull="#404a5e", trim="#7585a0", second="#262c3d", shade="#363e55", floor="#2f3440"),
    "fS": dict(wall="#736c60", hull="#5d5b55", trim="#9a5a2c", second="#4a463f", shade="#2e2c29", floor="#46443f"),
}


def palette_entries():
    out = {}
    for pre, b in BASES.items():
        for key, tag in (("wall", "W"), ("hull", "H"), ("trim", "T"), ("second", "S"), ("shade", "X")):
            out.update(ramp(f"{pre}{tag}", b[key]))
        out.update(ramp(f"{pre}F", b["floor"], offsets=(0.16, 0.1, 0.05, 0.0, -0.05, -0.1, -0.16)))
    return out


class Faction(Look):
    pre = ""
    shaded = True                    # the end pieces' section takes the shade ramp (the sets' dark navy cut end)

    def __init__(self):
        self.ramps = {"wall": f"{self.pre}W", "hull": f"{self.pre}H", "trim": f"{self.pre}T", "rose": f"{self.pre}S"}

    def relief(self, sprite):
        return None

    def paint(self, P):
        if P.sprite.startswith("tile.floor"):
            s = FLOOR_STEP.get(P.name)
            return f"{self.pre}F{max(0, min(6, s))}" if s is not None else P.name
        if P.kind == "top" and P.sprite.startswith("tile.wall."):      # a partition's top (cap or cut): black, as
            lv = "up" if ".full." in P.sprite else "low" if ".low." in P.sprite else "cut"   # the default walls'
            if P.z >= W.wall_top("wall", lv) - 0.03:            # (the header's top, 0.02 under the cap, too)
                return T.CUT
        end = P.sprite.partition(".end.")[2][:1]                       # s / e: the end piece's section faces y / x
        if (self.shaded and end and P.kind == ("y" if end == "s" else "x") and P.fam in ("wall", "hull")
                and P.role in STEP["x"]):
            return f"{self.pre}X{STEP['x'][P.role]}"
        return super().paint(P)


def _style(face, **kw):
    return dict({"wall": face(False), "hull": face(True), "shade": 0}, **kw)   # the +x faces only a step darker


class Navy(Faction):
    pre = "fN"

    def relief(self, sprite):
        return _style(R.navy, skirt=None, toe="ochre", seam=R.NAVY_SEAM, joint=4, shell=R.NavyShell, chamfer=R.NAVY_C,
                      ramp_var=FV.navy_ramp, ramp_hole=FV.navy_hole)

    pairs = FV.NAVY_PAIRS


class Drone(Faction):
    pre = "fD"

    def relief(self, sprite):
        return _style(R.drone, skirt="outline", slot=True, seam=0, shell=R.CornerCut, ramp_var=FV.drone_ramp,
                      outline_d=(0.1, 0.84), slot_hole=(0.55, 0.72, 0.15), foot=R.DRONE_FOOT)

    pairs = FV.DRONE_PAIRS


class Civil(Faction):
    def __init__(self, v):
        self.pre = f"fC{v}"
        super().__init__()

    def relief(self, sprite):
        return _style(R.civil, skirt="outline", toe="ochre", seam=0, toe_at=0.66, shell=R.NavyShell,
                          chamfer=R.NAVY_C, face_holes=FV.civil_holes, outline_lvl=1,
                          outline_round=True)

    pairs = FV.CIVIL_PAIRS


class Bastion(Faction):
    pre = "fB"

    def relief(self, sprite):
        return _style(R.bastion, skirt="outline", slot=True, seam=0, shell=R.Recessed, end_out=-R.BAST_L,
                      chamfer=R.BAST_CS, ramp_var=FV.bastion_ramp, ramp_hole=FV.bastion_hole, outline_lvl=1)

    pairs = FV.BAST_PAIRS


class Scrap(Faction):
    pre = "fS"
    shaded = False

    def __init__(self, p):
        self.p = p
        super().__init__()

    def relief(self, sprite):
        seed = f"{sprite}|{self.p}"
        return {"wall": R.scrap(False, seed), "hull": R.scrap(True, seed), "shell": R.ScrapShell}


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
