"""Crew base v2: role kits and extra hairstyles (see human_v2_items for the starter gear).

  medic     torso.medic_vest (white, red band and cross), gear.back.medkit
  security  torso.armor_vest (gunmetal plates), gear.head.tactical_helmet
  gunner    torso.harness (straps over a team-colour top), gear.head.headset
  pilot     torso.flight_vest (olive, team-colour collar), gear.head.visor_cap
  hair      hair.bun, hair.long

Tops are sleeveless: the arm layers draw over the torso layer, so a torso-layer sleeve would always be hidden."""
from mathutils import Vector

from .human_base import Item
from .human_v2 import Build, W, flat, head, torso
from .human_v2_items import _hair_cap


def _vest(b, R, grow, scoop=0.1):
    """A sleeveless top from the pants' waistband to the neck; scoop: half width of the front neckline (0: crew neck)."""
    nz = R.neck.z
    keep = lambda c: not (c.z > nz - 0.04 and abs(c.x) < scoop and c.y < R.neck.y - 0.02)  # noqa: E731
    torso(b, R, grow=grow, lo=R.hips.z + 0.09, keep=keep if scoop else None,
          cuts=(R.chest.z + 0.0, R.chest.z + 0.06, R.chest.z + 0.12, R.shoulder_z - 0.03))


# ---- medic -----------------------------------------------------------------------------------------------------------

def medic_vest(A, R):
    """White vest, a red band round the chest and a red cross on the front."""
    b = Build()
    _vest(b, R, 0.018)
    cz = R.chest.z

    def col(c, n):
        if cz < c.z < cz + 0.06:
            return "medRed"
        if n.y < -0.4 and abs(c.x) < 0.025 and cz + 0.07 < c.z < cz + 0.17 or \
                n.y < -0.4 and abs(c.x) < 0.07 and cz + 0.1 < c.z < cz + 0.14:
            return "medRed"
        return "medWhite"
    return Item("torso", "medic_vest", [b.mesh("v2.medic_vest", A, col)])


def medkit(A, R):
    """A grey case on the back (it has to read against the white vest) with a big red cross."""
    b = Build()
    c = Vector((0, R.chest.y + 0.22, R.chest.z + 0.05))
    b.blob(c, 0.13, 0.06, 0.14, W("spine_03"), exp=4.0, nlat=8)

    def col(p, n):
        r = p - c
        if n.y > 0.5 and (abs(r.x) < 0.035 and abs(r.z) < 0.1 or abs(r.z) < 0.035 and abs(r.x) < 0.1):
            return "medRed"
        return "plate"
    return Item("gear.back", "medkit", [b.mesh("v2.medkit", A, col)])


# ---- security --------------------------------------------------------------------------------------------------------

def armor_vest(A, R):
    """A gunmetal plate carrier: dark plates front and back, lighter sides, a team-colour band at the hem."""
    b = Build()
    _vest(b, R, 0.035, scoop=0)
    lo = R.hips.z + 0.09

    def col(c, n):
        if c.z < lo + 0.04:
            return "team.cloth"
        if abs(n.y) > 0.5 and abs(c.x) < 0.12 and c.z < R.shoulder_z:
            return "gmD"
        return "gm"
    return Item("torso", "armor_vest", [b.mesh("v2.armor_vest", A, col)])


def tactical_helmet(A, R):
    """A gunmetal helmet down to the brows and over the ears, a team-colour stripe over the top."""
    b = Build()
    c = R.head_c
    head(b, R, grow=0.035, keep=lambda p: (p - c).z > 0.0 or (p - c).y > -0.02 and (p - c).z > -0.08)

    def col(p, n):
        return "team.cloth" if abs(p.x) < 0.025 and (p - c).z > 0.06 else "gmD"
    return Item("gear.head", "tactical_helmet", [b.mesh("v2.tactical_helmet", A, col)])


# ---- gunner ----------------------------------------------------------------------------------------------------------

def harness(A, R):
    """A team-colour top with leather straps over the shoulders, down the front and back, and round the waist."""
    b = Build()
    _vest(b, R, 0.018)
    lo = R.hips.z + 0.09

    def col(c, n):
        if c.z < lo + 0.04:
            return "leather"
        if 0.045 < abs(c.x) < 0.11 and c.z > R.chest.z - 0.12:
            return "leather"
        return "team.cloth"
    return Item("torso", "harness", [b.mesh("v2.harness", A, col)])


def headset(A, R):
    """Ear cups, a band over the head and a mic boom to the mouth."""
    b = Build()
    c = R.head_c
    w = W("head")
    for sx in (1, -1):
        b.blob(c + Vector((sx * (R.HX + 0.025), 0.0, -0.01)), 0.03, 0.055, 0.06, w, exp=2.6, nlat=6)
        b.tube(c + Vector((sx * (R.HX + 0.02), 0.0, 0.04)), c + Vector((sx * 0.06, 0.0, R.HZ + 0.02)), 0.018, 0.018, w)
    b.tube(c + Vector((0.06, 0.0, R.HZ + 0.02)), c + Vector((-0.06, 0.0, R.HZ + 0.02)), 0.018, 0.018, w)
    b.tube(c + Vector((R.HX + 0.03, -0.03, -0.04)), Vector((0.03, R.front - 0.02, c.z - 0.12)), 0.012, 0.012, w)
    b.blob(Vector((0.02, R.front - 0.025, c.z - 0.12)), 0.022, 0.018, 0.018, w, exp=2.4, nlat=6)

    def col(p, n):
        if p.y < R.front - 0.005 and p.z < c.z - 0.1:
            return "orange"                                                 # the mic's live light
        return "dark" if abs(p.x) > R.HX else "steel"
    return Item("gear.head", "headset", [b.mesh("v2.headset", A, col)], glow=True)


# ---- pilot -----------------------------------------------------------------------------------------------------------

def flight_vest(A, R):
    """An olive flight vest with a team-colour collar and two chest pockets."""
    b = Build()
    _vest(b, R, 0.022, scoop=0.07)
    cz = R.chest.z

    def col(c, n):
        if c.z > R.shoulder_z - 0.03 and abs(c.x) < 0.16:
            return "team.cloth"
        if n.y < -0.4 and 0.04 < abs(c.x) < 0.11 and cz + 0.0 < c.z < cz + 0.06:
            return "jacketD"
        return "jacket"
    return Item("torso", "flight_vest", [b.mesh("v2.flight_vest", A, col)])


def visor_cap(A, R):
    """A team-colour cap with a dark visor brim."""
    b = Build()
    c = R.head_c
    head(b, R, grow=0.025, keep=lambda p: (p - c).z > 0.05)
    b.blob(Vector((0, R.front - 0.03, c.z + 0.06)), 0.085, 0.05, 0.012, W("head"), exp=2.4, nlat=6)
    col = lambda p, n: "dark" if p.y < R.front - 0.005 and p.z < c.z + 0.075 else "team.cloth"  # noqa: E731
    return Item("gear.head", "visor_cap", [b.mesh("v2.visor_cap", A, col)])


# ---- hair ------------------------------------------------------------------------------------------------------------

def hair_bun(A, R):
    b = Build()
    _hair_cap(b, R, back=-0.1)
    c = R.head_c
    b.blob(c + Vector((0, R.HY - 0.01, R.HZ - 0.03)), 0.06, 0.055, 0.055, W("head"), exp=2.2, nlat=8)
    return Item("hair", "bun", [b.mesh("v2.hair.bun", A, flat("team.hair"))])


def hair_long(A, R):
    """Hair down to the shoulders at the back and sides."""
    b = Build()
    _hair_cap(b, R, back=-0.2)
    c = R.head_c
    b.blob(c + Vector((0, R.HY * 0.55, -0.12)), R.HX + 0.02, 0.06, 0.13, W("head"), exp=3.0, nlat=8)
    return Item("hair", "long", [b.mesh("v2.hair.long", A, flat("team.hair"))])


def build(A, R):
    return [medic_vest(A, R), medkit(A, R), armor_vest(A, R), tactical_helmet(A, R), harness(A, R), headset(A, R),
            flight_vest(A, R), visor_cap(A, R), hair_bun(A, R), hair_long(A, R)]
