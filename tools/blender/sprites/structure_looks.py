"""Faction looks for the structure tiles (restyle.Look subclasses): navy, drone, civil v1..v4, and the scrap post-pass.

Every look keeps the default tile geometry; it maps the default colour roles to its own ramps and paints a few pattern
overlays in surface coordinates (restyle.Poly: kind, s, z). Heights used below (tiles): skirt top 0.555, cut walls
0.755, full walls 1.85, far hull 2.05, the ghost belly from 0.3 down to -1.5."""
import math

from .restyle import Look, hashf, hexgrid, ramp

ZS = 0.555                       # skirt top (walls.skirt_top())
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
        return super().paint(P)

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


HEX_R = 1 / (2 * math.sqrt(3))           # two hexes per tile width, so the inlay tiles seamlessly from tile to tile


class Drone(Faction):
    """Machine-built, uninhabited: near-black machined panels; interior walls are open frames and conduits; a hex inlay
    on the hull; a few short cyan status lines (glow), no stencils."""
    pre = "dn"

    def hex(self, P, fill):
        """Big hex plates (HEX_R): a dark seam, a lit upper rim and a shaded lower rim, the plate face."""
        s = ((P.s % 1) + 1) % 1
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
        if self.hull(P) and self.face(P) and P.fam == "hull" and P.z > ZS + 0.05:
            if P.sprite.endswith(".v1") and P.kind == "y" and 0.1 <= P.s < 0.32 and abs(P.z - 1.75) < 0.015:
                return "cyan"                                                 # status line, every third tile
            return self.hex(P, 3 + x)
        if P.fam == "belly":
            return self.hex(P, 4 + x)
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
                if 0.95 <= z < 1.07:
                    return self.t("T", 2 + x if z >= 0.97 else 4 + x)         # the trim stripe
                lower = z < 0.95
                if c == 0 or (lower and c == 16) or abs(z - 1.55) < 0.015:
                    return self.t("H", 5 + x)                                 # plate seams
                if c == 1 or (lower and c == 17) or 0.015 <= z - 1.55 < 0.04:
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


# ---- scrap: a post-pass over any look ----------------------------------------------------------------------------

DONORS = None


def _donors():
    global DONORS
    if DONORS is None:
        DONORS = [Navy(), Civil(2), Civil(4), Drone()]                       # close in value to the hulls they patch
    return DONORS


class Scrap(Look):
    """Patched and rusted, made from another look (default when `base` is None): salvaged plates in other factions'
    colours with welded seams, bolted patches, rust streaks, the occasional exposed rib bay. Per-sprite variant p (1..4)
    reseeds every choice, so a run does not repeat. Shapes are big and few; no texture noise.

    Works on any builder through restyle (tiles here; module sprites the same way: their box faces are big, so a patch
    there swaps whole faces to a donor colour and rust takes the lower faces)."""

    def __init__(self, p, base=None):
        self.p, self.base = p, base
        self._plan = {}

    def plan(self, sprite):
        if sprite not in self._plan:
            key = sprite.replace(f".scrap.p{self.p}", "")
            h = lambda *a: hashf(key, self.p, *a)  # noqa: E731
            full = ".full." in sprite or sprite.startswith("tile.hull") and ".low." not in sprite
            top = 1.85 if full else 0.755
            patches = []
            for k in range(1 + (h("n") > 0.85)):                                 # mostly one big plate per tile
                if h(k, "skip") < 0.25:
                    continue                                                      # ... and some tiles none
                w, ht = 0.5 + 0.35 * h(k, "w"), (0.3 + 0.3 * h(k, "h")) * (1 if full else 0.45)
                s0 = 0.05 + (0.9 - w) * h(k, "s")
                z0 = ZS + 0.05 + max(0.0, top - ZS - 0.12 - ht) * h(k, "z")
                donor = _donors()[int(h(k, "d") * len(_donors()))]
                patches.append((s0, s0 + w, z0, z0 + ht, donor))
            bolt = (0.1 + 0.7 * h("bs"), ZS + 0.1 + (top - ZS - 0.35) * h("bz")) if h("b") > 0.7 else None
            streaks = [(0.08 + 0.84 * h(k, "rs"), ZS + 0.12 + (top - ZS - 0.2) * h(k, "rz"), 0.12 + 0.25 * h(k, "rl"))
                       for k in range(1 + (h("rn") > 0.8))]
            ribs = (0.15 + 0.4 * h("ibs"), ZS + 0.15) if (self.p == 3 and full) else None
            self._plan[sprite] = (patches, bolt, streaks, ribs, top)
        return self._plan[sprite]

    def paint(self, P):
        name = self.base.paint(P) if self.base else P.name
        if P.sprite.startswith("tile.floor") or P.kind == "top":
            return name
        patches, bolt, streaks, ribs, top = self.plan(P.sprite)
        s, z = ((P.s % 1) + 1) % 1, P.z
        if P.fam == "belly":
            z = ZS + (0.3 - P.z) / 1.8 * (top - ZS)                           # map the belly's height onto the face's
        dark = name.endswith(("6", "5", "K")) or "K" in name[-2:]
        for sc, z0, L in streaks:                                             # rust streaks run down from a seam
            if abs(s - sc) < 1.6 * C * (1 - 0.4 * (z0 - z) / L) and z0 - L <= z < z0:
                return "rustD" if dark else "rust"
            if P.kind.startswith("slope") and abs(s - sc) < 1.6 * C and z0 - L < ZS + 0.05 and z > ZS - 0.15:
                return "rustD"                                                # ... a streak reaching the skirt stains its top
        if not self.face_like(P):
            return name
        if ribs and ribs[0] <= s < ribs[0] + 0.3 and ribs[1] <= z < ribs[1] + 0.5:
            c = int((s - ribs[0]) / C)
            return "gm" if c % 6 in (0, 1) else ("steel" if c % 6 == 2 else "dark")      # exposed ribs
        for s0, s1, z0, z1, donor in patches:
            if s0 <= s < s1 and z0 <= z < z1:
                e = min(s - s0, s1 - s, z - z0, z1 - z)
                if e < 1.5 * C:
                    return "steelL" if (s - s0 < 1.5 * C or z1 - z < 1.5 * C) else "rustD"   # weld bead / burn
                if (s - s0 < 3.5 * C or s1 - s < 3.5 * C) and (z - z0 < 0.06 or z1 - z < 0.06):
                    return "plate"                                                # corner bolts
                t = donor.tone(P.fam or "hull", P.face, P.role or "M")
                return (t[:-1] + str(min(6, int(t[-1]) + 1))) if t else name     # a step darker: an old plate
        if bolt and bolt[0] <= s < bolt[0] + 0.16 and bolt[1] <= z < bolt[1] + 0.16:
            cs, cz = s - bolt[0], z - bolt[1]
            if (cs < 2.5 * C or cs > 0.16 - 2.5 * C) and (cz < 0.04 or cz > 0.12):
                return "steelL"                                               # bolts
            return "steel" if P.face == "y" else "steelD"
        return name

    @staticmethod
    def face_like(P):
        return P.kind in ("y", "x") or P.fam == "belly"


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
