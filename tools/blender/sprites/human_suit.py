"""EVA spacesuit layers for the human: suit pieces in the existing slots, so they work in every clip and direction.

  torso.eva            the suit body (torso, neck and belt line cut from the base mesh, pushed well out and broadened),
                       a chest control unit, a collar seal ring for the helmet
  legs.eva             suit legs over the base legs, knee bands, chunky boots
  arm.L.eva, arm.R.eva suit sleeves round the arm axis, cuffs and gloves
  arm.L.eva_cyber      the engineer's suited cyber arm: the sleeve stops at a sealed elbow ring and the gunmetal forearm and
                       hand stay out, with their one cyan strip
  gear.head.eva_helmet a rounded helmet with a visor (glass, a faint HUD line glowing along its top); hair and eyes are
                       skipped by the runtime while it is worn
  gear.back.eva_pack   life-support pack: two tanks in a frame, two thruster nozzles, a cyan and a red pack light; puffs
                       of thrust show only in the eva_float clip (glow sheet)
Suit colours are the palette-swap keys (team.cloth body, team.accent bands and panels), gunmetal joints and gloves.

eva_float (float_pose): drifting in vacuum, lifted off the floor, body tilted forward, legs trailing, arms a little out,
a slow bob; the nozzles puff alternately."""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from . import human_base as hb
from . import human_sit as hs
from .human_base import Item, Z, paint
from .rigid import RigidSet

ARM_AXIS = (0.07, 1.323)     # (y, z) of the arm axis in the rest pose (arms lie along x)
PUFF = "eva_puff"            # custom property on the thrust puff objects: nozzle index


def _clone(src, name, keep, push, subdiv=0):
    """Copy of src keeping the faces in keep, every vertex moved by push(co) -> new co."""
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    if subdiv:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for v in bm.verts:
        v.co = push(v.co.copy())
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def _body_push(off, widen):
    def push(c):
        ctr = Vector((0.0, 0.02, c.z))
        r = Vector((c.x - ctr.x, c.y - ctr.y, 0.0))
        if r.length > 1e-6:
            c += r.normalized() * off
        k = np.clip((c.z - Z(0.95)) / (Z(1.35) - Z(0.95)), 0.0, 1.0)
        c.x *= 1.0 + widen * k
        return c
    return push


def _leg_push(off):
    def push(c):
        ctr = Vector((0.114 * np.sign(c.x), 0.036, c.z))
        r = Vector((c.x - ctr.x, c.y - ctr.y, 0.0))
        if r.length > 1e-6:
            c += r.normalized() * off
        return c
    return push


def _arm_push(off):
    def push(c):
        r = Vector((0.0, c.y - ARM_AXIS[0], c.z - ARM_AXIS[1]))
        if r.length > 1e-6:
            c += r.normalized() * off
        return c
    return push


SHELL = "medWhite"           # the suit's hard white shell; faction colour (team.*) on panels and bands


def _torso_col(c):
    if Z(0.92) < c.z < Z(1.0):
        return "gm"                                                         # waist bearing ring
    if c.y < 0 and abs(c.x) < 0.13 and Z(1.12) < c.z < Z(1.3):
        return "team.cloth"                                                 # chest panel
    if abs(c.x) > 0.24 and c.z > Z(1.3):
        return "gm"                                                         # shoulder bearing rings
    return SHELL


def _legs_col(c):
    if c.z < Z(0.05):
        return "sole"
    if c.z < Z(0.24):
        return "gmD"                                                        # boots
    if Z(0.44) < c.z < Z(0.53):
        return "team.cloth"                                                 # knee bands
    if Z(0.8) < c.z < Z(0.85):
        return "gm"                                                         # thigh bearing rings
    return SHELL


def _arm_col(c):
    ax = abs(c.x)
    if ax > 0.72:
        return "gm"                                                         # glove
    if ax > 0.67:
        return "gmD"                                                        # wrist bearing ring
    if 0.47 < ax < 0.53:
        return "gm"                                                         # elbow joint
    if 0.34 < ax < 0.41:
        return "team.cloth"                                                 # upper-arm band
    return SHELL


def _rigid(arm, slot, name, build, **kw):
    rs = RigidSet(arm)
    build(rs)
    return Item(slot, name, rs.build(), **kw)


def _cyber_forearm(rs, s, sx):
    f = rs.on(f"forearm.{s}")
    f.box((sx * 0.5, 0.07, 1.323), (0.05, 0.15, 0.15), "team.accent", bevel=0.02)          # sealed elbow ring
    f.box((sx * 0.61, 0.07, 1.323), (0.2, 0.1, 0.1), "gm", bevel=0.02)
    f.box((sx * 0.61, 0.07, 1.375), (0.15, 0.062, 0.016), "plate", bevel=0.006)
    f.box((sx * 0.595, 0.0, 1.323), (0.12, 0.012, 0.022), "cyan")
    f.box((sx * 0.715, 0.07, 1.323), (0.016, 0.108, 0.108), "cyan")
    h = rs.on(f"hand.{s}")
    h.box((sx * 0.785, 0.062, 1.32), (0.085, 0.09, 0.075), "gmD", bevel=0.012)
    h.box((sx * 0.845, 0.06, 1.31), (0.05, 0.075, 0.04), "gm", bevel=0.008)


def build_suit(arm, body):
    """Suit items cut from the base body (call before human_base.build_skinned strips the arms off it)."""
    R = hb.Regions(body)
    items = []

    def mk(slot, name, sel, push, fn, sd=0, **kw):
        ob = _clone(body, f"{slot}.{name}", R.ids(sel), push, sd)
        paint(ob, lambda c, i: fn(c))
        it = Item(slot, name, [ob], **kw)
        items.append(it)
        return it

    torso = mk("torso", "eva", ~R.arms & ~R.head & ~R.legs, _body_push(0.075, 0.12), _torso_col, 2)
    legs = mk("legs", "eva", R.legs & (R.z > 0.14), _leg_push(0.05), _legs_col, 1)   # the feet are the rigid boots
    for side, sx in (("L", 1), ("R", -1)):
        mk(f"arm.{side}", "eva", R.arms & (np.sign(R.x) == sx), _arm_push(0.045), _arm_col, 1)
    sleeve = mk("arm.L", "eva_cyber", R.arms & (R.x > 0) & (R.x < 0.5), _arm_push(0.045), _arm_col, 1, glow=True)
    rs = RigidSet(arm)
    _cyber_forearm(rs, "L", 1)
    sleeve.objs += rs.build()

    rs = RigidSet(arm)                                                      # torso extras
    sp = rs.on("spine_03")
    sp.box((0, -0.175, 1.2), (0.17, 0.06, 0.11), "gmD", bevel=0.012)                       # chest control unit
    sp.box((-0.04, -0.207, 1.215), (0.04, 0.012, 0.03), "plate")
    sp.box((0.04, -0.207, 1.215), (0.04, 0.012, 0.03), "plate")
    sp.cyl((0, 0.01, 1.42), 0.15, 0.06, "gm", sides=12)                                      # collar seal ring
    torso.objs += rs.build()
    rs = RigidSet(arm)                                                      # boots: a cuff on the shin round the
    for s, sx in (("L", 1), ("R", -1)):                                     # ankle, the boot itself on the foot bone
        sh = rs.on(f"shin.{s}")                                             # (it turns with the foot), enclosing the
        sh.box((sx * 0.115, 0.09, 0.19), (0.2, 0.21, 0.16), "gmD", bevel=0.03)          # base foot it hides
        sh.box((sx * 0.115, 0.09, 0.27), (0.21, 0.22, 0.03), "gm", bevel=0.01)
        ft, to = rs.on(f"foot.{s}"), rs.on(f"toe.{s}")                     # the toe cap on the toe bone: the boot
        ft.box((sx * 0.135, 0.065, 0.08), (0.17, 0.26, 0.15), "gmD", bevel=0.035)      # bends at the ball of the
        ft.box((sx * 0.135, 0.065, 0.015), (0.18, 0.27, 0.03), "gm", bevel=0.01)       # foot when it pushes off;
        to.box((sx * 0.135, -0.12, 0.05), (0.16, 0.13, 0.09), "gmD", bevel=0.035)      # a mid-grey sole, not the
        to.box((sx * 0.135, -0.12, 0.015), (0.17, 0.14, 0.03), "gm", bevel=0.01)       # light one: a back-swing
                                                                                        # shows it whole
    legs.objs += rs.build()

    def helmet(rs):
        h = rs.on("head")
        h.box((0, 0.005, 1.585), (0.33, 0.34, 0.34), SHELL, bevel=0.15)                       # shell
        h.box((0, -0.15, 1.565), (0.25, 0.06, 0.17), "brass", bevel=0.05)                     # gold visor
        h.box((0, -0.178, 1.635), (0.16, 0.012, 0.012), "cyan")                               # HUD line (faint glow)
        for sx in (-1, 1):
            h.box((sx * 0.165, 0.0, 1.57), (0.03, 0.09, 0.09), "team.cloth", bevel=0.012)     # ear pucks
        h.box((-0.13, -0.08, 1.68), (0.05, 0.07, 0.04), "gm", bevel=0.01)                     # helmet lamp
        h.box((-0.13, -0.118, 1.68), (0.035, 0.01, 0.025), "lens")
    items.append(_rigid(arm, "gear.head", "eva_helmet", helmet, glow=True))

    def pack(rs):
        sp = rs.on("spine_03")
        sp.box((0, 0.21, 1.2), (0.34, 0.17, 0.44), SHELL, bevel=0.04)                         # hard-shell pack
        sp.box((0, 0.297, 1.2), (0.3, 0.012, 0.012), "gm")                                    # panel seams
        sp.box((0, 0.297, 1.06), (0.012, 0.012, 0.24), "gm")
        sp.box((0, 0.298, 1.28), (0.3, 0.012, 0.05), "team.cloth")                            # faction band
        for k in range(3):                                                                     # vent grille
            sp.box((0.09, 0.297, 1.05 + k * 0.045), (0.1, 0.012, 0.018), "dark")
        sp.box((-0.09, 0.297, 1.36), (0.03, 0.012, 0.03), "cyan")                             # pack lights
        sp.box((-0.04, 0.297, 1.36), (0.03, 0.012, 0.03), "red")
        for sx in (-1, 1):                                                                     # corner thruster quads
            for z in (1.0, 1.4):
                sp.box((sx * 0.18, 0.25, z), (0.04, 0.06, 0.05), "gmD", bevel=0.008)
            sp.cyl((sx * 0.13, 0.2, 0.95), 0.035, 0.05, "steelD", sides=8)                   # main nozzles
    it = _rigid(arm, "gear.back", "eva_pack", pack, glow=True)
    for k, sx in enumerate((-1, 1)):
        rs = RigidSet(arm)
        rs.on("spine_03").cyl((sx * 0.13, 0.2, 0.83), 0.06, 0.13, "arc", sides=8, rtop=0.025)  # thrust puff
        for ob in rs.build():
            ob[PUFF] = k
            it.objs.append(ob)
    items.append(it)
    return items


def is_eva(item):
    return item.name.startswith("eva")


def float_pose(arm, i, scale, n=4):
    """eva_float frame i: lifted, tilted forward, legs trailing, arms a little out, a slow bob. Returns 0 (no breathing)."""
    arm.animation_data.action = None
    pb = arm.pose.bones
    ph = math.tau * i / n
    b = math.sin(ph)
    pb["root"].location = (0, 0, (0.2 + 0.025 * b) / scale)
    hs.bpy_update()
    lean = 0.34
    hs._aim(arm, "hips", hs._fwd(lean))
    hs._aim(arm, "spine", hs._fwd(lean))
    hs._aim(arm, "spine_02", hs._fwd(lean * 1.05))
    hs._aim(arm, "spine_03", hs._fwd(lean * 1.05))
    hs._aim(arm, "neck_01", hs._fwd(0.15))
    hs._aim(arm, "head", hs._fwd(-0.05))
    for s, n_ in ((1, "L"), (-1, "R")):
        k = math.sin(ph + (0.0 if s > 0 else math.pi)) * 0.06
        hs._aim(arm, f"leg.{n_}", Vector((s * 0.09, math.sin(0.5 + k), -math.cos(0.5 + k))))
        hs._aim(arm, f"shin.{n_}", Vector((s * 0.05, math.sin(0.95 + k), -math.cos(0.95 + k))))
        sway = math.sin(ph + (0.8 if s > 0 else 2.0)) * 0.05
        hs._aim(arm, f"arm.{n_}", Vector((s * 0.42, -0.22, -0.88 + sway)))
        hs._aim(arm, f"forearm.{n_}", Vector((s * 0.2, -0.62, -0.76 + sway)))
        hs._aim(arm, f"hand.{n_}", Vector((s * 0.15, -0.66, -0.74)))
    return 0.0


def puffs(i):
    """Nozzles puffing on eva_float frame i (alternating)."""
    return {i % 2}
