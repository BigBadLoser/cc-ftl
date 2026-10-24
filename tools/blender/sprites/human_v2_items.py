"""Crew base v2 items (see human_v2): the body and the starter gear, in the existing slots and ids, and `build_items`, which
human_items uses in place of the old build when CREW_BASE is v2 (the default on this branch).

Colour roles as before: team.skin / team.hair / team.cloth / team.accent are the palette-swap keys; fixed parts use
plain palette colours. Flat colour regions with hard edges; nothing smaller than ~2 px."""
import math

import bpy
from mathutils import Vector

from . import core
from . import crew_clips as clips
from . import human_render as hr
from . import human_base as hb
from . import human_gear as hg
from . import human_suit as suit
from . import human_trace
from .human_base import SCALE, Item, import_base
from .human_v2 import CREASE, Build, Rig, W, arm, flat, head, leg, torso


def body(A, R):
    b = Build()
    head(b, R)
    hb = R.T["head"][0][0]                                                   # the neck: under the jaw, not behind it
    b.tube(Vector((0, R.neck.y - 0.02, R.neck.z - 0.02)), Vector((0, hb.y + 0.05, hb.z + 0.03)), 0.07, 0.065,
           W("neck_01"))
    torso(b, R)
    for s in "LR":
        leg(b, R, s)
    waist = R.hips.z + 0.12                                                  # shorts to the belt line: a gap between
    col = lambda c, n: "boot" if c.z < 0.15 else "pants" if c.z < waist else "team.skin"  # noqa: E731  # pieces shows dark
    return Item("body", "", [b.mesh("v2.body", A, col)], default=True)


def eyes(A, R, cyber=False):
    """Two dark eyes and brows in the hair colour, a nose, a mouth line and ears. cyber: the right eye (x < 0) is a
    gunmetal implant with a cyan lens."""
    b, face = Build(), Build()
    c = R.head_c
    w = W("head")
    face.blob(Vector((0, R.front + 0.004, c.z - 0.035)), 0.017, 0.022, 0.032, w, exp=2.4, nlat=6)     # the nose
    mouth = c.z - 0.088
    face.blob(Vector((0, R.front + 0.01, mouth)), 0.03, 0.008, 0.008, w, exp=2.6, nlat=6)
    for sx in (1, -1):                                                       # the ears
        face.blob(Vector((sx * (R.HX + 0.004), c.y + 0.012, c.z - 0.012)), 0.018, 0.034, 0.044, w, exp=2.4, nlat=6)
    for sx in (1, -1):                                         # two dark eyes, ~2 x 3 px: they show which way the head faces
        if cyber and sx < 0:
            continue
        b.blob(Vector((sx * 0.048, R.front + 0.018, c.z + 0.0)), 0.022, 0.012, 0.028, W("head"), exp=2.4, nlat=6)
    brow = c.z + 0.048
    for sx in (1, -1):                                         # brows, in the hair colour, a little wider than the eyes
        b.blob(Vector((sx * 0.05, R.front + 0.014, brow)), 0.036, 0.013, 0.015, W("head"), exp=2.6, nlat=6)
    if cyber:
        eye = Vector((-0.048, R.front + 0.012, c.z))
        b.blob(eye, 0.032, 0.016, 0.034, W("head"), exp=3.0, nlat=6)
        b.blob(eye + Vector((0, -0.014, 0)), 0.018, 0.008, 0.018, W("head"), exp=2.4, nlat=6)

    def col(p, n):
        if p.z > brow - 0.02:
            return "team.hair"
        if cyber and p.x < -0.01:
            return "cyan" if p.y < R.front - 0.004 else "gmD"
        return "dark"
    sfx = ".cyber" if cyber else ""
    objs = [b.mesh("v2.eyes" + sfx, A, col),
            face.mesh("v2.face" + sfx, A, lambda p, n: "team.skin*0.5" if abs(p.z - mouth) < 0.012 else "team.skin")]
    return Item("eyes", "cyber" if cyber else "organic", objs, default=not cyber, glow=cyber)


def flesh_arm(A, R, s):
    """A bare arm, with a darker crease line in the crook of the elbow and round the wrist (shading, not shape: a pinch
    is too small to read at game size)."""
    b = Build()
    arm(b, R, s)
    ex, wx = abs(R.h[f"forearm.{s}"].x), abs(R.h[f"hand.{s}"].x)

    def col(c, n):
        if abs(abs(c.x) - ex) < CREASE and n.y < -0.2 or abs(abs(c.x) - wx) < CREASE:
            return "team.skin*0.5"
        return "team.skin"
    return Item(f"arm.{s}", "flesh", [b.mesh(f"v2.arm.{s}", A, col)], default=True)


def tee(A, R):
    """A plain sleeveless tee in the team colour. No sleeves: the arm layers draw over the torso layer (so an arm can
    swing in front of the body), which would always hide a torso-layer sleeve under the bare arm."""
    b = Build()
    nz = R.neck.z
    lo = R.hips.z + 0.09
    torso(b, R, grow=0.02, lo=lo, cuts=(lo + 0.03, nz - 0.045))          # closed at the top: the neck cuts a clean
                                                                             # round collar (a cut-out neck shows ragged)
    arm_x, bz = R.h["arm.L"].x - 0.02, R.chest.z + 0.06

    def col(c, n):                                                           # collar, hem and armholes a shade darker
        if c.z > nz - 0.03 and math.hypot(c.x, c.y - R.neck.y) < 0.12 or c.z < lo + 0.03 or \
                abs(c.x) > arm_x and c.z > R.chest.z:
            return "team.cloth*0.7"
        if n.y < -0.5 and 0.05 < c.x < 0.1 and abs(c.z - bz) < 0.025:
            return "team.accent"                                             # a crew badge on the left chest
        return "team.cloth"
    return Item("torso", "tee", [b.mesh("v2.tee", A, col)])


def work_shirt(A, R):
    """The hi-vis work vest, as on the old base: sleeveless (bare arms), a hi-vis band round the chest and hi-vis
    shoulder straps."""
    b = Build()
    sz = R.shoulder_z
    torso(b, R, grow=0.016, lo=R.hips.z + 0.09, cuts=(R.chest.z + 0.03, R.chest.z + 0.09, sz - 0.03))   # closed top
                                                                             # (the neck cuts a clean collar, see tee)

    def col(c, n):
        if R.chest.z + 0.03 < c.z < R.chest.z + 0.09:
            return "hivis"
        if c.z > sz - 0.03 and 0.07 < abs(c.x) < 0.14:
            return "hivis"
        return "team.cloth"
    return Item("torso", "work_shirt", [b.mesh("v2.work_shirt", A, col)], default=True)


def cargo_pants(A, R):
    """Pants with a dark waistband, a big pocket on each thigh, chunky boots."""
    b = Build()
    top = R.hips.z + 0.11
    torso(b, R, grow=0.018, lo=R.hips.z - 0.11, hi=top, cuts=(top - 0.075, top - 0.065))
    for s in "LR":
        leg(b, R, s, grow=0.018, boot=0.02)
    k0, k1 = R.t["leg.L"].z + 0.06, R.h["leg.L"].z - 0.1
    kz = R.t["leg.L"].z
    fx, fy = abs(R.h["foot.L"].x), R.h["foot.L"].y

    def col(c, n):
        if c.z < 0.035:
            return "steelD"                                                 # a dark sole edge
        if c.z < 0.17:
            if abs(abs(c.x) - fx) < 0.026 and c.y < fy and c.z > 0.05 and (n.z > 0.35 or n.y < -0.45):
                return "steelD"                                             # the laces, up the instep and the ankle
            if c.z < 0.075 and n.y < -0.3:
                return "sole"                                               # the toe cap
            return "boot"
        if c.z < 0.2:
            return "steelD"                                                 # the cuff over the boot
        if abs(c.z - kz) < CREASE:
            return "steelD"                                                 # a crease line round the knee
        if c.z > top - 0.065:
            return "rust"                                                   # the waistband: a belt line under the hem
        if k0 < c.z < k1 and n.x * (1 if c.x > 0 else -1) > 0.55:
            return "steelD" if c.z > k1 - 0.04 else "pocket"               # the pocket and its flap
        return "pants"
    return Item("legs", "cargo_pants", [b.mesh("v2.cargo_pants", A, col)], default=True)


HAIR_GROW, HAIR_FRONT, HAIR_SIDE = 0.01, 0.095, 0.02     # a close cap; hairline height at the front and the sides


def _hair_cap(b, R, back=-0.15, grow=HAIR_GROW):
    """The hair as the head grown a little, kept above one smooth hairline: HAIR_FRONT over the forehead, a little higher
    at the temples, easing down to HAIR_SIDE over the ears and to `back` at the nape (no step at the temples)."""
    c = R.head_c
    ss = lambda e0, e1, t: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, (t - e0) / (e1 - e0))))  # noqa: E731

    def keep(p):
        r = p - c
        t = (r.y + R.HY) / (2 * R.HY)                                        # 0 at the face, 1 at the back
        line = HAIR_FRONT + 0.03 * min(1.0, abs(r.x) / R.HX) ** 2
        line += (HAIR_SIDE - line) * ss(0.1, 0.45, t)
        line += (back - line) * ss(0.55, 0.85, t)
        return r.z > line
    head(b, R, grow=grow, keep=keep)


def _strands(p, n):
    """Hair colour with darker strands running front to back on the upper surfaces."""
    return "team.hair*0.6" if n.z > 0.2 and int((p.x + 1.0) / 0.026) % 2 else "team.hair"


def _fringe(b, R):
    c = R.head_c
    for x, dz in ((-0.065, 0.004), (-0.022, -0.002), (0.02, 0.0), (0.062, 0.005)):    # on the hairline (its curve),
        z = c.z + HAIR_FRONT + 0.03 * (abs(x) / R.HX) ** 2 + 0.016 + dz        # not jutting out of it: 2 px of brow
        b.blob(Vector((x, R.front + 0.022, z)), 0.028, 0.016, 0.02, W("head"), exp=2.2, nlat=6)   # clear below


def hair_short(A, R):
    b = Build()
    _hair_cap(b, R)
    _fringe(b, R)
    return Item("hair", "short", [b.mesh("v2.hair.short", A, _strands)], default=True)


def hair_ponytail(A, R):
    b = Build()
    _hair_cap(b, R, back=-0.13)
    c = R.head_c
    b.tube(c + Vector((0, R.HY + 0.02, 0.04)), c + Vector((0, R.HY + 0.1, -0.17)), 0.055, 0.04, W("head"))
    return Item("hair", "ponytail", [b.mesh("v2.hair.ponytail", A, flat("team.hair"))])


def hair_shaved(A, R):
    b = Build()
    _hair_cap(b, R, grow=0.004)
    return Item("hair", "shaved", [b.mesh("v2.hair.shaved", A, flat("team.hair*0.55"))])


def tool_belt(A, R):
    """A leather band round the waist over the shirt hem; the buckle and pouches are the old ones (human_gear)."""
    b = Build()
    torso(b, R, grow=0.04, lo=R.hips.z + 0.035, hi=R.hips.z + 0.1)
    it = Item("gear.belt", "tool_belt", [b.mesh("v2.tool_belt", A, flat("leather"))], default=True)
    hg.belt_extra(A, it)
    return it


def _to_v2_head(items, R):
    """Rigid head gear is modelled on the old head: carry it onto the v2 head (human_trace.oval: narrower, and taller up
    from the chin)."""
    z0 = R.T["head"][0][0].z
    for it in items:
        for ob in it.objs:
            if ob.name.startswith("gear.head"):
                for v in ob.data.vertices:
                    v.co.x *= human_trace.HEAD_W
                    v.co.z = z0 + (v.co.z - z0) * human_trace.HEAD_H
                ob.data.update()


CYBER_K = {"arm": 1.1, "forearm": 1.1, "hand": 1.0}                   # cyber arm thickness, to match the v2 flesh arm


def _cyber_bulk(items, A):
    """The old cyber arm matched the old (thinner) arm: thicken it about each bone's line like the v2 arm."""
    B = A.data.bones
    for it in items:
        for ob in it.objs:
            part, _, rest = ob.name[len("gear."):].partition(".")
            if not ob.name.startswith("gear.") or part not in CYBER_K:
                continue
            bone = B[f"{part}.{rest[0]}"]
            h, t = bone.head_local, bone.tail_local
            ax = (t - h).normalized()
            for v in ob.data.vertices:
                d = v.co - h
                on = h + ax * d.dot(ax)
                v.co = on + (v.co - on) * CYBER_K[part]
            ob.data.update()


def build_items():
    from . import human_v2_armor, human_v2_eva, human_v2_kits, human_v2_weapons
    core.setup_scene()
    A = import_base()
    src = bpy.data.objects["skin@body.team.skin"]
    T = human_trace.measure(A, src)                                          # trace the realistic base, then drop it
    eva = suit.build_suit(A, src)                                           # the old suit: its pack and cyber forearm
    keep = {ob.name for it in eva for ob in it.objs}
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and o.name not in keep]:
        bpy.data.objects.remove(ob, do_unlink=True)
    R = Rig(A, T)
    eva = human_v2_eva.build(A, R, eva)                                      # the suit rebuilt on the v2 body
    gear = [hg.hair_mohawk(A), hg.jack(A), hg.goggles(A), hg.engineer_rig(A), hg.cyber_arm(A, "L"),
            hg.cyber_arm(A, "R")]                                            # the old rigid gear (same rig)
    belt = tool_belt(A, R)
    items = [body(A, R), eyes(A, R), eyes(A, R, cyber=True), flesh_arm(A, R, "L"), flesh_arm(A, R, "R"), tee(A, R),
             work_shirt(A, R), cargo_pants(A, R), hair_short(A, R), hair_ponytail(A, R), hair_shaved(A, R),
             belt] + gear + eva + human_v2_kits.build(A, R) + human_v2_weapons.build(A, R) + human_v2_armor.build(A, R)
    for it in items:
        it.order = hr.ORDER[it.slot]
    for act in bpy.data.actions:       # we drive bone scale ourselves (torso width, breathing)
        for fc in [f for f in act.fcurves if f.data_path.endswith("scale")]:
            act.fcurves.remove(fc)
    for it in eva + gear + [belt]:
        for ob in it.objs:
            ob.parent = A
    clips.capture_idle_arms(A)
    hb.warp_gear(eva + gear + [belt])                                        # rigid parts, as the old build
    _to_v2_head(gear, R)
    _cyber_bulk(gear, A)
    A.rotation_mode = "XYZ"
    A.scale = (SCALE,) * 3
    A.data.pose_position = "POSE"
    items.sort(key=lambda i: (i.order, i.name))
    return A, items
