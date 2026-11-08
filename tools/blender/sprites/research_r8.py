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
from .research_r7 import bench, l2a_holo

FU, FV = -0.98, 0.36              # the front-left tile's unit: centre u, v
G, F = "resGold", "resGoldF"


def _drawer_front(k, u, v, z, w, h, face="v"):
    """A drawer front with a label plate and a pull, on the +v face (face 'v') or the +u face (face 'u')."""
    if face == "v":
        k.box(u, v, z, w, 0.02, h, "lvWS")
        k.box(u - w * 0.25, v + 0.015, z + h * 0.35, w * 0.2, 0.02, 0.04, "plate")
        k.box(u + w * 0.25, v + 0.02, z + h * 0.3, w * 0.16, 0.025, 0.03, "steelD")
    else:
        k.box(u, v, z, 0.02, w, h, "lvWS")
        k.box(u + 0.015, v + w * 0.25, z + h * 0.35, 0.02, w * 0.2, 0.04, "plate")
        k.box(u + 0.02, v - w * 0.25, z + h * 0.3, 0.025, w * 0.16, 0.03, "steelD")


def _fragment(k, u, v, z, s, rz):
    k.box(u, v, z, s, s * 0.8, 0.05, "resRelic", top="resRelicL", rz=rz, bevel=0.015)
    k.box(u, v, z + 0.05, s * 0.5, 0.025, 0.01, G, rz=rz)


# ---- r1: the desk extension -----------------------------------------------------------------------------------------

RV0, RV1, RH = -0.18, 0.86, 0.66  # the return's v span and height


def _return(k, items=True):
    v0, v1, H = RV0, RV1, RH
    sv, cv = v1 - v0, (v0 + v1) / 2
    k.box(FU, cv, 0.0, 0.9, sv - 0.08, 0.08, "dark")
    k.box(FU, cv, 0.08, 0.98, sv, H - 0.12, "lvW2", top="lvW", bevel=0.02)
    k.box(FU, cv, H - 0.04, 1.01, sv + 0.03, 0.04, "gm", top="lvW", bevel=0.012)
    for i in range(3):                                                                # drawers toward the chair
        _drawer_front(k, FU + 0.5, cv + 0.05, 0.12 + i * 0.16, 0.6, 0.13, face="u")
    k.box(FU, v1 + 0.005, 0.15, 0.8, 0.02, H - 0.3, "lvW2")                           # a panel on its end
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
    k.part("glass").box(cu, cv, z + 0.02, su - 0.06, sv - 0.06, hz + 0.02, "glassL")


def _vitrine(k):
    su, sv = 0.84, 0.7
    k.box(FU, FV, 0.0, su - 0.08, sv - 0.08, 0.08, "dark")
    k.box(FU, FV, 0.08, su, sv, VZ - 0.12, "lvW2", top="lvW", bevel=0.02)
    k.box(FU, FV, VZ - 0.04, su + 0.03, sv + 0.03, 0.04, "gm", top="lvW", bevel=0.012)
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
    k.box(FU, FV, 0.06, su, sv, AZ - 0.1, "lvW2", top="lvW", bevel=0.02)
    k.box(FU, FV, AZ - 0.04, su + 0.03, sv + 0.03, 0.04, "gm", top="lvW", bevel=0.012)
    for i in range(5):                                                                # thin drawers
        _drawer_front(k, FU, FV + sv / 2, 0.1 + i * 0.1, su - 0.1, 0.08)
    dz, out = 0.62, 0.28                                                              # the top one, pulled out
    k.box(FU, FV + sv / 2 + out / 2 - 0.1, dz, su - 0.12, out + 0.2, 0.08, "lvW2", top="dark")
    _drawer_front(k, FU, FV + sv / 2 + out, dz, su - 0.1, 0.1)
    for (du, dv, s, rz) in ((-0.22, 0.0, 0.12, 0.4), (0.0, 0.04, 0.14, -0.3), (0.22, -0.02, 0.1, 0.9)):
        _fragment(k, FU + du, FV + sv / 2 + out / 2 - 0.1 + dv, dz + 0.04, s, rz)
        k.box(FU + du, FV + sv / 2 + out / 2 - 0.1 + dv + 0.1, dz + 0.04, 0.08, 0.04, 0.01, "lvW")   # tags
    bz = AZ                                                                           # the rubbing box on top
    k.box(FU - 0.05, FV - 0.05, bz, 0.56, 0.44, 0.08, "lvW2", top="lvW", bevel=0.01)
    k.box(FU - 0.05, FV - 0.05, bz + 0.08, 0.46, 0.34, 0.012, "resLamp")
    k.box(FU - 0.05, FV - 0.05, bz + 0.092, 0.34, 0.26, 0.006, "ochL")
    for i in range(3):
        k.box(FU - 0.1 + 0.02 * i, FV - 0.12 + i * 0.07, bz + 0.098, 0.18 - 0.03 * i, 0.03, 0.006, "resRelicD")


def r3_holo():
    k = l2a_holo()
    pu, pv, z0 = FU + 0.05, FV + 0.1, 1.04
    _pane(k, pu, pv, z0, 0.42, 0.28, 0.1, G, F, ((0, 1, 0.26), (0, 0.66, 0.22), (0, 0.33, 0.3), (0, 0.0, 0.2)))
    k.box(pu - 0.24, pv + 0.01, z0 + 0.15, 0.05, 0.03, 0.05, G)                        # its marked entry,
    bar(k, (pu - 0.24, pv + 0.01, z0 + 0.15), (FU - 0.22, FV + 0.5, 0.7), 0.015, G)    # down to the drawer
    return k


BUILD = {"r1": (bench("r1", ((-0.5, 0.3), (0.5, 0.3)), _return), r1_holo),
         "r2": (bench("r2", ((-0.5, 0.3), (0.5, 0.3)), _vitrine), r2_holo),
         "r3": (bench("r3", ((-0.5, 0.3), (0.5, 0.3)), _archive), r3_holo)}
