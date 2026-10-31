"""Scrap: the default layout under mismatched bolted patch plates, rusty colours."""
from .. import wall3d as T
from ..restyle import hashf
from .base import Faction
from .parts import LINE, PAINT, PX, body
from .shell import FreeEnds, _end_section, _ends


class ScrapShell(FreeEnds, T.Shell):
    """The default shell, with a partition's free ends stopped square (FreeEnds); its corners stay square."""
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.find_ends()


def scrap(hull, seed):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, _, back = _ends(ax, plane, b, ends)
        if endf:                                        # a wall's end face: its section only
            _end_section(k, ax, plane, a, b, zs, top - 0.03, F)
            return
        pe = ("in" if back else ends[0], "in" if end1 else ends[1])   # (nothing runs on round a free end)
        (T.hull_face if hull else T.wall_face)(k, ax, plane, a, b, pe, zs, top, full, *((variant,) if hull else ()))
        hi = top - 0.2 if full else top
        for s0, s1 in T.spans(a, b):                    # patch plates: one or two a tile (most tiles), flat (one px
            if s1 - s0 < 0.4:                           # proud), in the wall's own grey or a dull rust
                continue
            for n in range(1 + (hashf(seed, round(s0, 3), ax, "n") > 0.5)):
                h = lambda *x: hashf(seed, round(s0, 3), ax, n, *x)   # noqa: E731
                if h("skip") < 0.2:
                    continue
                w = (0.25 + 0.25 * h("w")) * (s1 - s0)
                ht = (0.15 + 0.25 * h("h")) * (hi - zs)
                u0 = s0 + 0.05 + (s1 - s0 - w - 0.1) * h("u")
                z0 = zs + 0.05 + (hi - zs - ht - 0.05) * h("z")
                c = h("f")
                pf, lvl = (F, 2 + (h("l") > 0.5)) if c < 0.4 else ("ochre", 0) if c < 0.8 else ("ochre", 1)
                d = PX + 2 * PAINT * n                  # (a second laps over the first)
                T.slab(k, ax, plane, u0, u0 + w, z0, z0 + ht, d, pf, lvl)
                for cu in (u0 + 0.03, u0 + w - 0.03):                                           # its rivets
                    for cz in (z0 + 0.03, z0 + ht - 0.03):
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
        return {"wall": scrap(False, seed), "hull": scrap(True, seed), "shell": ScrapShell}
