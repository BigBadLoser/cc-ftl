"""Crew base v2 items (see human_v2): the body and the starter gear, in the existing slots and ids, and `build_items`, which
human_items uses in place of the old build when CREW_BASE is v2 (the default on this branch).

Colour roles as before: team.skin / team.hair / team.cloth / team.accent are the palette-swap keys; fixed parts use
plain palette colours. Flat colour regions with hard edges; nothing smaller than ~2 px."""
import bpy
from mathutils import Vector

from . import core
from . import crew_clips as clips
from . import human_render as hr
from . import human_trace
from .human_base import SCALE, Item, import_base
from .human_v2 import PUFF, SHELL, Build, Rig, W, arm, flat, head, leg, torso


def body(A, R):
    b = Build()
    head(b, R)
    hb = R.T["head"][0][0]                                                   # the neck: under the jaw, not behind it
    b.tube(Vector((0, R.neck.y - 0.02, R.neck.z - 0.02)), Vector((0, hb.y + 0.05, hb.z + 0.03)), 0.07, 0.065,
           W("neck_01"))
    torso(b, R)
    for s in "LR":
        leg(b, R, s)
    crotch = R.hips.z - 0.03
    col = lambda c, n: "boot" if c.z < 0.15 else "pants" if c.z < crotch else "team.skin"  # noqa: E731
    return Item("body", "", [b.mesh("v2.body", A, col)], default=True)


def eyes(A, R):
    b = Build()
    c = R.head_c
    for sx in (1, -1):                                         # two dark eyes, ~2 x 3 px: they show which way the head faces
        b.blob(Vector((sx * 0.048, R.front + 0.018, c.z + 0.0)), 0.022, 0.012, 0.028, W("head"), exp=2.4, nlat=6)
    return Item("eyes", "organic", [b.mesh("v2.eyes", A, flat("dark"))], default=True)


def flesh_arm(A, R, s):
    b = Build()
    arm(b, R, s)
    return Item(f"arm.{s}", "flesh", [b.mesh(f"v2.arm.{s}", A, flat("team.skin"))], default=True)


def tee(A, R):
    b = Build()
    torso(b, R, grow=0.02, lo=R.hips.z + 0.09)
    for s in "LR":
        arm(b, R, s, grow=0.022, upper=0.55, fore=False, hand=False)
    return Item("torso", "tee", [b.mesh("v2.tee", A, flat("team.cloth"))])


def work_shirt(A, R):
    """The hi-vis work vest, as on the old base: sleeveless (bare arms), a scoop neck at the front, a hi-vis band round the
    chest and hi-vis shoulder straps."""
    b = Build()
    nz, sz = R.neck.z, R.shoulder_z
    scoop = lambda c: not (c.z > nz - 0.04 and abs(c.x) < 0.1 and c.y < R.neck.y - 0.02)  # noqa: E731  front only
    torso(b, R, grow=0.016, lo=R.hips.z + 0.09, keep=scoop, cuts=(R.chest.z + 0.03, R.chest.z + 0.09, sz - 0.03))

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

    def col(c, n):
        if c.z < 0.17:
            return "boot"
        if c.z > top - 0.065:
            return "rust"                                                   # the waistband: a belt line under the hem
        if k0 < c.z < k1 and n.x * (1 if c.x > 0 else -1) > 0.55:
            return "pocket"
        return "pants"
    return Item("legs", "cargo_pants", [b.mesh("v2.cargo_pants", A, col)], default=True)


def _hair_cap(b, R, back=-0.15):
    c = R.head_c

    def keep(p):
        r = p - c
        return r.z > 0.045 or (r.y > 0.02 and r.z > back) or (r.y > -0.04 and r.z > -0.03 and abs(r.x) > R.HX - 0.02)
    head(b, R, grow=0.022, keep=keep)


def hair_short(A, R):
    b = Build()
    _hair_cap(b, R)
    return Item("hair", "short", [b.mesh("v2.hair.short", A, flat("team.hair"))], default=True)


def hair_ponytail(A, R):
    b = Build()
    _hair_cap(b, R, back=-0.13)
    c = R.head_c
    b.tube(c + Vector((0, R.HY + 0.02, 0.04)), c + Vector((0, R.HY + 0.1, -0.17)), 0.055, 0.04, W("head"))
    return Item("hair", "ponytail", [b.mesh("v2.hair.ponytail", A, flat("team.hair"))])


# ---- EVA suit ------------------------------------------------------------------------------------------------------

def eva_torso(A, R):
    b = Build()
    torso(b, R, grow=0.06)
    sz, cz = R.shoulder_z, R.chest.z
    b.tube(Vector((0, 0.03, sz + 0.04)), Vector((0, 0.03, sz + 0.11)), 0.19, 0.19, W("spine_03"), round_ends=False)  # collar
    b.blob(Vector((0, R.chest.y - 0.2, cz + 0.06)), 0.11, 0.04, 0.08, W("spine_03"), exp=3.0, nlat=6)        # control unit

    def col(c, n):
        if c.z > sz + 0.035 and abs(c.x) < 0.2:
            return "gm"
        if c.y < R.chest.y - 0.17 and abs(c.x) < 0.12 and cz - 0.03 < c.z < cz + 0.15:
            return "gmD"
        return "team.cloth" if cz - 0.1 < c.z < cz - 0.03 else SHELL
    return Item("torso", "eva", [b.mesh("v2.eva.torso", A, col)])


def eva_arm(A, R, s):
    b = Build()
    arm(b, R, s, grow=0.045, hand=False)
    arm(b, R, s, grow=0.03, upper=0.0, fore=False)                          # gloves, a size up from the hand
    sh = abs(R.h[f"arm.{s}"].x)
    wrist = abs(R.t[f"forearm.{s}"].x) - 0.02

    def col(c, n):
        if abs(c.x) > wrist:
            return "gmD"
        return "team.cloth" if sh + 0.14 < abs(c.x) < sh + 0.2 else SHELL
    return Item(f"arm.{s}", "eva", [b.mesh(f"v2.eva.arm.{s}", A, col)])


def eva_legs(A, R):
    b = Build()
    torso(b, R, grow=0.06, lo=R.hips.z - 0.11, hi=R.hips.z + 0.04)
    for s in "LR":
        leg(b, R, s, grow=0.045, boot=0.04)
    kz = R.t["leg.L"].z

    def col(c, n):
        if c.z < 0.21:
            return "gmD"
        return "team.cloth" if abs(c.z - kz) < 0.035 else SHELL
    return Item("legs", "eva", [b.mesh("v2.eva.legs", A, col)])


def eva_helmet(A, R):
    b = Build()
    head(b, R, grow=0.07)
    c = R.head_c
    for sx in (1, -1):                                                       # ear pucks
        b.blob(c + Vector((sx * (R.HX + 0.08), 0.0, -0.01)), 0.03, 0.07, 0.07, W("head"), exp=2.4, nlat=6)

    def col(c2, n):
        r = c2 - c
        if abs(r.x) > R.HX + 0.05:
            return "team.cloth"
        if n.y < -0.5 and -0.13 < r.z < 0.08:
            return "brass"                                                  # gold visor
        return SHELL
    return Item("gear.head", "eva_helmet", [b.mesh("v2.eva.helmet", A, col)], glow=True)


def eva_pack(A, R):
    b = Build()
    ch = R.chest
    c = Vector((0, ch.y + 0.27, ch.z + 0.03))
    b.blob(c, 0.21, 0.09, 0.23, W("spine_03"), exp=3.2)
    for sx in (1, -1):                                                       # nozzles
        b.tube(c + Vector((sx * 0.12, 0.0, -0.22)), c + Vector((sx * 0.12, 0.0, -0.3)), 0.04, 0.05, W("spine_03"))

    def col(p, n):
        if p.z < c.z - 0.22:
            return "steelD"
        if n.y > 0.5 and c.z + 0.1 < p.z < c.z + 0.16:
            return "team.cloth"                                             # faction band
        if n.y > 0.5 and c.z - 0.02 < p.z < c.z + 0.04 and 0.06 < p.x < 0.12:
            return "cyan"                                                   # pack light
        return SHELL
    objs = [b.mesh("v2.eva.pack", A, col)]
    for k, sx in enumerate((-1, 1)):                                         # thrust puffs (eva_float only)
        p = Build()
        p.tube(c + Vector((sx * 0.12, 0.0, -0.3)), c + Vector((sx * 0.12, 0.0, -0.46)), 0.05, 0.02, W("spine_03"))
        ob = p.mesh(f"v2.eva.puff.{k}", A, flat("arc"))
        ob[PUFF] = k
        objs.append(ob)
    return Item("gear.back", "eva_pack", objs, glow=True)


def build_items():
    core.setup_scene()
    A = import_base()
    T = human_trace.measure(A, bpy.data.objects["skin@body.team.skin"])   # trace the realistic base, then drop it
    for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(ob, do_unlink=True)
    R = Rig(A, T)
    items = [body(A, R), eyes(A, R), flesh_arm(A, R, "L"), flesh_arm(A, R, "R"), tee(A, R), work_shirt(A, R),
             cargo_pants(A, R), hair_short(A, R), hair_ponytail(A, R), eva_torso(A, R), eva_arm(A, R, "L"),
             eva_arm(A, R, "R"), eva_legs(A, R), eva_helmet(A, R), eva_pack(A, R)]
    for it in items:
        it.order = hr.ORDER[it.slot]
    for act in bpy.data.actions:       # we drive bone scale ourselves (torso width, breathing)
        for fc in [f for f in act.fcurves if f.data_path.endswith("scale")]:
            act.fcurves.remove(fc)
    clips.capture_idle_arms(A)
    A.rotation_mode = "XYZ"
    A.scale = (SCALE,) * 3
    A.data.pose_position = "POSE"
    items.sort(key=lambda i: (i.order, i.name))
    return A, items
