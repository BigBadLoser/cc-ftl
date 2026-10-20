"""Crew proportions for game size: ONE smooth map of the rest space. human_v2 moves the armature's rest bones with it (the
v2 body is then built on those bones); `apply` also reshapes finished item meshes (the first experiment, on the realistic
base). The clips (rotations, plus hip location) retarget as they are.

Readable at ~60 px: a big head (HEAD_K), short legs and torso, chunky arms and legs, oversized hands and feet, shoulders
pushed out and a slimmer waist so there is a gap between the arms and the torso. Rest space: z up, feet at 0, front = -y,
+x = character left, arms out horizontally (T-pose at ARM_Z). Pure numpy apart from `apply`."""
import numpy as np

HEAD_K = 1.3                       # head about the neck
LEG_Z, TORSO_Z = 0.80, 0.92        # height scale of the legs (below the hips) and the torso
ARM_LEN, ARM_K, HAND_K = 0.82, 1.3, 1.4
SHOULDER = 0.07                    # arms pushed outward: hanging arms clear the chest (a gap between arm and torso)
WAIST = 0.1                        # waist slimmed by this fraction
LEG_K, FOOT_K, FOOT_Z = 1.35, 1.15, 1.25   # feet: the leg thickening carries on into them, x FOOT_K on top
GROW = 1.04                        # whole figure, so it keeps about its old height in the frame
ARM_Y, ARM_Z = 0.07, 1.25          # T-pose arm axis (y, z)
LEG_X, LEG_Y = 0.114, 0.036        # leg axis
NECK = 1.36                        # head pivot height (rest)
WRIST = 0.73


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


_ZG = np.linspace(-0.5, 2.5, 3001)
_S = LEG_Z + (TORSO_Z - LEG_Z) * ss(0.82, 0.95, _ZG) + (1.0 - TORSO_Z) * ss(1.30, 1.38, _ZG)
_ZV = np.concatenate([[0.0], np.cumsum(_S[1:] * np.diff(_ZG))])
_ZV -= np.interp(0.0, _ZG, _ZV)


def zmap(z):
    """Height after the vertical squash (legs, torso), before the head scale and GROW."""
    return np.interp(z, _ZG, _ZV)


def shape(co, bones=False):
    """bones: skeleton points only get the lengths, heights, shoulder push and head (no thickening about limb axes, which
    would tilt the shins and arms)."""
    p = np.array(co, float).reshape(-1, 3)
    x, y, z = p[:, 0].copy(), p[:, 1].copy(), p[:, 2].copy()
    ax, side = np.abs(x), np.where(x >= 0, 1.0, -1.0)
    armz = ss(1.08, 1.15, z)                                   # weights from the ORIGINAL coordinates
    wa = ss(0.23, 0.28, ax) * armz                             # the arm proper starts past the chest edge (0.228)
    wh = ss(0.66, WRIST, ax) * armz
    wl = (1 - ss(0.85, 0.95, z)) * ss(0.0, 0.05, ax)
    wf = (1 - ss(0.10, 0.18, z)) * ss(0.02, 0.06, ax)
    wwaist = ss(0.86, 0.95, z) * (1 - ss(1.08, 1.16, z)) * (1 - ss(0.16, 0.22, ax))
    whead = ss(1.35, 1.42, z)                                  # from the chin up (the collar stays put)
    # arms: shorter, pushed out, thicker; hands bigger about the wrist
    ax2 = np.where(ax > 0.2, 0.2 + (ax - 0.2) * ARM_LEN, ax)
    ax2 = ax + (ax2 - ax) * armz + SHOULDER * ss(0.22, 0.27, ax) * armz
    if bones:
        wa = wl = wf = np.zeros_like(wa)
    k = 1 + (ARM_K - 1) * wa
    ya, za = ARM_Y + (y - ARM_Y) * k, ARM_Z + (z - ARM_Z) * k
    wx = 0.2 + (WRIST - 0.2) * ARM_LEN + SHOULDER
    kh = 1 + (HAND_K - 1) * wh
    ax2 = ax2 + (ax2 - wx) * (kh - 1)
    ya = ARM_Y + (ya - ARM_Y) * kh
    za = ARM_Z + (za - ARM_Z) * kh
    x = side * ax2
    y, z2 = ya, za
    # legs thicker about their axis, feet bigger
    kl = 1 + (LEG_K - 1) * wl
    x = x + (x - side * LEG_X) * (kl - 1)
    y = y + (y - LEG_Y) * (kl - 1)
    kf = 1 + (FOOT_K - 1) * wf
    x = x + (x - side * LEG_X) * (kf - 1)
    y = y + (y - 0.0) * (kf - 1)
    z2 = z2 * (1 + (FOOT_Z - 1) * wf)
    # slimmer waist
    x = x * (1 - WAIST * wwaist)
    # vertical squash, then the head about the neck
    z3 = zmap(z2)
    pz = zmap(NECK)
    kH = 1 + (HEAD_K - 1) * whead
    x = x * kH
    y = 0.02 + (y - 0.02) * kH
    z3 = pz + (z3 - pz) * kH
    out = np.stack([x, y, z3], -1) * GROW
    return out.reshape(np.shape(co))


def apply(arm, items):
    """Reshape every item mesh and the armature's rest bones (call with the armature in REST, before its scale)."""
    import bpy
    seen = set()
    for it in items:
        for ob in it.objs:
            if ob.name in seen or ob.type != "MESH":
                continue
            seen.add(ob.name)
            me = ob.data
            co = np.empty(len(me.vertices) * 3)
            me.vertices.foreach_get("co", co)
            me.vertices.foreach_set("co", shape(co.reshape(-1, 3)).ravel())
            me.update()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        h, t = shape(np.array([tuple(eb.head), tuple(eb.tail)]))
        eb.head, eb.tail = tuple(h), tuple(t)
    bpy.ops.object.mode_set(mode="OBJECT")
