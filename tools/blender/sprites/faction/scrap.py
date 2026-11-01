"""Scrap: the default layout under mismatched bolted patch plates, rusty colours."""
from .. import wall3d as T
from ..relief_style import Style
from ..restyle import hashf
from .base import Faction
from .parts import LINE, PAINT, PX, body, flat, prism
from .shell import FreeEnds, LookShell, _end_section, _ends


DONORS = ("fDW", "fC4X")                           # the plates' salvaged steel ramps


def scrap(hull, seed):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, _, back = _ends(ax, plane, b, ends)
        if endf:                                        # a wall's end face: its section only
            _end_section(k, ax, plane, a, b, zs, top - 0.03, F)
            return
        pe = ("in" if back else ends[0], "in" if end1 else ends[1])   # (nothing runs on round a free end)
        (T.hull_face if hull else T.wall_face)(k, ax, plane, a, b, pe, zs, top, full, *((variant,) if hull else ()))
        lo, hi = zs + 0.2, top - 0.2 if full else top   # (the field: over the low band, under the header)
        for s0, s1 in T.spans(a, b):                    # patch plates: one or two a tile (most tiles), flat (one px
            if s1 - s0 < 0.4 or hi - lo < 0.2:          # proud), salvaged steel or a dull rust; inside the
                continue                                # field between the posts, clear of the face's raised parts
            f0, f1 = s0 + T.STILE + 0.02, s1 - T.STILE - 0.02
            for n in range(1 + (hashf(seed, round(s0, 3), ax, "n") > 0.5)):
                h = lambda *x: hashf(seed, round(s0, 3), ax, n, *x)   # noqa: E731
                if h("skip") < 0.2:
                    continue
                w = (0.45 + 0.4 * h("w")) * (f1 - f0)
                ht = (0.2 + 0.3 * h("h")) * (hi - lo)
                u0 = f0 + (f1 - f0 - w) * h("u")
                z0 = lo + 0.03 + (hi - lo - ht - 0.06) * h("z")
                c = h("f")
                d = PX + 2 * PAINT * n                  # (a second laps over the first)
                if c < 0.4:                             # salvaged steel in another look's colours (drone's blue-grey,
                    don = DONORS[h("l") > 0.5]          # civil's faded teal): its front, a lit top a step up, sides
                    i = 3 + (ax == "x")                 # and rivets; on the shade side a step down
                    prism(k, ax, plane, u0, u0 + w, [(0.0, z0), (d, z0), (d, z0 + ht), (0.0, z0 + ht)], F, 3,
                          cols=[False, f"{don}{i}", f"{don}{i - 1}", False], cap=f"{don}{i + 1}")
                    pf, lvl, rv = None, None, f"{don}{i - 1}"
                else:                                   # or a dull rust
                    pf, lvl = "ochre", 0 if c < 0.8 else 1
                    T.slab(k, ax, plane, u0, u0 + w, z0, z0 + ht, d, pf, lvl)
                for cu in (u0 + 0.03, u0 + w - 0.03):                                           # its rivets
                    for cz in (z0 + 0.03, z0 + ht - 0.03):
                        if pf is None:
                            flat(k, ax, plane, cu - LINE / 2, cu + LINE / 2, cz - 0.013, cz + 0.013, d + PAINT, rv)
                        else:
                            T.paint(k, ax, plane, cu - LINE / 2, cu + LINE / 2, cz - 0.013, cz + 0.013, d, pf, lvl + 1)
    return face


class Scrap(Faction):
    pre = "fS"
    shaded = False

    def __init__(self, p):
        self.p = p
        super().__init__()

    def relief(self, sprite):
        seed = f"{sprite}|{self.p}"
        return Style(wall=scrap(False, seed), hull=scrap(True, seed), ramp_solid=True, shell=LookShell,
                     features=(FreeEnds(),))   # (its corners stay square)
