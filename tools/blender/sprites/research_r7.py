"""Research bench look studies, round 7: three variants of the archivist (round 6's l2), each with more hologram. The
bench is l2's (cabinet, hutch, the broken glyph tablet on the light table, lamp, tools) plus a warm light strip under
the hutch's lower shelves and projector pucks where the hologram needs a source.

  l2a  reconstruction: the whole tablet rebuilt as an upright gold pane floating over the table, a jagged line
       parting what was found from what is inferred, beams up from two pucks, a scan line across the real tablet
  l2b  translation: glyph marks lift off the tablet in a rising stream into a translation pane over the table
       (glyphs left, their reading right), a ring of glyphs turning over the tablet
  l2c  star chart: a wire dome over the table on a film floor, stars and the lines between them, a beam from one glyph up to
       the star it names, ringed"""
import math

from .modkit import K
from .research_kit import bar, ring
from .research_r3 import _pane
from .research_kit import PXG, zpx
from .research_r6 import SHELF_FRONT, SHELVES, T2, Table, l2


PUCKS = ((-0.33, 0.3), (0.33, 0.3))   # the reconstruction's projectors on the table: (a, b)


def bench(name, pucks=(), extra=None, **kw):
    """l2's bench with the light strip under the hutch shelves, pucks [(a, b)] on the table, and extra(k) for more
    (kw goes to l2)."""
    def build(layer):
        k = l2(layer, finish=False, name=name, **kw)
        for su in (-1, 1):
            k.box(su * 0.98, SHELF_FRONT - 1.5 * PXG, SHELVES[0] - zpx(1), 0.8, PXG, zpx(1), "resGold")
        T = Table(k, *T2)
        for a, b in pucks:
            T.put(a, b, 0.0, 0.15, 0.15, 0.03, "lvW2", top="lvW")
            T.put(a, b, 0.03, 0.09, 0.09, 0.012, "resGold")
        if extra:
            extra(k)
        return k.build()
    build.__name__ = name
    return build


def _glyph_rows(k, u0, v, z0, w, rows, cols, G, F, dz=0.07):
    """Rows of glyph marks on an upright plane at v: varied widths, every third one dim."""
    for i in range(rows):
        x = u0
        for j in range(cols):
            m = (0.05, 0.08, 0.04, 0.06)[(i + j) % 4]
            if x + m > u0 + w:
                break
            k.box(x + m / 2, v, z0 - i * dz, m, 0.02, 0.03, G if (i * 3 + j) % 4 else F)
            x += m + 0.035


# ---- l2a: reconstruction --------------------------------------------------------------------------------------------

def l2a_holo():
    k = K("research_l2a_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    T = Table(k, *T2)
    u, v, z = T.at(-0.06, 0.0, 0.1)                                                   # a scan line across the tablet
    k.box(u, v, z, 0.56, 0.02, 0.025, G)
    pv, z0, w, h = -0.46, 1.06, 0.8, 0.44                                             # the rebuilt tablet, upright:
    k.box(0.0, pv, z0, w, 0.02, h, F)                                                 # a film plate,
    k.box(0.22, pv + 0.01, z0, w / 2 - 0.22, 0.02, h, F)                               # its inferred part doubled
    for z in (z0, z0 + h - 0.035):
        k.box(0.0, pv + 0.015, z, w, 0.02, 0.035, G)
    for su in (-1, 1):
        k.box(su * (w / 2 - 0.018), pv + 0.015, z0, 0.035, 0.02, h, G)
    for i in range(3):                                                                # three rows of big glyphs
        for j in range(4):
            m = (0.08, 0.06, 0.1, 0.07)[(i + j) % 4]
            k.box(-0.3 + j * 0.19 + m / 2, pv + 0.025, z0 + h - 0.12 - i * 0.11, m, 0.02, 0.05,
                  G if j < 2 or (i + j) % 2 else F)
    pts = [(0.08, z0 + h), (0.14, z0 + 0.3), (0.05, z0 + 0.2), (0.1, z0)]               # the break, bold
    for (a, za), (b, zb) in zip(pts, pts[1:]):
        bar(k, (a, pv + 0.03, za), (b, pv + 0.03, zb), 0.035, G)
    for (a, b), s in zip(PUCKS, (-1, 1)):                                              # beams from the pucks
        pu, pvv, pz = T.at(a, b, 0.04)
        bar(k, (pu, pvv, pz), (s * 0.39, pv, z0), 0.02, G)
    return k


# ---- l2b: translation -----------------------------------------------------------------------------------------------

def l2b_holo():
    k = K("research_l2b_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    T = Table(k, *T2)
    cu, cv, cz = T.at(-0.12, 0.0, 0.3)
    ring(k, "z", cu, cv, cz, 0.24, 20, 0.02, 0.02, F)                                # the turning ring of glyphs
    for i in range(10):
        a = i * math.tau / 10
        k.box(cu + 0.24 * math.cos(a), cv + 0.24 * math.sin(a), cz + 0.02, 0.05, 0.05, 0.05, G if i % 3 else F,
              rz=a)
    pu, pv, z0, w, h = 0.0, -0.5, 1.12, 0.66, 0.34                                     # the translation pane
    stream = [(-0.12, cv - 0.02, cz + 0.14), (-0.1, cv - 0.06, cz + 0.28), (-0.06, cv - 0.09, cz + 0.42)]
    for i, (u, v, z) in enumerate(stream):                                           # glyphs rising into it
        s = 0.07 - i * 0.008
        k.box(u, v, z, s, 0.02, s, G if i % 2 == 0 else F)
    k.box(pu, pv, z0, w, 0.02, h, F)
    for z in (z0, z0 + h - 0.035):
        k.box(pu, pv + 0.015, z, w, 0.02, 0.035, G)
    for su in (-1, 1):
        k.box(pu + su * (w / 2 - 0.018), pv + 0.015, z0, 0.035, 0.02, h, G)
    k.box(pu - 0.08, pv + 0.015, z0 + 0.03, 0.025, 0.02, h - 0.06, G)                 # a rule down it
    for i in range(3):
        z = z0 + h - 0.1 - i * 0.09
        for j, m in enumerate((0.06, 0.08)[: 2 - i % 2]):
            k.box(pu - 0.28 + j * 0.1 + m / 2, pv + 0.025, z, m, 0.02, 0.05, G)            # glyphs,
        tw = 0.26 - 0.06 * (i % 2)
        k.box(pu - 0.02 + tw / 2, pv + 0.025, z + 0.01, tw, 0.02, 0.03, G)               # their reading
    return k


# ---- l2c: the star chart --------------------------------------------------------------------------------------------

def l2c_holo():
    k = K("research_l2c_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    T = Table(k, *T2)
    cu, cv, cz = T.at(0.0, 0.0, 0.18)
    R = 0.44
    k.cyl(cu, cv, cz - 0.01, R, 0.02, F, top=F, sides=28)                            # a film floor under the sky,
    ring(k, "z", cu, cv, cz + 0.01, R, 28, 0.03, 0.025, G)                           # its rim,
    for zz in (0.18, 0.32):                                                           # the dome as rings
        ring(k, "z", cu, cv, cz + zz, math.sqrt(R * R - zz * zz), 24, 0.02, 0.02, F)
    for i in range(12):                                                               # and two arcs over it
        t0, t1 = i / 12 * math.pi, (i + 1) / 12 * math.pi
        for axis in (0, 1):
            p0 = [R * math.cos(t0), 0.0, R * math.sin(t0)]
            p1 = [R * math.cos(t1), 0.0, R * math.sin(t1)]
            if axis:
                p0[0], p0[1], p1[0], p1[1] = 0.0, p0[0], 0.0, p1[0]
            bar(k, (cu + p0[0], cv + p0[1], cz + p0[2]), (cu + p1[0], cv + p1[1], cz + p1[2]), 0.02, F)
    stars = [(-0.22, -0.1, 0.22), (-0.08, 0.12, 0.3), (0.1, 0.02, 0.36), (0.24, -0.12, 0.2), (0.02, -0.2, 0.16),
             (0.18, 0.16, 0.12)]
    for su, sv, sz in stars:
        k.box(cu + su, cv + sv, cz + sz, 0.075, 0.075, 0.075, G, rz=0.785)
    for i, j in ((0, 1), (1, 2), (2, 3), (2, 4), (3, 5)):
        a, b = stars[i], stars[j]
        bar(k, (cu + a[0], cv + a[1], cz + a[2]), (cu + b[0], cv + b[1], cz + b[2]), 0.028, G)
    gu, gv, gz = T.at(-0.24, 0.17, 0.09)                                              # one glyph names a star
    s = stars[2]
    bar(k, (gu, gv, gz), (cu + s[0], cv + s[1], cz + s[2]), 0.025, G)
    ring(k, "v", cu + s[0], cv + s[1], cz + s[2], 0.09, 14, 0.025, 0.025, G)
    return k


BUILD = {"l2a": (bench("l2a", PUCKS), l2a_holo),
         "l2b": (bench("l2b"), l2b_holo),
         "l2c": (bench("l2c", ((0.0, 0.36),)), l2c_holo)}
