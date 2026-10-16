"""Mesh-level stylisation of the CC0 base for pixel-art readability (used by base_import.py --stylize / --upright, and by
the sprite pipeline to carry rigid gear and region thresholds along).

Levels
  c  proportions baked into the mesh and the rest bones: bigger head (HEAD_K), broader shoulders, shorter legs, thicker
     limbs, chunkier hands and boots, lightly smoothed head detail (ears, nose)
  d  c + a simplified head shape: rounder skull, defined jaw, flatter face planes (clean eye area)

`proportion(co, level)` is ONE smooth map of the rest space (fit space: z up, feet at 0, front = -y, +x = character
left). base_import applies it to the mesh and to every rest bone (so the rig stays consistent); the pipeline applies it
to rigid gear built against the unstyled base (`warp_gear`) and maps height thresholds with `zmap`. `head_shape` is mesh
only. Pure numpy apart from the bpy helpers, which import bpy lazily."""
import numpy as np

LEVELS = {"c", "d"}
HEAD_K = 1.25
HEAD_PIVOT = (0.0, 0.02, 1.43)
SHOULDER_GAIN, SHOULDER_CAP = 0.14, 0.22     # x shift = gain * min(|x|, cap), weighted by height
LEG_SHORTEN, LEG_BLEND = 0.07, (0.80, 0.95)  # leg scale 1-LEG_SHORTEN below the blend band
LEG_THICK, ARM_THICK, HAND_K, BOOT_K = 0.12, 0.15, 1.2, 0.22
ARM_AXIS = (0.068, 1.323)                    # y, z of the T-pose arm axis
LEG_AXIS = (0.114, 0.036)
BOOT_AXIS = (0.114, -0.04)


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


_ZG = np.linspace(-0.5, 2.5, 3001)
_ZV = np.concatenate([[0.0], np.cumsum((1 - LEG_SHORTEN * (1 - ss(*LEG_BLEND, _ZG[1:])) ) * np.diff(_ZG))])
_ZV = _ZV - np.interp(0.0, _ZG, _ZV)


def _legs_z(z):
    return np.interp(z, _ZG, _ZV)


def proportion(co, level="c"):
    p = np.array(co, float).reshape(-1, 3).copy()
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    ax = np.abs(x)
    side = np.where(x >= 0, 1.0, -1.0)
    # thicker legs (faded out at the centre plane so the crotch does not tear)
    k = 1 + LEG_THICK * (1 - ss(0.80, 0.95, z)) * ss(0.0, 0.05, ax)
    x = np.where(z < 1.0, side * LEG_AXIS[0] + (x - side * LEG_AXIS[0]) * k, x)
    y = np.where(z < 1.0, LEG_AXIS[1] + (y - LEG_AXIS[1]) * k, y)
    # chunky boots: widen/lengthen the foot about its axis
    kb = 1 + BOOT_K * (1 - ss(0.10, 0.22, z)) * ss(0.0, 0.05, ax)
    x = np.where(z < 0.3, side * BOOT_AXIS[0] + (x - side * BOOT_AXIS[0]) * kb, x)
    y = np.where(z < 0.3, BOOT_AXIS[1] + (y - BOOT_AXIS[1]) * kb, y)
    # thicker arms
    ka = 1 + ARM_THICK * ss(0.22, 0.32, ax)
    ya = ARM_AXIS[0] + (y - ARM_AXIS[0]) * ka
    za = ARM_AXIS[1] + (z - ARM_AXIS[1]) * ka
    inarm = z > 1.1
    y, z = np.where(inarm, ya, y), np.where(inarm, za, z)
    # chunkier hands: scale about the wrist
    kh = 1 + (HAND_K - 1) * ss(0.66, 0.74, ax)
    c = np.array([0.70, ARM_AXIS[0], ARM_AXIS[1]])
    xh = side * c[0] + (x - side * c[0]) * kh
    yh = c[1] + (y - c[1]) * kh
    zh = c[2] + (z - c[2]) * kh
    inh = ax > 0.62
    x, y, z = np.where(inh, xh, x), np.where(inh, yh, y), np.where(inh, zh, z)
    # broader shoulders
    w = ss(1.15, 1.30, z) * (1 - ss(1.40, 1.48, z))
    x = x + side * np.minimum(np.abs(x), SHOULDER_CAP) * SHOULDER_GAIN * w
    # bigger head about the neck
    kh = 1 + (HEAD_K - 1) * ss(1.38, 1.46, z)
    px, py, pz = HEAD_PIVOT
    x, y, z = px + (x - px) * kh, py + (y - py) * kh, pz + (z - pz) * kh
    z = _legs_z(z)
    return np.stack([x, y, z], -1).reshape(np.shape(co))


def zmap(z, level="c"):
    """Height of a body-axis point after the stylisation (maps the base's height thresholds)."""
    return float(proportion(np.array([[0.0, 0.03, z]]), level)[0, 2])


def warp_gear(co, level):
    return proportion(co, level)


# ---- head shape (mesh only) ---------------------------------------------------------------------------------------

def _smooth(co, edges, mask, iters, lam):
    n = len(co)
    for _ in range(iters):
        acc, cnt = np.zeros_like(co), np.zeros(n)
        for a, b in ((edges[:, 0], edges[:, 1]), (edges[:, 1], edges[:, 0])):
            np.add.at(acc, a, co[b])
            np.add.at(cnt, a, 1)
        avg = acc / np.maximum(cnt, 1)[:, None]
        co = co + (avg - co) * (lam * mask)[:, None]
    return co


def head_shape(co, edges, level):
    """Returns the mesh with the head simplified. c: light smoothing; d: smoothing + round skull, jaw, flat face planes."""
    co = np.array(co, float)
    z0 = proportion(np.array([[0.0, 0.03, 1.47]]), level)[0, 2]
    head = ss(z0 - 0.03, z0 + 0.03, co[:, 2])
    co = _smooth(co, edges, head, 4 if level == "c" else 6, 0.5)
    if level == "c":
        return co
    h = co[:, 2] >= z0
    zmin, zmax = co[h, 2].min(), co[h, 2].max()
    hh = zmax - zmin
    xw = np.percentile(np.abs(co[h, 0]), 97)
    ymin, ymax = np.percentile(co[h, 1], 3), np.percentile(co[h, 1], 97)
    # rounder skull: pull the cranium toward an ellipsoid
    cz = zmin + 0.50 * hh
    c = np.array([0.0, (ymin + ymax) / 2, cz])
    ra = np.array([xw * 1.02, (ymax - ymin) / 2, zmax - cz])
    r = np.sqrt((((co - c) / ra) ** 2).sum(-1))
    f = ss(zmin + 0.35 * hh, zmin + 0.65 * hh, co[:, 2]) * head
    t = (0.65 * f)[:, None]
    co = np.where(h[:, None], c + (co - c) * (1 + t * (1 / np.maximum(r, 1e-3)[:, None] - 1)), co)
    # defined jaw: widest at the jaw line, narrowing to a squarer chin
    zj = zmin + 0.30 * hh
    jaw = np.exp(-(((co[:, 2] - zj) / (0.12 * hh)) ** 2))
    chin = 1 - ss(zmin, zj, co[:, 2])
    co[:, 0] *= np.where(h, 1 + 0.06 * jaw - 0.22 * chin * (1 - jaw * 0.0), 1.0)
    co[:, 1] = np.where(h, co[:, 1] + (-0.015 * jaw) * (co[:, 1] < c[1]), co[:, 1])  # jaw corners sit a touch forward
    # flatter face planes: front surface toward one plane, clean around the eyes
    front = h & (co[:, 1] < c[1]) & (np.abs(co[:, 0]) < 0.8 * xw)
    face = ss(zmin + 0.10 * hh, zmin + 0.28 * hh, co[:, 2]) * (1 - ss(zmin + 0.80 * hh, zmin + 0.95 * hh, co[:, 2]))
    yf = np.percentile(co[front, 1], 35)
    s = (0.6 * face * (1 - ss(0.5 * xw, 0.8 * xw, np.abs(co[:, 0]))))
    co[:, 1] = np.where(front, co[:, 1] + (yf - co[:, 1]) * s, co[:, 1])
    return co


# ---- Blender application ------------------------------------------------------------------------------------------

def apply(arm, meshes, level):
    import bpy
    import bmesh
    for o in meshes.values():
        me = o.data
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = proportion(co.reshape(-1, 3), level)
        if o.name == "body":
            edges = np.empty(len(me.edges) * 2, np.int64)
            me.edges.foreach_get("vertices", edges)
            co = head_shape(co, edges.reshape(-1, 2), level)
        me.vertices.foreach_set("co", co.ravel())
        me.update()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        eb.head = proportion(np.array(eb.head), level).reshape(3)
        eb.tail = proportion(np.array(eb.tail), level).reshape(3)
    bpy.ops.object.mode_set(mode="OBJECT")


def make_upright(arm):
    """Idle: head/neck/spine and clavicles at their rest orientation (upright), arms hanging relaxed at the sides.
    Walk and work: head and neck upright only. Bone names are the renamed (standard) ones."""
    import bpy
    from mathutils import Matrix, Vector
    sc = bpy.context.scene
    upright = ("neck_01", "head")
    RANGE = {a.name: tuple(a.frame_range) for a in bpy.data.actions}

    def set_const(act, bone, q):
        lo, hi = RANGE[act.name]
        for fc in [f for f in act.fcurves if f.data_path == f'pose.bones["{bone}"].rotation_quaternion']:
            act.fcurves.remove(fc)
        for i in range(4):
            fc = act.fcurves.new(f'pose.bones["{bone}"].rotation_quaternion', index=i)
            fc.keyframe_points.insert(lo, q[i])
            fc.keyframe_points.insert(hi, q[i])
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

    for clip in ("walk", "work"):
        for b in upright:
            set_const(bpy.data.actions[clip], b, (1, 0, 0, 0))
    idle = bpy.data.actions["idle"]
    arm.animation_data_create()
    arm.animation_data.action = idle
    sc.frame_set(0)
    pb = arm.pose.bones
    for b in upright + ("spine", "spine_02", "spine_03", "clavicle.L", "clavicle.R"):
        pb[b].rotation_quaternion = (1, 0, 0, 0)
    # arms: aim each bone at a target direction in armature space (x outward, y forward is negative)
    targets = {"arm": (0.17, 0.0, -1.0), "forearm": (0.14, -0.14, -1.0), "hand": (0.12, -0.1, -1.0)}
    for side, sx in (("L", 1), ("R", -1)):
        for bone, d in targets.items():
            p = pb[f"{bone}.{side}"]
            bpy.context.view_layer.update()
            cur = (p.tail - p.head).normalized()
            q = cur.rotation_difference(Vector((d[0] * sx, d[1], d[2])).normalized())
            m = p.matrix.copy()
            p.matrix = Matrix.Translation(m.translation) @ (q.to_matrix() @ m.to_3x3()).to_4x4()
    bpy.context.view_layer.update()
    for b in upright + ("spine", "spine_02", "spine_03", "clavicle.L", "clavicle.R", "arm.L", "arm.R", "forearm.L",
                        "forearm.R", "hand.L", "hand.R"):
        set_const(idle, b, tuple(pb[b].rotation_quaternion))
    arm.animation_data.action = None
