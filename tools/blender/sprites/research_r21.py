"""Research companions, round 21: grey blockouts of the dissection table (b1-b4), shape only. Medical (surgery or autopsy
table) with some sci-fi uplift; each is one body, every feature big enough to read at game scale (3 px or more).

  b1 pedestal: an autopsy table on one flared column, a rimmed tray stepping down into a sink basin at the foot
  b2 hook: a head tower whose top curls forward into a scanner hood, the tray cantilevered out of its base
  b3 wedge: one tapered mass with the bed sunk into its top, a raised instrument ridge along the far side, a basin at
      the foot
  b4 drawer: a cabinet with a hood over its top, the tray slid out of it on rails like a morgue drawer"""
from .modkit import K
from .research_kit import Bench
from .research_r13 import FP2, P, Z, blk
from .research_r15 import prism

G = ("resGlsL", "resGls", "resGlsD")                     # a light clay grey: top, front, side


def _none():
    k = K("research_b_holo", FP2, 0)
    k.box(0.0, 0.0, Z(4), 0.01, 0.01, 0.01, "resGls")          # hidden inside the body: an empty holo layer
    return k


def rims(k, u0, u1, v0, v1, z0, z1, w=P(2), ends=(True, True)):
    """A raised rim around a tray top: the two long sides, and the ends asked for."""
    blk(k, u0, u1, v0, v0 + w, z0, z1, G)
    blk(k, u0, u1, v1 - w, v1, z0, z1, G)
    if ends[0]:
        blk(k, u0, u0 + w, v0, v1, z0, z1, G)
    if ends[1]:
        blk(k, u1 - w, u1, v0, v1, z0, z1, G)


def basin(k, u0, u1, v0, v1, zf, z1, zb):
    """A sink basin at the foot: its floor at zf, walls to z1, its underside at zb."""
    blk(k, u0, u1, v0, v1, zb, zf, G)
    rims(k, u0, u1, v0, v1, zf, z1, ends=(False, True))


# ---- b1: pedestal ---------------------------------------------------------------------------------------------------

def b1(layer):
    k = Bench(f"research_b1_{layer}", FP2)
    blk(k, P(-18), P(4), P(-10), P(10), 0, Z(2), G)                                       # the foot plate
    for prof in ([(P(-9), Z(2)), (P(9), Z(2)), (P(5), Z(8)), (P(-5), Z(8))],              # the column: flared foot,
                 [(P(-5), Z(8)), (P(5), Z(8)), (P(5), Z(12)), (P(-5), Z(12))],            # waist,
                 [(P(-5), Z(12)), (P(5), Z(12)), (P(13), Z(17)), (P(-13), Z(17))]):       # flared head
        prism(k, "u", P(-16), P(2), prof, G)
    blk(k, P(-31), P(21), P(-14), P(14), Z(17), Z(20), G)                                 # the tray,
    rims(k, P(-31), P(21), P(-14), P(14), Z(20), Z(22), ends=(True, False))
    blk(k, P(-29), P(-21), P(-6), P(6), Z(20), Z(23), G)                                  # a head block
    basin(k, P(21), P(31), P(-14), P(14), Z(16), Z(22), Z(12))                            # the sink at the foot
    return k.build()


# ---- b2: hook -------------------------------------------------------------------------------------------------------

def b2(layer):
    k = Bench(f"research_b2_{layer}", FP2)
    blk(k, P(-32), P(-16), P(-15), P(15), 0, Z(3), G)                                     # the tower's plinth,
    prism(k, "v", P(-14), P(14), [(P(-31), Z(3)), (P(-18), Z(3)), (P(-18), Z(36)), (P(-31), Z(36))], G)  # the tower,
    prism(k, "v", P(-14), P(14), [(P(-31), Z(36)), (P(-18), Z(35)), (P(3), Z(35)), (P(3), Z(38)), (P(-6), Z(44)),
                                  (P(-31), Z(44))], G)                                    # its top curling forward
    prism(k, "v", P(-12), P(12), [(P(-18), Z(9)), (P(26), Z(16)), (P(31), Z(17)), (P(31), Z(21)), (P(-18), Z(21))],
          G)                                                                              # the tray cantilevered out
    rims(k, P(-18), P(31), P(-12), P(12), Z(21), Z(23), ends=(False, True))
    return k.build()


# ---- b3: wedge ------------------------------------------------------------------------------------------------------

def b3(layer):
    k = Bench(f"research_b3_{layer}", FP2)
    prism(k, "u", P(-31), P(23), [(P(-9), 0), (P(9), 0), (P(14), Z(18)), (P(-14), Z(18))], G)   # the mass,
    rims(k, P(-31), P(23), P(-14), P(14), Z(18), Z(21), ends=(True, False))              # the bed sunk in its top
    prism(k, "u", P(-31), P(18), [(P(-15), Z(18)), (P(-11), Z(18)), (P(-11), Z(23)), (P(-15), Z(28))], G)  # the ridge
    prism(k, "u", P(23), P(31), [(P(-9), 0), (P(9), 0), (P(12), Z(12)), (P(-12), Z(12))], G)    # the foot, lower,
    basin(k, P(23), P(31), P(-14), P(14), Z(15), Z(21), Z(12))                            # carrying the basin
    return k.build()


# ---- b4: drawer -----------------------------------------------------------------------------------------------------

def b4(layer):
    k = Bench(f"research_b4_{layer}", FP2)
    blk(k, P(-31), P(-2), P(-15), P(15), 0, Z(30), G)                                     # the cabinet,
    prism(k, "v", P(-14), P(14), [(P(-31), Z(30)), (P(-2), Z(30)), (P(12), Z(33)), (P(12), Z(36)),
                                  (P(-31), Z(36))], G)                                    # a hood over its top
    for v0 in (P(-13), P(11)):
        blk(k, P(-2), P(0), v0, v0 + P(2), Z(11), Z(22), G)                               # the drawer's frame,
    blk(k, P(-2), P(0), P(-13), P(13), Z(20), Z(22), G)
    for v0 in (P(-9), P(7)):
        blk(k, P(-2), P(26), v0, v0 + P(2), Z(11), Z(15), G)                              # the rails,
    blk(k, P(-6), P(31), P(-11), P(11), Z(15), Z(18), G)                                  # the tray slid out
    rims(k, P(-6), P(31), P(-11), P(11), Z(18), Z(20), ends=(False, True))
    return k.build()


BUILD = {v: (globals()[v], _none, FP2) for v in ("b1", "b2", "b3", "b4")}
