"""Research bench, the combined design c1: the reconstruction bench (round 7's l2a) with
  - r1's desk return at the front left, its top cleared, and r2's display case standing on it;
  - the right drawer bank's top drawer pulled open, r3's tagged fragments in it, and r3's rubbing box on that cabinet
    in place of l2's lamp and slate.
Hologram: the reconstruction, r2's beam from a fragment in the case to its place in it, and r3's index pane over the
right bank with its marked entry tied to the open drawer."""
from .research_kit import bar, ring
from .research_r3 import _pane
from .research_r7 import bench, l2a_holo
from .research_r8 import FU, RH, RV0, RV1, F, G, _drawer_front, _fragment, _return, case, rubbing

CV = (RV0 + RV1) / 2 + 0.02      # the case on the return: centre v
CS = (0.8, 0.66)                  # its size
DU, DZ, DOUT = 0.98, 0.4467, 0.46  # the right bank's top drawer: u, bottom, how far out (drawers(n=3) in research_r6)
DH = 0.1533
BED = 0.08                        # the velvet bed in it, raised so it shows over the drawer front


def _combo(k):
    _return(k, items=False)
    case(k, FU, CV, RH, *CS)
    rubbing(k, 1.0, -0.44, 0.66)
    k.box(DU, -0.14, DZ, 0.86, 0.02, DH, "dark")                                     # the opening it left
    fv = -0.16 + DOUT                                                                # the drawer, out
    k.box(DU, -0.16 + DOUT / 2, DZ, 0.84, DOUT + 0.04, BED, "lvW2", top="lvR")       # a raised velvet bed
    for su in (-1, 1):
        k.box(DU + su * 0.41, -0.16 + DOUT / 2, DZ, 0.02, DOUT, DH - 0.03, "lvW2", top="lvW")
    _drawer_front(k, DU, fv, DZ, 0.86, DH)
    for (du, dv, s, rz) in ((-0.22, -0.04, 0.15, 0.4), (0.0, 0.03, 0.17, -0.3), (0.22, -0.05, 0.13, 0.9)):
        _fragment(k, DU + du, -0.16 + DOUT / 2 + dv, DZ + BED, s, rz)
        k.box(DU + du, -0.16 + DOUT / 2 + dv + 0.13, DZ + BED, 0.08, 0.04, 0.01, "lvW")   # tags


def c1_holo():
    k = l2a_holo()
    a = (FU - 0.04, CV + 0.14, RH + 0.1)                                              # a case fragment's match
    b = (0.3, -0.44, 1.32)
    bar(k, a, b, 0.02, G)
    ring(k, "v", b[0], b[1] + 0.02, b[2], 0.06, 12, 0.02, 0.02, G)
    ring(k, "z", a[0], a[1], a[2] + 0.04, 0.1, 12, 0.02, 0.02, G)
    pu, pv, z0 = DU + 0.05, -0.1, 0.96                                                # the index pane, over the bank
    _pane(k, pu, pv, z0, 0.42, 0.26, 0.1, G, F, ((0, 1, 0.26), (0, 0.66, 0.22), (0, 0.33, 0.3), (0, 0.0, 0.2)))
    k.box(pu - 0.24, pv + 0.01, z0 + 0.14, 0.05, 0.03, 0.05, G)                        # its marked entry,
    bar(k, (pu - 0.24, pv + 0.01, z0 + 0.14), (DU - 0.22, -0.16 + DOUT / 2, DZ + BED + 0.06), 0.015, G)  # to the drawer
    return k


BUILD = {"c1": (bench("c1", ((-0.5, 0.3), (0.5, 0.3)), _combo, right=False), c1_holo)}
