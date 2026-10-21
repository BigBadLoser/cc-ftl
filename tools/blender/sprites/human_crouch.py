"""Cover poses: the crouched legs and torso (armature space: forward -Y, up +Z, character left +X). The silhouette is
about half standing height: the hips drop to SQUAT of their standing height, the feet stay planted, the knees go
forward (a two-bone IK on leg / shin).
  crouch_idle / crouch_walk   hunched behind cover, forearms on the knees; walk: a slow shuffle, the feet alternating
  crouch_* (combat)           the same legs, the torso up (popping up over the cover); human_aim poses the arms
  crouch_fire_heavy           kneeling on the right knee, braced"""
import math

from mathutils import Vector

from .human_sit import _aim, _rest_dir, bpy_update

FWD, UP, LEFT = Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))
SQUAT = 0.4                                      # hip height, a fraction of standing


def _leg_ik(arm, s, ankle, pole):
    pb, B = arm.pose.bones, arm.data.bones
    H = pb[f"leg.{s}"].head.copy()
    a, b = B[f"leg.{s}"].length, B[f"shin.{s}"].length
    d = ankle - H
    L = min(d.length, (a + b) * 0.995)
    u = d.normalized()
    x = (a * a - b * b + L * L) / (2 * L)
    v = (pole - u * pole.dot(u)).normalized()
    K = H + u * x + v * math.sqrt(max(0.0, a * a - x * x))
    _aim(arm, f"leg.{s}", K - H)
    _aim(arm, f"shin.{s}", H + u * L - K)
    _aim(arm, f"foot.{s}", _rest_dir(arm, f"foot.{s}"))


def legs(arm, i=0, n=1, walk=False, kneel=False, lift=0.0):
    """Drop the hips and plant the feet. walk: frame i of n of the shuffle; kneel: right knee down; lift: hips higher."""
    pb, B = arm.pose.bones, arm.data.bones
    hip0 = B["hips"].head_local.z
    hip = hip0 * (SQUAT + lift + (0.06 if kneel else 0.0))
    pb["root"].location = (0, 0, hip - hip0)
    bpy_update()
    for s, sx in (("L", 1), ("R", -1)):
        foot = Vector(B[f"foot.{s}"].head_local)                            # the ankle, standing
        step = 0.0
        if walk:
            ph = math.tau * i / n + (0.0 if s == "L" else math.pi)
            step = 0.09 * math.sin(ph)
            foot.z += 0.04 * max(0.0, math.cos(ph))                          # the foot moving forward lifts a little
        ankle = Vector((foot.x + sx * 0.05, foot.y + step - 0.04, foot.z))
        if kneel and s == "R":                                                 # the right knee on the deck
            H = pb["leg.R"].head.copy()
            K = Vector((H.x - 0.02, H.y + 0.12, 0.07))
            _aim(arm, "leg.R", K - H)
            _aim(arm, "shin.R", Vector((0, 1, -0.12)))
            _aim(arm, "foot.R", Vector((0, 0.3, -1)))
            continue
        if kneel:
            ankle.y -= 0.12                                                    # the left foot forward
        _leg_ik(arm, s, ankle, FWD + LEFT * sx * 0.35)


def torso(arm, hunch):
    """hunch 1: bent well over (hidden); 0: upright (up over the cover)."""
    lean = 0.08 + 0.85 * hunch
    for name, k in (("hips", 0.4), ("spine", 0.8), ("spine_02", 1.0), ("spine_03", 1.0)):
        _aim(arm, name, Vector((0, -math.sin(lean * k), math.cos(lean * k))))
    _aim(arm, "neck_01", Vector((0, -0.1, 1)))
    _aim(arm, "head", Vector((0, -0.25 - 0.35 * hunch, 1)))                    # head up, looking ahead


def arms_on_knees(arm):
    from .human_aim import _ik
    pb = arm.pose.bones
    for s, sx in (("L", 1), ("R", -1)):
        knee = pb[f"shin.{s}"].head.copy()
        _ik(arm, s, knee + FWD * 0.06 + UP * 0.06 - LEFT * sx * 0.02, -UP + LEFT * sx * 0.5 - FWD * 0.2)
        _aim(arm, f"hand.{s}", FWD * 0.6 - UP * 0.8)


def base(arm, i, clip):
    """crouch_idle / crouch_walk. -> breathing."""
    arm.animation_data.action = None
    walk = clip == "crouch_walk"
    legs(arm, i, 6 if walk else 2, walk=walk)
    torso(arm, 1.0)
    arms_on_knees(arm)
    return 0.0 if walk else 0.5 * math.sin(math.pi * i)
