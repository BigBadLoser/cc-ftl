"""Combat clips: procedural aim and fire poses on the v2 rig, over idle frame 0 (finger curl, legs). Armature space:
forward -Y, up +Z, character left +X.

The right hand holds the weapon (human_v2_weapons: a gear.hand layer modelled in hand.R's own frame), so the hand's
whole frame is set, not just its direction: +Y along the barrel, +Z up. The arms reach their targets with a two-bone
IK; two-hand and heavy holds put the left hand on the family's support point (human_v2_weapons.SUPPORT).
  aim_1h / fire_1h        one arm out at shoulder height, the other at the side; fire: a kick up and back, then settle
  aim_2h / fire_2h        stock in the right shoulder, left hand on the foregrip; fire: as 1h, smaller
  aim_heavy / fire_heavy  braced at the right hip, a wide knees-bent stance, left hand on the top handle; fire: a
                          sustained shudder (4 frames, looping)
  walk_aim_1h / walk_aim_2h / walk_heavy   the walk cycle's legs (the walk action at that frame) under the aim's arms
  ready_1m / swing_1m     guard with the blade or baton up; swing: wind up behind the shoulder, chop through, strike,
                          follow through low across the body, recover (5 frames)
  ready_2m / swing_2m     the axe across the body, both hands on the haft; swing: overhead, from behind the head down
                          to the floor in front, then back (6 frames)
  crouch_<combat clip>    the same arms over human_crouch's legs: crouched behind cover, the torso up over it
  lean_l_<1h|2h> / lean_r_<1h|2h>   the aim, the upper body leaning out sideways (round a doorframe or a corner)"""
import math

from mathutils import Matrix, Vector

from . import human_crouch as hc
from . import human_v2_weapons as hw
from .human_sit import _aim, bpy_update

FWD, UP, LEFT = Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))
KICK = {"fire_1h": (1.0, 0.5, 0.15), "fire_2h": (1.0, 0.45, 0.1), "fire_heavy": (0.6, 0.25, 0.55, 0.2)}


def _ik(arm, s, target, pole):
    """arm.s and forearm.s so the wrist lands on `target`; the elbow bends toward `pole`."""
    pb, B = arm.pose.bones, arm.data.bones
    S = pb[f"arm.{s}"].head.copy()
    a, b = B[f"arm.{s}"].length, B[f"forearm.{s}"].length
    d = target - S
    L = min(d.length, (a + b) * 0.995)
    u = d.normalized()
    x = (a * a - b * b + L * L) / (2 * L)
    v = (pole - u * pole.dot(u)).normalized()
    E = S + u * x + v * math.sqrt(max(0.0, a * a - x * x))
    _aim(arm, f"arm.{s}", E - S)
    _aim(arm, f"forearm.{s}", S + u * L - E)


def _frame(arm, name, fwd, up):
    """Set a bone's whole armature-space frame: +Y along fwd, +Z toward up, its head where it is."""
    pb = arm.pose.bones[name]
    right = fwd.cross(up).normalized()
    up = right.cross(fwd).normalized()
    m = Matrix((right, fwd, up)).transposed().to_4x4()
    m.translation = pb.head
    pb.matrix = m
    bpy_update()


def _wrist(s, at, hy, hz, gy):
    """Where hand s's wrist goes so its fist (gy along the hand, TUNNEL to the palm side) closes on `at`, the hand's +Y
    along hy and +Z along hz."""
    hx = hy.cross(hz).normalized()
    return at - hy * gy - hx * (-hw.TUNNEL if s == "R" else hw.TUNNEL)


def _hold(arm, s, grip, fwd, up, pole):
    """Hand s closes on the grip-frame point `grip` (armature space), barrel along fwd (the hand pitched under it)."""
    hf, hu = hw.hand_axes(fwd, up)
    _ik(arm, s, _wrist(s, grip, hf, hu, hw.grip_y(arm)), pole)
    _frame(arm, f"hand.{s}", hf, hu)


def _twist(arm, ang):
    """Turn the chest about the spine (ang > 0: the left shoulder forward, a bladed stance), the neck back the other
    way so the head still faces ahead."""
    pb = arm.pose.bones
    y0 = pb["arm.L"].head.y
    for n in ("spine_02", "spine_03"):
        pb[n].matrix = pb[n].matrix @ Matrix.Rotation(ang / 2, 4, "Y")
        bpy_update()
    if (pb["arm.L"].head.y - y0) * ang > 0:                                   # the wrong way round: turn back twice
        for n in ("spine_02", "spine_03"):
            pb[n].matrix = pb[n].matrix @ Matrix.Rotation(-ang, 4, "Y")
            bpy_update()
        ang = -ang
    pb["neck_01"].matrix = pb["neck_01"].matrix @ Matrix.Rotation(-ang, 4, "Y")
    bpy_update()


CUP_DROP = 0.035                    # the cupping fist's centre this far under the handguard's (fingers not over its top)


def _cup(arm, at, fwd, up):
    """The left hand cups a handguard at `at`: palm up under it, the barrel along the fist (index towards the muzzle),
    the forearm in from below on the left and the fingers wrapping up the far side."""
    across = fwd.cross(up).normalized()                                       # wrist to knuckles: to the right
    under = at - up * CUP_DROP                                                 # the handguard rests on the palm, the
    _ik(arm, "L", _wrist("L", under, across, fwd, hw.grip_y(arm)), -UP + LEFT * 0.25 - FWD * 0.3)   # fingers up its
    _frame(arm, "hand.L", across, fwd)                                         # side, the elbow down under the gun


def _stance(arm, wide):
    pb = arm.pose.bones
    pb["root"].location = (0, 0, -0.035 if wide else 0.0)
    bpy_update()
    for s, n in ((1, "L"), (-1, "R")):
        if wide:                                                              # feet apart, knees a little bent
            _aim(arm, f"leg.{n}", Vector((s * 0.2, -0.08, -1)))
            _aim(arm, f"shin.{n}", Vector((s * 0.12, 0.1, -1)))


RIGHT = -LEFT
# melee keyframes: (right wrist offset from the right shoulder, weapon direction), per frame
MELEE = {
    "ready_1m": [(FWD * 0.3 + UP * 0.02, UP * 0.75 + FWD * 0.6), (FWD * 0.3 - UP * 0.01, UP * 0.7 + FWD * 0.65)],
    "swing_1m": [(UP * 0.32 + RIGHT * 0.1 - FWD * 0.05, UP * 0.6 - FWD * 0.75 + RIGHT * 0.2),
                 (FWD * 0.38 + UP * 0.16, UP * 0.75 + FWD * 0.65),
                 (FWD * 0.48 - UP * 0.12 + LEFT * 0.1, FWD * 0.9 - UP * 0.4),
                 (FWD * 0.42 - UP * 0.32 + LEFT * 0.12, -UP * 0.7 + LEFT * 0.5 + FWD * 0.3),     # out in front, clear
                 (FWD * 0.3 + UP * 0.0, UP * 0.7 + FWD * 0.6)],                                 # of the belly
    "ready_2m": [(FWD * 0.42 - UP * 0.1, UP * 0.8 + RIGHT * 0.45 + FWD * 0.15),
                 (FWD * 0.42 - UP * 0.13, UP * 0.8 + RIGHT * 0.45 + FWD * 0.15)],
    "swing_2m": [(UP * 0.26 + FWD * 0.26 + RIGHT * 0.06, UP * 0.5 - FWD * 0.85),                # overhead, the hands
                 (UP * 0.34 + FWD * 0.34 + RIGHT * 0.04, UP * 0.95 - FWD * 0.2),                # in front of the head
                 (UP * 0.14 + FWD * 0.52, FWD * 0.85 + UP * 0.5),
                 (FWD * 0.54 - UP * 0.18 + LEFT * 0.02, FWD * 0.6 - UP * 0.8),
                 (FWD * 0.54 - UP * 0.22 + LEFT * 0.02, FWD * 0.55 - UP * 0.85),
                 (FWD * 0.42 - UP * 0.08, UP * 0.8 + RIGHT * 0.4 + FWD * 0.2)],
}


def _melee(arm, i, clip):
    pb = arm.pose.bones
    wrist, d = MELEE[clip][i]
    d = d.normalized()
    up = -FWD if abs(d.z) > 0.9 else UP                                       # the blade's edge leads the cut
    _aim(arm, "spine_02", Vector((0, -0.12 if clip.startswith("swing") and i in (2, 3) else -0.04, 1)))
    _ik(arm, "R", pb["arm.R"].head + wrist, -UP + RIGHT * 0.5 - FWD * 0.2)
    fa = (pb["forearm.R"].tail - pb["forearm.R"].head).normalized()
    hy = fa - d * fa.dot(d)                                                  # the hand carries on from the forearm,
    hy = hy.normalized() if hy.length > 1e-3 else up.cross(d).normalized()  # the handle across the fist along d
    _frame(arm, "hand.R", hy, d)
    if clip.endswith("2m"):                                                  # the left hand lower on the haft
        sup = pb["hand.R"].matrix @ hw.to_hand(arm, hw.SUPPORT["2m"], melee=True)
        _ik(arm, "L", _wrist("L", sup, hy, d, hw.grip_y(arm)), -UP * 0.4 + LEFT * 0.8 + FWD * 0.6)   # elbow out front
        _frame(arm, "hand.L", hy, d)


def apply(arm, i, clip):
    """Pose frame i of a combat clip (see the module docstring). -> breathing amount."""
    arm.animation_data.action = None                                         # keep the action's pose, stop it
    pb = arm.pose.bones                                                      # overwriting ours
    crouch = clip.startswith("crouch_")
    clip = clip.removeprefix("crouch_")
    lean = 0
    if clip.startswith("lean_"):
        lean = 1 if clip[5] == "l" else -1
        clip = "aim_" + clip.rsplit("_", 1)[1]
    fam = clip.rsplit("_", 1)[1]
    walk = clip.startswith("walk")
    if crouch:
        hc.legs(arm, kneel=fam == "heavy", lift=0.05 if fam in ("2h", "heavy") else 0.0)
        hc.torso(arm, 0.0)
    elif not walk and fam != "heavy":
        hc.stance(arm)                                                       # idle's legs, tidied
    if fam in ("1m", "2m"):
        _melee(arm, i, clip)
        _aim(arm, "head", Vector((0, -0.1, 1)))
        return 0.0
    k = KICK[clip][i] if clip in KICK else 0.0
    breath = 0.0 if clip in KICK or walk else math.sin(math.pi * i)
    pitch = 0.12 * k + (0.05 if fam == "heavy" else 0.0)
    fwd = (FWD * math.cos(pitch) + UP * math.sin(pitch)).normalized()
    up = (UP * math.cos(pitch) - FWD * math.sin(pitch)).normalized()
    back = -FWD * 0.04 * k                                                   # the kick
    if not walk and not crouch:
        _stance(arm, fam == "heavy")
        _aim(arm, "spine_02", Vector((0, -0.08 if fam != "heavy" else 0.04, 1)))   # lean into it (heavy: lean back)
    if lean:                                                                 # out round the corner: hips the other way
        pb["root"].location = (-lean * 0.035, 0, 0)
        bpy_update()
        _aim(arm, "spine", Vector((lean * 0.12, -0.04, 1)))
        _aim(arm, "spine_02", Vector((lean * 0.32, -0.06, 1)))
        _aim(arm, "spine_03", Vector((lean * 0.4, -0.06, 1)))
    if fam == "1h":
        S = pb["arm.R"].head.copy()
        reach = (arm.data.bones["arm.R"].length + arm.data.bones["forearm.R"].length) * 0.96
        wrist = S + (FWD * 0.978 - UP * 0.1).normalized() * reach + back    # straight out, not across
        _ik(arm, "R", wrist, -UP + LEFT * 0.2 + FWD * 0.1)
        _frame(arm, "hand.R", *hw.hand_axes(fwd, up))
    elif fam == "2h":                                                        # shouldered: bladed, the butt in the
        _twist(arm, 0.45)                                                    # pocket inside the right shoulder
        sR, sL = pb["arm.R"].head.copy(), pb["arm.L"].head.copy()
        pocket = sR + (sL - sR).normalized() * 0.04 + FWD * 0.12 - UP * 0.06
        grip = pocket + fwd * hw.BUTT * hw.SIZE - up * (0.04 + hw.RISE) * hw.SIZE + back
        _hold(arm, "R", grip, fwd, up, -UP * 0.6 - LEFT * 0.8)                # the right elbow out to the side
        sup = pb["hand.R"].matrix @ hw.to_hand(arm, hw.SUPPORT["2h"])
        _cup(arm, sup, fwd, up)
    else:
        hips = pb["hips"].head.copy()
        _twist(arm, 0.25)
        grip = hips + FWD * 0.34 - LEFT * 0.17 + UP * 0.16 + back * 0.6           # out in front of the right hip, clear
        _hold(arm, "R", grip, fwd, up, -UP - LEFT * 0.7 - FWD * 0.1)              # of the belly
        sup = pb["hand.R"].matrix @ hw.to_hand(arm, hw.SUPPORT["heavy"])
        _hold(arm, "L", sup, fwd, up, -UP + LEFT * 0.6)                           # under the gun, on its front grip
    _aim(arm, "head", Vector((0, -0.1, 1)))
    return 0.4 * breath
