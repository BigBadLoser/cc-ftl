"""Procedural skin weights, the same for the body and every skinned clothing layer.

Parts are rigid to their bone except in a band around each joint where weight is shared with the neighbouring
bone. Because the rule depends only on (bone, position), a shirt fitted over the body gets the same weights as the
body underneath it - the effect of a Data Transfer modifier without the modifier.
"""
from . import rig

ORDER = list(rig.BONES)
INDEX = {b: i for i, b in enumerate(ORDER)}
BAND = 0.07  # half-height of the blend band around a joint


def _ramp(v):
    return max(0.0, min(1.0, v))


def _pairs(bone):
    """Yield (other_bone, joint_y, gate(p) -> 0..1) for every joint touching `bone`."""
    def gate_for(child):
        if child.startswith("arm."):
            s = 1 if child.endswith("L") else -1
            return lambda p: _ramp((p[0] * s - 0.12) / 0.05)
        if child.startswith("leg."):
            s = 1 if child.endswith("L") else -1
            return lambda p: _ramp((p[0] * s + 0.03) / 0.05)
        return lambda p: 1.0
    parent = rig.BONES[bone][0]
    if parent and parent != "root":
        yield parent, rig.REST[bone][1], gate_for(bone)
    for child, (par, head) in rig.BONES.items():
        if par == bone:
            yield child, head[1], gate_for(child)


def weights(bone, p):
    """{bone: weight} for a vertex of a part bound to `bone` at lab-space position `p` (rest pose)."""
    w = {bone: 1.0}
    for other, jy, gate in _pairs(bone):
        u = 0.5 * _ramp(1 - abs(p[1] - jy) / BAND) * gate(p)
        if u > 0:
            w[other] = w.get(other, 0.0) + w[bone] * u
            w[bone] *= 1 - u
    return w
