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
    """Heavy armour, each part its own mesh so it takes one clear tone: a light shell with dark gaps between its
    segments, a raised chest plate, two abdomen plates and a back plate (light, a dark underside), a team-colour
    collar and hem, glowing nodes on the plates (the visor's cyan). Light like the pads and the helmet, so the set reads
    as one suit."""
    from .human_v2_kits import _vest
    shell, plates, trim, nodes = Build(), Build(), Build(), Build()
    _vest(shell, R, 0.06, scoop=0)
    xm = R.h["arm.L"].x + 0.02                                               # the armholes: the shell stops short of
    for v in shell.v:                                                        # the shoulder joint, so the arms (drawn
        if v.z > R.chest.z:                                                  # over the torso layer) don't cut it into
            v.x = max(-xm, min(xm, v.x))                                     # scraps; the pads cover the joint
    lo = R.hips.z + 0.09
    nodes_at = []
    for z0, z1, w in ((R.chest.z - 0.04, R.shoulder_z - 0.02, 0.85), (R.chest.z - 0.15, R.chest.z - 0.07, 0.7),
                      (R.chest.z - 0.25, R.chest.z - 0.17, 0.65)):           # chest, then the abdomen plates
        z = (z0 + z1) / 2
        c, hx, hy = _section(R, z)
        wt = W("spine_03" if z > R.chest.z - 0.05 else "spine_02")
        plates.blob(Vector((0, c.y - hy - 0.075, z)), hx * w, 0.03, (z1 - z0) / 2, wt, exp=4.0, nlat=6)
        if z0 > R.chest.z - 0.1:                                             # the back plate
            plates.blob(Vector((0, c.y + hy + 0.075, z)), hx * w, 0.03, (z1 - z0) / 2, wt, exp=4.0, nlat=6)
        front, back = c.y - hy - 0.105, c.y + hy + 0.105                    # the plates' outer faces
        if z0 > R.chest.z - 0.1:                                             # the nodes: a pair on the back plate (the
            nodes_at += [(Vector((sx * hx * 0.5, back, z)), 0.034, wt) for sx in (1, -1)]   # chest's are under the chin),
        elif z0 > R.chest.z - 0.2:                                           # a core on the upper abdomen, a pair on
            nodes_at.append((Vector((0, front, z)), 0.046, wt))              # the lower
        else:
            nodes_at += [(Vector((sx * hx * 0.42, front, z)), 0.03, wt) for sx in (1, -1)]
    for q, r, wt in nodes_at:
        nodes.blob(q, r, 0.018, r * 0.9, wt, exp=2.4, nlat=6)
    nc = R.neck
    trim.tube(nc - Vector((0, 0, 0.05)), nc + Vector((0, 0, 0.02)), 0.11, 0.1, W("spine_03"))       # the collar
    seams = (R.chest.z - 0.055, R.chest.z - 0.16)

    def hard(p, n):
        if p.z < lo + 0.04:
            return "team.cloth"                                              # the hem
        d = min(abs(p.z - z) for z in seams)
        if d < 0.009:
            return "fxH1"                                                    # a light strip in each gap
        if d < 0.018:
            return "dark"                                                    # the gaps between the segments
        return "sole" if n.z > 0.5 else "plate"
    objs = [shell.mesh("v2.armor_heavy", A, hard),
            plates.mesh("v2.armor_heavy.plates", A,
                        lambda p, n: "sole" if n.z > 0.45 else ("dark" if n.z < -0.35 else "plate")),
            trim.mesh("v2.armor_heavy.collar", A, lambda p, n: "team.cloth"),
            nodes.mesh("v2.armor_heavy.nodes", A,                         # not fxC1/2: they can render with no red
                       lambda p, n: "fxC0" if abs(n.y) > 0.8 else "fxH1")]  # and read as the team.accent key
    return Item("torso", "armor_heavy", objs, glow=True)


def shoulder_pads(A, R):
    """Pauldrons: a dome over each shoulder joint and an armoured sleeve down the upper arm to the elbow, team-colour
    edge at its hem. They are drawn over the arms, so they cover the joint where the torso armour stops."""
    b = Build()
    sleeves = []
    for s, sx in (("L", 1), ("R", -1)):
        sh = R.h[f"arm.{s}"]
        d = sh + Vector((sx * 0.02, 0.0, 0.03))
        b.blob(d, 0.135, 0.14, 0.085, blend(f"clavicle.{s}", f"arm.{s}", 0.75), exp=2.6, nlat=8)
        el = R.T["limb"][f"arm.{s}"][-1][0]                                 # the elbow (rest pose: arms out)
        L = (el.x - sh.x) * sx - 0.045
        b.tube(sh - Vector((sx * 0.05, 0, 0)), sh + Vector((sx * L, 0, 0)), 0.13, 0.1, W(f"arm.{s}"))
        # The sleeve is roomy, starts inside the shoulder with a round end and is all on the arm bone like the bare arm,
        # so it encloses the arm's upper half in any pose: the arm is a holdout for this layer, so wherever it poked
        # out it would cut a skin-coloured hole. It runs to the elbow, as a bare upper arm under a short pad shows as
        # skin patches round the shoulder.
        sleeves.append((sh, sx, L))

    def col(p, n):
        for sh, sx, L in sleeves:
            t = (p.x - sh.x) * sx                                            # along the arm (rest pose: arms out)
            if t > 0.06 and abs(p.z - sh.z) < 0.16:
                return "team.cloth" if t > L - 0.035 else ("sole" if n.z > 0.6 else "plate")
        return "sole" if n.z > 0.6 else "plate"
    return Item("gear.shoulder", "pads", [b.mesh("v2.shoulder_pads", A, col)])


def _fin(b, R, sx, wt, t=0.035):
    """An angular ear: a flat blade off the side of the helmet, a wide base swept back to a sharp tip, leaning out a
    little."""
    c = R.head_c
    x0 = sx * (R.HX + 0.02)
    prof = ((-0.05, 0.04), (0.1, -0.01), (0.33, R.HZ * 0.85 + 0.087), (0.3, R.HZ * 0.85 + 0.104))   # (y, z) from the head centre
    rings = []
    for dx in (0.0, t):
        rings.append([b.point(c + Vector((x0 + sx * (dx + 0.35 * z), y, z)), wt) for y, z in prof])
    b.bridge(rings[0], rings[1])
    for r, flip in ((rings[0], False), (rings[1], True)):
        pole = b.point(sum((b.v[k] for k in r), Vector()) / len(r), wt)
        b.cap(r, pole, flip=flip)


def heavy_helmet(A, R):
    """A closed helmet over the hair: a light shell with a dark chin guard, a dark visor with a glowing slit, team-colour
    comms units over the ears with an angular blade swept back from each, a team-colour crest ridge."""
    shell, visor, crest, parts, fins = Build(), Build(), Build(), Build(), Build()
    c = R.head_c
    w = W("head")
    head(shell, R, grow=0.045)
    shell.blob(c + Vector((0, -R.HY - 0.035, -0.075)), 0.07, 0.03, 0.045, w, exp=2.6, nlat=6)    # the chin guard
    vc = c + Vector((0, -R.HY - 0.055, 0.0))
    visor.blob(vc, R.HX * 1.0, 0.045, 0.055, w, exp=3.2, nlat=6)
    crest.blob(c + Vector((0, 0.01, R.HZ + 0.05)), 0.03, R.HY + 0.02, 0.03, w, exp=3.0, nlat=8)
    for sx in (1, -1):
        parts.blob(c + Vector((sx * (R.HX + 0.06), 0.01, -0.01)), 0.035, 0.075, 0.075, w, exp=2.6, nlat=6)
        _fin(fins, R, sx, w)

    def part(p, n):
        return "team.cloth" if abs(p.x) > R.HX + 0.03 and p.z < c.z + 0.07 else "steel"
    objs = [shell.mesh("v2.heavy_helmet", A, lambda p, n: "gm" if p.z < c.z - 0.05 and p.y < c.y - R.HY
                       else ("sole" if n.z > 0.6 else "plate")),
            visor.mesh("v2.heavy_helmet.visor", A,
                       lambda p, n: "fxC1" if abs(p.z - vc.z - 0.005) < 0.018 and n.y < -0.3 else "glassD"),
            crest.mesh("v2.heavy_helmet.crest", A, lambda p, n: "team.cloth"),
            parts.mesh("v2.heavy_helmet.parts", A, part),
            fins.mesh("v2.heavy_helmet.fins", A, lambda p, n: "gm" if abs(n.z) < 0.4 else "sole",
                      smooth=False)]
    return Item("gear.head", "heavy_helmet", objs, glow=True)


def build(A, R):
    return [armor_heavy(A, R), shoulder_pads(A, R), heavy_helmet(A, R)]
