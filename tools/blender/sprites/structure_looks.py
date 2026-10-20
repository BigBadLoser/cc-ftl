"""Faction looks for the structure tiles (restyle.Look subclasses): navy, drone, civil v1..v4 (the scrap post-pass is in
structure_scrap).

Every look keeps the default tile geometry; it maps the default colour roles to its own ramps and paints a few pattern
overlays in surface coordinates (restyle.Poly: kind, s, z). Heights used below (tiles): skirt top 0.555, cut walls
0.755, full walls 1.85, far hull 2.05, the ghost belly from 0.3 down to -1.5."""
import math

from .restyle import Look, hexgrid, ramp

ZS = 0.555                       # skirt top (walls.skirt_top())
ZD = ZS + 0.37 * (2.05 - ZS)     # top of the far hull's lower (drawer) course (wallart.hull_inner_face)
C = 1 / 32                       # one cell

# base colours per look: wall (interior partitions), hull (far hull, belly), trim (accent plates, stripes), floor
BASES = {
    "nv": dict(wall="#7f8c9b", hull="#435264", trim="#9d8644", floor="#3e4651", accent="#4f7fb8"),
    "dn": dict(wall="#2b3139", hull="#22272e", trim="#343c46", floor="#24292f"),
    "c1": dict(wall="#a8a395", hull="#a39a85", trim="#c8742e", floor="#57534b"),
    "c2": dict(wall="#93a393", hull="#66806a", trim="#c4b277", floor="#4b544c"),
    "c3": dict(wall="#b6bbc1", hull="#b6bcc3", trim="#3d6db0", floor="#51565d"),
    "c4": dict(wall="#909086", hull="#74766f", trim="#c49d27", floor="#504f49"),
}


def palette_entries():
    out = {}
    for pre, b in BASES.items():
        out.update(ramp(f"{pre}W", b["wall"]))
        out.update(ramp(f"{pre}H", b["hull"]))
        out.update(ramp(f"{pre}T", b["trim"]))
        out.update(ramp(f"{pre}F", b["floor"], offsets=(0.16, 0.1, 0.05, 0.0, -0.05, -0.1, -0.16)))
        if "accent" in b:
            out[f"{pre}A"] = b["accent"]
    return out


FLOOR_STEP = {"steelL": 1, "plate": 1, "steel": 3, "steelD": 4, "grime": 4, "dark": 6, "seam": 5, "bolt": 2,
              "plateA": 3, "plateB": 3, "plateC": 4}


def alt_of(P):
    """The alt variant (1..3) of the sprite being painted, 0 for a plain piece."""
    tail = P.sprite.rsplit(".", 1)[-1]
    return int(tail[1]) if len(tail) == 2 and tail[0] == "a" and tail[1].isdigit() else 0


def cell_of(s):
    return int(s * 32 + 1e-6)


def in_rect(s, z, r):
    return r[0] <= s < r[1] and r[2] <= z < r[3]


def frame(s, z, r, w=1.5 * C, dz=0.03):
    """Where (s, z) sits in rect r: None outside, "top" / "bot" / "side" on its rim, "in" inside."""
    if not in_rect(s, z, r):
        return None
    if r[3] - z < dz:
        return "top"
    if z - r[2] < dz:
        return "bot"
    if s - r[0] < w or r[1] - s < w:
        return "side"
    return "in"


class Faction(Look):
    pre = ""

    def __init__(self):
        self.ramps = {"wall": f"{self.pre}W", "hull": f"{self.pre}H", "trim": f"{self.pre}T"}

    def t(self, fam, step):
        return f"{self.pre}{fam}{max(0, min(6, step))}"

    def paint(self, P):
        if P.sprite.startswith("tile.floor"):
            k = FLOOR_STEP.get(P.name)
            return self.t("F", k) if k is not None else P.name
        n = alt_of(P)
        if n and self.face(P) and P.z > ZS + 0.05:
            f = self.alt(P, n, ((P.s % 1) + 1) % 1, 1 if P.face == "x" else 0)
            if f:
                return f
        return super().paint(P)

    def alt(self, P, n, s, x):
        """Alt variant n's feature at (s, z), or None for the plain look. Features stay off the tile edges."""
        return None

    def vent(self, s, z, r, fam, x):
        """A recessed slatted vent in rect r: a lit lower lip, a dark rim, slats every 0.05."""
        f = frame(s, z, r)
        if f is None:
            return None
        if f == "bot":
            return self.t(fam, 1 + x)
        if f in ("top", "side"):
            return self.t(fam, 6)
        return self.t(fam, 6) if (z - r[2]) % 0.05 < 0.022 else self.t(fam, 4 + x)

    def plate(self, s, z, r, fam, step, x, bolts=True):
        """A raised plate in rect r: lit top rim, shaded bottom and sides, corner bolts."""
        f = frame(s, z, r)
        if f is None:
            return None
        if bolts and f == "in" and (s - r[0] < 3.5 * C or r[1] - s < 3.5 * C) and (z - r[2] < 0.065 or r[3] - z < 0.065):
            return "steelL" if not x else "steel"
        return {"top": self.t(fam, step - 2 + x), "bot": self.t(fam, step + 2), "side": self.t(fam, step + 1),
                "in": self.t(fam, step + x)}[f]

    @staticmethod
    def full(P):
        return ".full." in P.sprite

    @staticmethod
    def hull(P):
        return P.sprite.startswith("tile.hull")

    @staticmethod
    def face(P):
        return P.kind in ("y", "x")


class Navy(Faction):
    """Clean, heavy, military: grey-blue bulkheads with a thin blue accent stripe; gunmetal armour hull in big
    bevelled panels with a sparse stencil (every third tile); belly ribs and plate overlaps."""
    pre = "nv"

    def overlay(self, P):
        x = 1 if P.face == "x" else 0
        if not self.hull(P) and self.face(P) and self.full(P) and 1.08 <= P.z < 1.13:
            return "nvA"                                                     # the accent stripe on the rail
        n = alt_of(P)
        if n and self.hull(P) and self.face(P) and P.fam == "wall" and ZS + 0.03 <= P.z < ZD - 0.04:
            return self.drawers(((P.s % 1) + 1) % 1, P.z, n, x)
        if self.hull(P) and self.face(P) and P.fam == "hull" and P.z > ZS + 0.05:
            s, z = ((P.s % 1) + 1) % 1, P.z
            rows = (1.2,) if self.full(P) or P.z > 0.8 else ()
            if s < 1.5 * C or any(abs(z - r) < 0.02 for r in rows):
                return self.t("H", 6)                                         # deep seam: one big plate per tile
            if s < 3 * C or any(0.02 <= z - r < 0.045 for r in rows):
                return self.t("H", 1 + x)                                     # bevel: lit edge right of / below a seam
            if s > 1 - 2 * C or any(0.02 <= r - z < 0.045 for r in rows):
                return self.t("H", 5)                                         # bevel: shaded edge
            if abs(s - 0.5) < C and 0.9 < z < 1.9:
                return self.t("H", 4 + x)                                     # a faint mid-plate line
            if P.sprite.endswith(".v1") and 0.62 <= s < 0.86 and 1.55 <= z < 1.66 and int(s / C) % 3 != 2:
                return self.t("T", 1 + x)                                     # a stencil block, every third tile
            return self.t("H", 2 + x)                                         # the plate face
        if P.fam == "belly":
            c = int(((P.s % 1) + 1) % 1 / C)
            if c % 16 in (0, 1):
                return self.t("H", 3 + x)                                     # ribs, one per half tile
            for zz in (-0.45,):
                if 0 <= zz - P.z < 0.03:
                    return self.t("H", 2 + x)                                 # plate overlap: lit lip
                if 0 <= P.z - zz < 0.03:
                    return self.t("H", 6)                                     # its shadow
        return None

    def drawers(self, s, z, n, x):
        """The hull's lower course on alt n: one long box (1), a plain course round the hatch (2), three narrow boxes
        (3), instead of the default two boxes per tile."""
        if cell_of(s) == 0:
            return self.t("W", 4 + x)                                         # the tile seam
        boxes = {1: ((0.06, 0.94),), 2: (), 3: ((0.05, 0.31), (0.37, 0.63), (0.69, 0.95))}[n]
        z0, z1 = ZS + 0.1, ZD - 0.12
        for s0, s1 in boxes:
            if s0 <= s < s1 and z0 <= z < z1:
                if z1 - z < 0.035 or s - s0 < C:
                    return self.t("W", 1 + x)
                if z - z0 < 0.03 or s1 - s < C:
                    return self.t("W", 4 + x)
                if n == 1 and abs(z - (z0 + z1) / 2) < 0.02 and (0.2 <= s < 0.35 or 0.65 <= s < 0.8):
                    return self.t("W", 4 + x)                                 # two pull slots
                return self.t("W", 2 + x)
        return self.t("W", 3 + x)

    def alt(self, P, n, s, x):
        z = P.z
        if self.hull(P):
            if P.fam not in ("hull", "wall"):
                return None
            if n == 2:
                return self.plate(s, z, (0.3, 0.7, 0.64, 1.0), "W", 4, x)      # a bolted service hatch in the lower course
            if P.fam != "hull" or z < 1.25:
                return None
            if n == 1:
                return self.vent(s, z, (0.3, 0.7, 1.38, 1.62), "H", x)          # an intake grille
            f = frame(s, z, (0.56, 0.84, 1.36, 1.62))
            if f == "in" and 1.44 <= z < 1.54 and int(s / C) % 3 != 2:
                return "medRed" if not x else "rustD"                        # a red warning stencil on a plate
            return self.plate(s, z, (0.56, 0.84, 1.36, 1.62), "H", 2, x, bolts=False)
        if not self.full(P) or z < 0.62:
            return None
        if n == 1:
            return self.vent(s, z, (0.2, 0.44, 1.4, 1.62), "W", x)              # an air vent above the rail
        if n == 2:                                                            # a wall terminal: dark screen, blue bar
            f = frame(s, z, (0.56, 0.82, 1.22, 1.46))
            if f in ("in",) and 1.33 <= z < 1.37 and s < 0.74:
                return "nvA"
            if f == "in":
                return "dark" if not x else "black"
            return self.t("W", 5 + x) if f else None
        f = frame(s, z, (0.3, 0.48, 0.66, 0.98))                              # a red fire cabinet below the rail
        if f == "in":
            return "medRed" if not x or z > 0.9 else "rustD"
        return ("rustD" if f != "top" else "medRed") if f else None


HEX_R = 1 / (2 * math.sqrt(3))           # two hexes per tile width, so the inlay tiles seamlessly from tile to tile


class Drone(Faction):
    """Machine-built, uninhabited: near-black machined panels; interior walls are open frames and conduits; a hex inlay
    on the hull; a few short cyan status lines (glow), no stencils."""
    pre = "dn"

    def hex(self, P, fill, merge=None):
        """Big hex plates (HEX_R): a dark seam, a lit upper rim and a shaded lower rim, the plate face. `merge`: (s, z)
        of a vertical edge to leave out, joining two hexes into one long plate."""
        s = ((P.s % 1) + 1) % 1
        if merge and abs(s - merge[0]) < 0.065 and abs(P.z - merge[1]) < HEX_R / 2 - 0.02:
            return self.t("H", fill)
        d = hexgrid(s, P.z, HEX_R)
        if d < 0.03:
            return self.t("H", 6)
        if d < 0.065:
            return self.t("H", fill - 2) if hexgrid(s, P.z + 0.04, HEX_R) < d else self.t("H", fill + 1)
        return self.t("H", fill)

    def overlay(self, P):
        x = 1 if P.face == "x" else 0
        if not self.hull(P) and self.face(P) and P.z > ZS + 0.03:
            c = int(((P.s % 1) + 1) % 1 / C) % 16
            if c in (0, 1, 2, 3):
                return ("steel", "gm", "gmD", "steelD")[c] if not x else ("gm", "gmD", "steelD", "steelD")[c]   # frame members
            for zc, r in ((0.7, 0.05), (1.02, 0.065), (1.38, 0.05), (1.64, 0.04)):
                d = P.z - zc
                if -r <= d < r:
                    if P.kind == "y" and zc == 1.02 and 0.3 <= P.s < 0.48 and abs(d) < 0.015:
                        return "cyan"                                         # a status line on one conduit
                    lit = ("plate", "steelL", "steel") if not x else ("steelL", "steel", "steelD")
                    return lit[0 if d > r * 0.4 else (1 if d > -r * 0.3 else 2)]   # a machined pipe, lit on top
            return self.t("W", 6) if c % 8 else self.t("W", 5)                # the dark bay behind (a faint back rib)
        if self.hull(P) and self.face(P) and P.fam in ("hull", "wall", "trim") and P.z > ZS + 0.05:
            if P.sprite.endswith(".v1") and P.kind == "y" and 0.1 <= P.s < 0.32 and abs(P.z - 1.75) < 0.015:
                return "cyan"                                                 # status line, every third tile
            return self.hex(P, 3 + x, {1: (0.25, 0.866), 2: (0.75, 0.866), 3: (0.5, 1.299)}.get(alt_of(P)))
        if P.fam == "belly":
            return self.hex(P, 4 + x)
        return None

    def alt(self, P, n, s, x):
        z = P.z
        if self.hull(P):
            if P.fam not in ("hull", "wall", "trim"):
                return None
            cs, cz = ((0.75, 1.299), (0.25, 1.299), (0.5, 1.732))[n - 1]
            if math.hypot(s - cs, z - cz) > HEX_R or hexgrid(s, z, HEX_R) < 0.065:
                return None                                                   # keep every seam and rim
            ds, dz = s - cs, z - cz
            if n == 1:                                                        # a status eye
                if abs(ds) < 2 * C and abs(dz) < 0.03:
                    return "cyan"
                return self.t("H", 5 + x) if abs(ds) < 3.5 * C and abs(dz) < 0.05 else None
            if n == 2:                                                        # a vent hex
                if abs(ds) < 0.15:
                    return self.t("H", 6) if (dz + 1) % 0.05 < 0.022 else self.t("H", 2 + x)
                return None
            if abs(ds) < 1.5 * C and dz < 0.09:                               # an open hex with a cable in it
                return "steelD" if not x else "gmD"
            return self.t("H", 6)
        if not self.full(P) or z < 0.62:
            return None
        c = int(s / C) % 16
        if c in (0, 1, 2, 3):
            return None
        if n == 1 and 0.55 <= s < 0.63 and 0.6 <= z < 1.8:                    # a cable bundle down the bay
            k = int((s - 0.55) / C)
            return ("gm", "gmD", "steelD")[min(k, 2)] if not x else ("gmD", "steelD", "steelD")[min(k, 2)]
        if n == 2:                                                            # a node box with a status light
            f = frame(s, z, (0.4, 0.62, 1.12, 1.3))
            if f == "in" and abs(s - 0.51) < 1.5 * C and abs(z - 1.21) < 0.02:
                return "cyan"
            if f:
                return {"top": "steel", "bot": "steelD", "side": "gmD", "in": "gm"}[f]
            return None
        if n == 3 and 0.3 <= s < 0.7 and abs(z - 1.38) < 0.05:               # a missing pipe section: brackets, dark
            return "steelD" if s < 0.34 or s >= 0.66 else self.t("W", 6)
        return None


class Civil(Faction):
    """Plain and commercial, a bit cheap: flat panels with tile seams, one trim stripe on the hull and a kick stripe on
    the walls, in one of four colour schemes (v1 cream / orange, v2 faded green, v3 white / blue, v4 yellow-grey)."""

    def __init__(self, v):
        self.pre = f"c{v}"
        super().__init__()

    def overlay(self, P):
        x = 1 if P.face == "x" else 0
        if self.face(P) and P.z > ZS + 0.03 and (P.fam in ("hull", "wall", "trim")):
            c = int(((P.s % 1) + 1) % 1 / C)
            z = P.z
            if self.hull(P):
                mids = {1: (21,), 2: (11, 21), 3: (8, 24)}.get(alt_of(P), (16,))   # lower plate layouts per alt
                if 0.95 <= z < 1.07:
                    return self.t("T", 2 + x if z >= 0.97 else 4 + x)         # the trim stripe
                lower = z < 0.95
                if c == 0 or (lower and c in mids) or abs(z - 1.55) < 0.015:
                    return self.t("H", 5 + x)                                 # plate seams
                if c == 1 or (lower and c - 1 in mids) or 0.015 <= z - 1.55 < 0.04:
                    return self.t("H", 1 + x)
                if lower:
                    return self.t("H", 4 + x)                                 # a darker lower course
                lift = -1 if P.sprite.endswith(".v1") and z > 1.55 else 0     # a newer plate on every third tile
                return self.t("H", 3 + x + lift)
            if c in (0, 16):
                return self.t("W", 5 + x)                                     # two panels per tile
            if c in (1, 17):
                return self.t("W", 1 + x)
            if ZS + 0.03 <= z < ZS + 0.09:
                return self.t("T", 2 + x)                                     # kick stripe
            if self.full(P) and abs(z - 1.15) < 0.02:
                return self.t("W", 1 + x)                                     # a thin rail
            return self.t("W", 3 + x)
        if P.fam == "belly":
            if 0.12 <= P.z < 0.2:
                return self.t("T", 3 + x)                                     # trim band under the rim
            c = int(((P.s % 1) + 1) % 1 / C)
            return self.t("H", 5 + x if c % 16 == 0 else 4 + x)
        return None

    def alt(self, P, n, s, x):
        z = P.z
        if self.hull(P):
            if P.fam not in ("hull", "wall", "trim"):
                return None
            if n == 1:                                                        # a porthole on the upper plate
                r = math.hypot((s - 0.5) * 1.0, (z - 1.3) * 1.15)
                if r < 0.11:
                    star = abs(s - 0.46) < C and abs(z - 1.33) < 0.02 or abs(s - 0.56) < C and abs(z - 1.26) < 0.015
                    return "lens" if star else ("dark" if not x else "black")
                if r < 0.145:
                    return self.t("T", 2 + x) if z > 1.3 else self.t("T", 4 + x)
                return None
            if n == 2:                                                        # a registry plate with a few text lines
                f = frame(s, z, (0.3, 0.7, 1.24, 1.44))
                if f == "in" and int((z - 1.24) / 0.035) % 2 == 1 and 0.36 <= s < 0.6 + 0.04 * (z > 1.35):
                    return self.t("T", 5 + x)
                return {"top": self.t("T", 1 + x), "bot": self.t("T", 4 + x), "side": self.t("T", 3 + x),
                        "in": self.t("T", 2 + x)}[f] if f else None
            return self.vent(s, z, (0.36, 0.64, 0.66, 0.86), "H", x)           # a vent in the lower course
        if not self.full(P) and n != 3 or z < 0.6:
            return None
        if n == 1:                                                            # a notice board with two sheets
            f = frame(s, z, (0.18, 0.46, 1.24, 1.6))
            if f == "in" and (in_rect(s, z, (0.22, 0.32, 1.3, 1.52)) or in_rect(s, z, (0.35, 0.43, 1.36, 1.55))):
                return "medWhite" if not x else "plate"
            if f == "in":
                return "leather"
            return self.t("T", 3 + x) if f else None
        if n == 2:
            return self.vent(s, z, (0.6, 0.82, 1.3, 1.48), "W", x)             # an air vent
        return self.vent(s, z, (0.42, 0.6, 0.66, 0.76), "W", x)                # a kick vent at floor level
