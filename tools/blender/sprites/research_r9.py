"""Research bench, the combined design c1: the reconstruction bench (round 7's l2a) with
  - r1's desk return at the front left, its top cleared, and r2's display case standing on it;
  - the right drawer bank's top drawer pulled open, r3's tagged fragments in it, and r3's rubbing box on that cabinet
    in place of l2's lamp and slate.
Hologram: the reconstruction, r2's beam from a fragment in the case to its place in it, and r3's index pane over the
right bank with its marked entry tied to the open drawer."""
from .research_kit import bar, ring
from .research_r3 import _pane
from .research_kit import PXG, zpx
from .research_r6 import FRONT, front, slots
from .research_r7 import PUCKS, bench, l2a_holo
from .research_r8 import FU, RH, RV0, RV1, F, G, _fragment, _return, case, rubbing

CV = (RV0 + RV1) / 2 + 0.02      # the case on the return: centre v
CS = (0.8, 0.66)                  # its size
DU, DW = 0.98, 28 * PXG          # the right bank's top drawer (drawers(n=3) in research_r6): u, width,
DZ, DH = slots(3)[2]              # bottom and height,
FV = FRONT + 15 * PXG             # its front face, pulled out (all on the px grid)
BED = zpx(3)                      # the velvet bed in it, raised so it shows over the drawer front


def _combo(k):
    _return(k, items=False, joined=True)
    case(k, FU, CV, RH, *CS)
    rubbing(k, 1.0, -0.44, 0.66)
    k.box(DU, FRONT - 0.045, DZ, DW, 0.092, DH, "dark")                             # the opening it left
    k.box(DU, FV - 1.5 * PXG, DZ, DW, PXG, DH, "lvWS")                               # the drawer: its front 2 px
    front(k, "v", DU, FV - PXG, DW, DZ, DH)                                          # thick, plate and pull,
    v0, v1 = -0.2, FV - 2 * PXG                                                      # its tray from inside to it:
    tv, td = (v0 + v1) / 2, v1 - v0
    for su in (-1, 1):                                                               # sides 2 px thick,
        k.box(DU + su * (DW / 2 - PXG), tv, DZ, 2 * PXG, td, DH - zpx(1), "lvWS", top="lvW2")
    k.box(DU, tv, DZ, DW - 4 * PXG, td, BED, "lvW2", top="lvR")                      # a raised velvet bed
    for (du, dv, s, rz) in ((-0.22, -0.04, 0.15, 0.4), (0.0, 0.03, 0.17, -0.3), (0.22, -0.05, 0.13, 0.9)):
        _fragment(k, DU + du, (FRONT + FV) / 2 + dv, DZ + BED, s, rz)
        k.box(DU + du, (FRONT + FV) / 2 + dv + 0.13, DZ + BED, 0.08, 0.04, 0.01, "lvW")   # tags


def c1_holo(rot=0):
    k = l2a_holo(rot)
    a = (FU - 0.04, CV + 0.14, RH + 0.1)                                              # a case fragment's match
    b = (0.3, -0.44, 1.32)
    bar(k, a, b, 0.02, G)
    ring(k, "v", b[0], b[1] + 0.02, b[2], 0.06, 12, 0.02, 0.02, G)
    ring(k, "z", a[0], a[1], a[2] + 0.04, 0.1, 12, 0.02, 0.02, G)
    pu, pv, z0 = DU + 0.05, -0.1, 0.96                                                # the index pane, over the bank
    _pane(k, pu, pv, z0, 0.42, 0.26, 0.1, G, F, ((0, 1, 0.26), (0, 0.66, 0.22), (0, 0.33, 0.3), (0, 0.0, 0.2)))
    k.box(pu - 0.24, pv + 0.01, z0 + 0.14, 0.05, 0.03, 0.05, G)                        # its marked entry,
    bar(k, (pu - 0.24, pv + 0.01, z0 + 0.14), (DU - 0.22, (FRONT + FV) / 2, DZ + BED + 0.06), 0.015, G)  # to the drawer
    return k


BUILD = {"c1": (bench("c1", PUCKS, _combo, right=False, open_top=True), c1_holo)}
