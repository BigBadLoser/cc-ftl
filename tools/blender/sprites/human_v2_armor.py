"""Crew v2 armour (with human_v2_kits' security kit): the plate carrier made to read as armour, and the heavy set.

  torso.armor_vest       (human_v2_kits) bulked up here: raised chest and back plates, two pouches on the belly
  torso.armor_heavy      thick segmented plates front and back, a high collar, team-colour trim
  gear.shoulder.pads     chunky pauldrons over both shoulders, following the arms (slot gear.shoulder: over the arms,
                         under a held weapon)
  gear.head.heavy_helmet a closed helmet with a full face visor; like the EVA helmet it covers the hair, so the runtime
                         drops the hair layer under it

Plates are gunmetal with a lighter top edge, so they read as hard against the cloth; team colour stays on the trim (a
team.cloth key), so the armour swaps per faction."""
from mathutils import Vector

from .human_base import Item
from .human_v2 import Build, W, blend, head


def _section(R, z):
    """The traced torso section nearest height z: (centre, half width, half depth)."""
    c, hx, hy, _ = min(R.T["torso"], key=lambda r: abs(r[0].z - z))
    return c, hx, hy


def _plates(b, R, lo, hi, grow, rows, depth=0.035):
    """Raised plates front and back between heights lo and hi, `rows` of them stacked (a segmented front)."""
    out = []
    for k in range(rows):
        z = lo + (k + 0.5) * (hi - lo) / rows
        c, hx, hy = _section(R, z)
        hz = (hi - lo) / rows / 2 - 0.006
        for sy in (-1, 1):
            p = Vector((0, c.y + sy * (hy + grow + depth * 0.4), z))
            b.blob(p, hx * 0.72, depth, hz, W("spine_03" if z > R.chest.z - 0.05 else "spine_02"), exp=4.0, nlat=6)
            out.append(p)
    return out


def armor_vest(A, R):
    """The security plate carrier: a thick gunmetal shell, a raised plate front and back, two belly pouches, a team
    band at the hem."""
    from .human_v2_kits import _vest
    b = Build()
    _vest(b, R, 0.045, scoop=0)
    lo = R.hips.z + 0.09
    plates = _plates(b, R, R.chest.z - 0.1, R.shoulder_z - 0.04, 0.045, 1)
    c, hx, hy = _section(R, R.chest.z - 0.16)
    pouches = [Vector((sx * 0.065, c.y - hy - 0.075, R.chest.z - 0.16)) for sx in (1, -1)]
    for p in pouches:
        b.blob(p, 0.05, 0.035, 0.055, W("spine_02"), exp=3.0, nlat=6)

    def col(p, n):
        if p.z < lo + 0.04:
            return "team.cloth"
        if any((p - q).length < 0.075 for q in pouches):
            return "jacketD" if n.z < 0.5 else "jacket"
        if any(abs(p.y - q.y) < 0.03 and abs(p.z - q.z) < 0.16 and abs(p.x) < 0.17 for q in plates):
            return "sole" if n.z > 0.5 else "plate"                         # the plates: light, a pale top edge
        return "gmD"
    return Item("torso", "armor_vest", [b.mesh("v2.armor_vest", A, col)])


def armor_heavy(A, R):
    """Heavy armour: a thick shell, three segmented plates down the front and back, a high collar, team trim."""
    from .human_v2_kits import _vest
    b = Build()
    _vest(b, R, 0.06, scoop=0)
    lo = R.hips.z + 0.09
    plates = _plates(b, R, R.hips.z + 0.16, R.shoulder_z - 0.03, 0.06, 3, depth=0.04)
    nc = R.neck
    b.tube(nc - Vector((0, 0, 0.05)), nc + Vector((0, 0, 0.02)), 0.11, 0.1, W("spine_03"))       # the collar

    def col(p, n):
        if p.z < lo + 0.04 or abs(p.z - nc.z) < 0.06 and (p - nc).length < 0.13:
            return "team.cloth"
        if any(abs(p.y - q.y) < 0.035 and abs(p.z - q.z) < 0.06 and abs(p.x) < 0.17 for q in plates):
            return "sole" if n.z > 0.5 else "plate"
        return "gmD"
    return Item("torso", "armor_heavy", [b.mesh("v2.armor_heavy", A, col)])


def shoulder_pads(A, R):
    """Chunky pauldrons: a domed plate over each shoulder and a second plate under it, team-colour edge."""
    b = Build()
    parts = []
    for s, sx in (("L", 1), ("R", -1)):
        sh = R.h[f"arm.{s}"]
        for k, (dz, dx, h) in enumerate(((0.04, 0.02, 0.065), (-0.035, 0.05, 0.05))):
            p = sh + Vector((sx * dx, 0.0, dz))
            b.blob(p, 0.115, 0.12, h, blend(f"clavicle.{s}", f"arm.{s}", 0.35 + 0.4 * k), exp=2.6, nlat=8)
            parts.append((p, h))

    def col(p, n):
        q, h = min(parts, key=lambda t: (p - t[0]).length)
        if p.z < q.z - h * 0.4:
            return "team.cloth"                                              # the edge
        return "sole" if n.z > 0.6 else "plate"
    return Item("gear.shoulder", "pads", [b.mesh("v2.shoulder_pads", A, col)])


def heavy_helmet(A, R):
    """A closed helmet, grown well over the hair, with a full face visor and a team stripe over the crown."""
    b = Build()
    c = R.head_c
    head(b, R, grow=0.045)
    b.blob(c + Vector((0, -R.HY - 0.035, -0.07)), 0.065, 0.03, 0.045, W("head"), exp=2.6, nlat=6)  # the chin guard

    def col(p, n):
        r = p - c
        if r.y < -0.05 and -0.05 < r.z < 0.06 and n.y < -0.3:
            return "glassD" if r.z < 0.03 else "lens"                         # the visor, a highlight along its top
        if abs(p.x) < 0.03 and r.z > 0.05:
            return "team.cloth"
        return "sole" if n.z > 0.6 else "plate"
    return Item("gear.head", "heavy_helmet", [b.mesh("v2.heavy_helmet", A, col)])


def build(A, R):
    return [armor_heavy(A, R), shoulder_pads(A, R), heavy_helmet(A, R)]
