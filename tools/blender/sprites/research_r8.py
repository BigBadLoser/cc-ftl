"""Research bench look studies, round 8: the reconstruction bench (round 7's l2a) with the open front-left tile used,
in the same cream finish. The hologram is l2a's, plus a small piece of its own for the new unit.

  r1  desk extension: the left drawer bank runs forward into an L return beside the chair: drawers facing the chair,
      journals, a pen cup, notes, a puck showing a catalogue card
  r2  fragment vitrine: a glass-topped display case lit gold inside, more fragments of the tablet on red velvet; a
      beam from one of them up to its place in the reconstruction
  r3  flat-file archive: a cabinet of thin archive drawers, the top one pulled out with catalogued fragments in it, a
      lit rubbing box on top; an index pane over it, its marked entry tied to the open drawer"""
from .modkit import K
from .research_kit import bar, ring
from .research_r3 import _pane
from .research_r4 import slate
from .research_kit import PXG, ZPX, snap, zpx
from .research_r6 import FRONT, TOP, front, stack
from .research_r7 import PUCKS, bench, l2a_holo

FU, FV = -0.98, 0.36              # the front-left tile's unit: centre u, v
G, F = "resGold", "resGoldF"


def _drawer_front(k, u, v, z, w, h, face="v"):
    """One drawer front on the +v face at v (face 'v') or the +u face at u (face 'u'), snapped to the px grid; see
    front."""
    z, h = zpx(round(z * ZPX)), zpx(max(3, round(h * ZPX)))
    if face == "v":
        front(k, "v", u, snap(v), w, z, h)
    else:
        front(k, "u", v, snap(u), w, z, h)


def _fragment(k, u, v, z, s, rz):
    k.box(u, v, z, s, s * 0.8, 0.05, "resRelic", top="resRelicL", rz=rz, bevel=0.015)
    k.box(u, v, z + 0.05, s * 0.5, 0.025, 0.01, G, rz=rz)


# ---- r1: the desk extension -----------------------------------------------------------------------------------------

RV0, RV1, RH = -0.18, 28 * PXG, TOP  # the return's v span and height


def _return(k, items=True, joined=False):
    """The L return; joined=True butts it against the drawer bank's front instead of running into it."""
    v0, v1, H = (FRONT if joined else RV0), RV1, RH
    sv, cv = v1 - v0, (v0 + v1) / 2
    ur = snap(FU + 0.49)                                                              # its face toward the chair
    cu, su = (FU - 0.49 + ur) / 2, ur - FU + 0.49
    k.box(cu, cv, 0.0, su - 2 * PXG, sv - 2 * PXG, zpx(3), "dark")                    # a 1 px recessed kick
    k.box(cu, cv, zpx(3), su, sv, H - zpx(3), "lvW2", top="lvW")
    stack(k, "u", cv + 0.05, ur, 0.6, 3)                                              # drawers toward the chair
    if not items:
        return
    for i, (col, top) in enumerate((("rust", "ochL"), ("pcb", "ochL"), ("navy", "ochL"))):   # field journals
        k.box(FU - 0.22, 0.1, H + i * 0.045, 0.24, 0.3, 0.04, col, top=top, rz=0.1 * (i - 1))
    k.cyl(FU - 0.25, 0.55, H, 0.05, 0.12, "gm", top="dark", sides=10)                  # pen cup
    for du, dv in ((-0.015, 0.01), (0.015, -0.01)):
        k.box(FU - 0.25 + du, 0.55 + dv, H + 0.12, 0.015, 0.015, 0.08, ("hivis", "steelL")[du > 0])
    slate(k, FU + 0.15, 0.42, H, G, rz=-0.2)
    k.cyl(FU + 0.2, 0.05, H, 0.05, 0.03, "gm", top="steelD", sides=10)                 # puck for the card
    k.cyl(FU + 0.2, 0.05, H + 0.03, 0.025, 0.01, G, sides=8)


def r1_holo():
    k = l2a_holo()
    _pane(k, FU + 0.2, 0.05, 0.86, 0.3, 0.18, 0.15, G, F, ((0, 1, 0.18), (0, 0.5, 0.12), (1, 0.0, 0.08)))
    bar(k, (FU + 0.2, 0.05, 0.7), (FU + 0.2, 0.05, 0.86), 0.015, G)
    return k


# ---- r2: the fragment vitrine ---------------------------------------------------------------------------------------

VZ = 0.6


def case(k, cu, cv, z, su, sv, hz=0.42):
    """The display case: a red velvet bed, tablet fragments on it, brass corner posts, a lid frame with a gold light
    along its front, glass all round and over the top."""
    k.box(cu, cv, z, su - 0.08, sv - 0.08, 0.04, "lvR", top="lvR")
    for (du, dv, s, rz) in ((-0.2, -0.12, 0.24, 0.3), (0.16, -0.12, 0.2, -0.5), (-0.04, 0.14, 0.26, 0.9),
                            (0.24, 0.16, 0.14, 0.2)):
        _fragment(k, cu + du, cv + dv, z + 0.04, s, rz)
    for a in (-1, 1):
        for b in (-1, 1):
            k.box(cu + a * (su / 2 - 0.03), cv + b * (sv / 2 - 0.03), z, 0.04, 0.04, hz, "brass")
    for b in (-1, 1):
        k.box(cu, cv + b * (sv / 2 - 0.035), z + hz, su, 0.07, 0.05, "lvW2", top="lvW")
        k.box(cu + b * (su / 2 - 0.035), cv, z + hz, 0.07, sv, 0.05, "lvW2", top="lvW")
    k.box(cu, cv + sv / 2 - 0.05, z + hz - 0.02, su - 0.16, 0.03, 0.02, G)
    k.part("glass").box(cu, cv, z + 0.04, su - 0.16, sv - 0.16, hz, "glassL")


def _vitrine(k):
    su, sv = 0.84, 0.7
    k.box(FU, FV, 0.0, su - 0.08, sv - 0.08, 0.08, "dark")
    k.box(FU, FV, 0.08, su, sv, VZ - 0.08, "lvW2", top="lvW")
    for i in range(2):
        _drawer_front(k, FU, FV + sv / 2, 0.14 + i * 0.2, su - 0.12, 0.16)
    case(k, FU, FV, VZ, su, sv)


def r2_holo():
    k = l2a_holo()
    a = (FU - 0.04, FV + 0.14, VZ + 0.1)                                               # one fragment's match,
    b = (0.3, -0.44, 1.32)                                                           # up to its place
    bar(k, a, b, 0.02, G)
    ring(k, "v", b[0], b[1] + 0.02, b[2], 0.06, 12, 0.02, 0.02, G)
    ring(k, "z", a[0], a[1], a[2] + 0.04, 0.1, 12, 0.02, 0.02, G)
    return k


# ---- r3: the flat-file archive --------------------------------------------------------------------------------------

AZ = 0.82


def _archive(k):
    su, sv = 0.86, 0.72
    k.box(FU, FV, 0.0, su - 0.08, sv - 0.08, 0.06, "dark")
    k.box(FU, FV, 0.06, su, sv, AZ - 0.06, "lvW2", top="lvW")
    for i in range(5):                                                                # thin drawers
        _drawer_front(k, FU, FV + sv / 2, 0.1 + i * 0.1, su - 0.1, 0.08)
    dz, out = 0.62, 0.28                                                              # the top one, pulled out
    k.box(FU, FV + sv / 2 + out / 2 - 0.1, dz, su - 0.12, out + 0.2, 0.08, "lvW2", top="dark")
    _drawer_front(k, FU, FV + sv / 2 + out, dz, su - 0.1, 0.1)
    for (du, dv, s, rz) in ((-0.22, 0.0, 0.12, 0.4), (0.0, 0.04, 0.14, -0.3), (0.22, -0.02, 0.1, 0.9)):
        _fragment(k, FU + du, FV + sv / 2 + out / 2 - 0.1 + dv, dz + 0.04, s, rz)
        k.box(FU + du, FV + sv / 2 + out / 2 - 0.1 + dv + 0.1, dz + 0.04, 0.08, 0.04, 0.01, "lvW")   # tags
    rubbing(k, FU - 0.05, FV - 0.05, AZ)                                             # the rubbing box on top


def rubbing(k, u, v, z):
    """A lit rubbing box: a lightbox with a sheet on it and the rubbing's strokes."""
    k.box(u, v, z, 0.56, 0.44, 0.08, "lvW2", top="lvW")
    k.box(u, v, z + 0.08, 0.46, 0.34, 0.012, "resLamp")
    k.box(u, v, z + 0.092, 0.34, 0.26, 0.006, "ochL")
    for i in range(3):
        k.box(u - 0.05 + 0.02 * i, v - 0.07 + i * 0.07, z + 0.098, 0.18 - 0.03 * i, 0.03, 0.006, "resRelicD")


def r3_holo():
    k = l2a_holo()
    pu, pv, z0 = FU + 0.05, FV + 0.1, 1.04
    _pane(k, pu, pv, z0, 0.42, 0.28, 0.1, G, F, ((0, 1, 0.26), (0, 0.66, 0.22), (0, 0.33, 0.3), (0, 0.0, 0.2)))
    k.box(pu - 0.24, pv + 0.01, z0 + 0.15, 0.05, 0.03, 0.05, G)                        # its marked entry,
    bar(k, (pu - 0.24, pv + 0.01, z0 + 0.15), (FU - 0.22, FV + 0.5, 0.7), 0.015, G)    # down to the drawer
    return k


BUILD = {"r1": (bench("r1", PUCKS, _return), r1_holo),
         "r2": (bench("r2", PUCKS, _vitrine), r2_holo),
         "r3": (bench("r3", PUCKS, _archive), r3_holo)}
