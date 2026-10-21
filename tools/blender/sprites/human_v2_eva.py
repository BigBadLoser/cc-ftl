"""The EVA suit on the v2 body: the shell, sleeves, legs and helmet built from the same traced sections as the body (the
old suit was cut from the realistic base's mesh, whose bumpy surface shaded as speckle at 2x, with a box for a helmet).
The life-support pack (scaled up) and the suited cyber forearm stay the old rigid ones (human_suit).

  torso.eva            a puffy white shell, a team-colour chest panel under a control unit, ribbed hoses from it round
                       the waist to the pack, a gunmetal waist bearing and a collar seal ring the helmet sits in
  legs.eva             suit legs with knee pads, a team-colour band above each knee, thigh bearings and chunky boots on the feet
  arm.L.eva, arm.R.eva sleeves with an upper-arm band, an elbow joint, a wrist bearing and gunmetal gloves
  arm.L.eva_cyber      the sleeve stops above the elbow (the cyber forearm stays out)
  gear.head.eva_helmet a round bubble with a gold visor wrapped round its front, a faint HUD line along the visor top, a
                       a gunmetal frame round it, team-colour ear pucks and a lit lamp"""
import bpy
from mathutils import Vector

from .human_base import Item
from .human_v2 import Build, W, arm, blend, chain, fingers, leg, torso

SHELL = "medWhite"
COLLAR = (0.2, 0.2)          # the helmet seal ring's half width and depth: it sits on the shoulders, wider than the neck
HOSE = 0.022                 # hose radius
PACK = 1.2                   # the old life-support pack, scaled up from the top of its front face


def _collar_top(R):
    """The top of the helmet's seal ring, on the shoulders: the shell's top plus a little; the helmet sits in it."""
    return R.T["torso"][-1][0].z + 0.065 + 0.03


def _catmull(pts, n):
    """n points along a Catmull-Rom curve through pts (ends repeated)."""
    q = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(q) - 2):
        p0, p1, p2, p3 = q[i - 1], q[i], q[i + 1], q[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t))
    return out + [pts[-1]]


def _hose(bs, R, start, sx):
    """A ribbed hose from the chest unit's side, down round the waist, up into the bottom of the pack: short tubes along
    a smooth curve, alternating between the two builds (dark hose, lighter ribs)."""
    def outside(z, fy, out=0.0):
        c, hx, hy, _ = min(R.T["torso"], key=lambda r: abs(r[0].z - z))
        return Vector((sx * (hx + 0.065 + HOSE + 0.008 + out), c.y + fy * (hy + 0.065 + HOSE + 0.012), z))
    z = R.chest.z
    front = outside(z - 0.22, -1.0, 0.0)
    front.x = sx * 0.11                                                      # a sag across the belly, clear of the arms
    pts = [start, front, outside(z - 0.2, -0.45, -0.01), outside(z - 0.18, 0.4, -0.01),
           outside(z - 0.06, 1.0, -0.06) + Vector((0, 0.02, 0))]
    curve = _catmull(pts, 5)
    for k, (a, b) in enumerate(zip(curve, curve[1:])):
        wt = blend("spine_02", "spine_03", min(1.0, max(0.0, ((a.z + b.z) / 2 - (z - 0.2)) / 0.2)))
        bs[k % 2].tube(a, b, HOSE * (1.15 if k % 2 else 1.0), HOSE * (1.15 if k % 2 else 1.0), wt)


def _torso(A, R):
    b, unit, ring = Build(), Build(), Build()
    lo, waist = R.hips.z - 0.12, R.hips.z + 0.1
    torso(b, R, grow=0.065, lo=lo, cuts=(waist - 0.025, waist + 0.025))
    nc = R.neck
    top = _collar_top(R)
    cy = (nc.y + R.head_c.y) / 2
    ring.tube(Vector((0, cy, top - 0.1)), Vector((0, cy, top)), COLLAR[0], COLLAR[0], W("neck_01"),
              ra2=COLLAR[1], rb2=COLLAR[1], up=(0, 1, 0), exp=2.4, round_ends=False)      # collar seal ring
    c, hx, hy, _ = min(R.T["torso"], key=lambda r: abs(r[0].z - (R.chest.z - 0.02)))
    uc = Vector((0, c.y - hy - 0.095, c.z))
    unit.blob(uc, 0.085, 0.035, 0.055, W("spine_03"), exp=3.2, nlat=6)                          # chest control unit
    hoses = [Build(), Build()]
    for sx in (1, -1):
        _hose(hoses, R, uc + Vector((sx * 0.075, 0.015, -0.03)), sx)

    def shell(p, n):
        if abs(p.z - waist) < 0.025:
            return "gm"                                                      # the waist bearing
        if n.y < -0.3 and abs(p.x) < 0.13 and R.chest.z - 0.12 < p.z < R.chest.z + 0.1:
            return "team.cloth"                                              # the chest panel
        return SHELL

    def ctrl(p, n):
        if n.y < -0.7:
            dx = p.x - uc.x
            if p.z > uc.z + 0.01 and abs(dx) < 0.05:
                return "cyan" if dx < 0 else "red"                           # two status lights
            if p.z < uc.z - 0.005 and abs(dx) > 0.015:
                return "plate"                                               # two dials
        return "gmD"
    return Item("torso", "eva", [b.mesh("v2.eva.torso", A, shell), unit.mesh("v2.eva.unit", A, ctrl),
                                 ring.mesh("v2.eva.collar", A, lambda p, n: "gm" if p.z > top - 0.05 else "gmD"),
                                 hoses[0].mesh("v2.eva.hose", A, lambda p, n: "gmD"),
                                 hoses[1].mesh("v2.eva.hose.ribs", A, lambda p, n: "gm")])


def _legs(A, R):
    b = Build()
    for s in "LR":
        leg(b, R, s, grow=0.05, boot=0.035)
        c, e1, e2, r1, r2 = R.T["limb"][f"shin.{s}"][0]                       # the knee
        b.blob(Vector((c.x, c.y - max(r1, r2) - 0.06, c.z - 0.02)), 0.065, 0.035, 0.07,
               blend(f"leg.{s}", f"shin.{s}", 0.6), exp=2.6, nlat=6)          # knee pad
    kz, tz = R.t["leg.L"].z, R.h["leg.L"].z - 0.13

    def col(p, n):
        if p.z < 0.04:
            return "gm"                                                      # sole
        if p.z < 0.19:
            return "gmD"                                                     # boot
        if p.z < 0.22:
            return "gm"                                                      # boot cuff
        if abs(p.z - kz) < 0.1 and n.y < -0.5 and p.y < -0.05:
            return "gm"                                                      # the knee pad
        if 0.07 < p.z - kz < 0.11:
            return "team.cloth"                                              # a band above the knee
        if abs(p.z - tz) < 0.018:
            return "gm"                                                      # thigh bearing
        return SHELL
    return Item("legs", "eva", [b.mesh("v2.eva.legs", A, col)])


def _arm(A, R, s, cyber=False):
    b, g = Build(), Build()
    sh, el, wr = (abs(R.h[f"{x}.{s}"].x) for x in ("arm", "forearm", "hand"))
    if cyber:
        n = len(R.T["limb"][f"arm.{s}"])
        chain(b, R, [f"arm.{s}", f"forearm.{s}"], 0.045, t1=(n - 1.5) / (n + len(R.T["limb"][f"forearm.{s}"]) - 2))
    else:
        arm(b, R, s, grow=0.045, hand=False)
        chain(g, R, [f"hand.{s}"], 0.024)                                    # the glove, slimmer than the sleeve
        fingers(g, R, s, 0.008)
    band = sh + (el - sh) * 0.5

    def col(p, n):
        t = abs(p.x)
        if t > wr - 0.045:
            return "gmD"                                                     # wrist bearing
        if abs(t - el) < 0.03:
            return "gm"                                                      # elbow joint
        if abs(t - band) < 0.03:
            return "team.cloth"                                              # upper-arm band
        return SHELL
    objs = [b.mesh(f"v2.eva.arm.{s}", A, col)]
    if not cyber:
        objs.append(g.mesh(f"v2.eva.glove.{s}", A, lambda p, n: "gm"))
    return objs


def _helmet(A, R):
    dome, visor, rim, parts = Build(), Build(), Build(), Build()
    w = W("head")
    c = R.head_c + Vector((0, 0.01, 0.02))
    hx, hz = R.HX + 0.085, R.HZ + 0.075
    hy = max(R.HY + 0.085, c.y - R.front + 0.06)                            # clears the nose
    base = _collar_top(R) - 0.015
    dome.blob(c, hx, hy, hz, w, exp=2.2, nlat=12, keep=lambda p: p.z > base)   # the bubble, sitting in the collar
    vz = c.z - 0.01
    visor.blob(c, hx + 0.012, hy + 0.012, hz + 0.012, w, exp=2.2, nlat=12,
               keep=lambda p: p.y < c.y - hy * 0.2 and abs(p.z - vz) < hz * 0.52 and p.z > base)   # round the front
    rim.blob(c, hx + 0.006, hy + 0.006, hz + 0.006, w, exp=2.2, nlat=12,
             keep=lambda p: p.y < c.y - hy * 0.1 and abs(p.z - vz) < hz * 0.62 and p.z > base)   # its frame
    for sx in (1, -1):
        parts.blob(c + Vector((sx * (hx + 0.008), 0.0, -0.015)), 0.022, 0.055, 0.055, w, exp=2.6, nlat=6)   # ear pucks
    d = Vector((-0.72, -0.42, 0.45))                                         # the lamp: on the shell's surface (the
    k = (abs(d.x) ** 2.2 + abs(d.y) ** 2.2 + abs(d.z) ** 2.2) ** (-1 / 2.2)   # superellipsoid along d), over the right
    lamp = c + Vector((d.x * hx, d.y * hy, d.z * hz)) * k + Vector((-0.012, -0.01, 0.006))   # temple, facing forward
    lamps = Build()
    lamps.tube(lamp + Vector((0, 0.03, 0)), lamp - Vector((0, 0.035, 0)), 0.026, 0.03, w, up=(0, 0, 1))

    def glass(p, n):
        return "cyan" if p.z > vz + hz * 0.47 else "brass"                   # the HUD line along the visor top

    def part(p, n):
        if abs(p.x) > hx * 0.9:
            return "team.cloth"
        return "gm"
    objs = [dome.mesh("v2.eva.helmet", A, lambda p, n: SHELL), visor.mesh("v2.eva.visor", A, glass),
            rim.mesh("v2.eva.visor_rim", A, lambda p, n: "gm"),
            parts.mesh("v2.eva.helmet.parts", A, part),
            lamps.mesh("v2.eva.lamp", A, lambda p, n: "lampY" if n.y < -0.6 and p.y < lamp.y - 0.03 else "gm")]
    return Item("gear.head", "eva_helmet", objs, glow=True)


def _scale_pack(it):
    """The pack (and its thrust puffs) scaled by PACK about the top of its front face, so it grows out from the back and
    down: a taller top would sit behind the helmet, which is drawn over it."""
    cos = [[v.co.copy() for v in ob.data.vertices] for ob in it.objs]
    allc = [c for cs in cos for c in cs]
    lo = Vector(tuple(min(c[i] for c in allc) for i in range(3)))
    hi = Vector(tuple(max(c[i] for c in allc) for i in range(3)))
    anchor = Vector(((lo.x + hi.x) / 2, lo.y, hi.z))
    for ob, cs in zip(it.objs, cos):
        for v, c in zip(ob.data.vertices, cs):
            v.co = anchor + (c - anchor) * PACK
        ob.data.update()


def build(A, R, old):
    """The suit items: the old pack as it is, the cyber sleeve's forearm kept, everything else rebuilt on v2."""
    out = []
    for it in old:
        new = None
        if (it.slot, it.name) == ("torso", "eva"):
            new = _torso(A, R)
        elif (it.slot, it.name) == ("legs", "eva"):
            new = _legs(A, R)
        elif it.name == "eva" and it.slot.startswith("arm."):
            new = Item(it.slot, "eva", _arm(A, R, it.slot[-1]))
        elif it.name == "eva_helmet":
            new = _helmet(A, R)
        elif it.name == "eva_cyber":
            for ob in [o for o in it.objs if not o.name.startswith("gear.")]:   # the cloned sleeve (the rigid forearm
                it.objs.remove(ob)                                           # pieces are gear.*)
                bpy.data.objects.remove(ob, do_unlink=True)
            it.objs[:0] = _arm(A, R, it.slot[-1], cyber=True)
        if it.name == "eva_pack":
            _scale_pack(it)
        if new is None:
            out.append(it)
            continue
        new.glow = it.glow or new.glow
        for ob in it.objs:
            bpy.data.objects.remove(ob, do_unlink=True)
        out.append(new)
    return out
