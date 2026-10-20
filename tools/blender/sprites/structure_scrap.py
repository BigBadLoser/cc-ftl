"""The scrap look: a post-pass over any look (structure_looks), with salvaged plates in the other factions' colours."""
from .restyle import Look, hashf
from .structure_looks import C, ZS, Civil, Drone, Navy


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
