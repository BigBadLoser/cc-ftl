"""Damage study using the shared module recipe, on fresh approved geometry.

Apply the recipe once in canonical r0, then rigidly turn the entire damaged
assembly. Hits stay attached to the same hardware in all four orientations.
"""
import numpy as np
from . import core, damage
from . import core_systems_detail as model
from .core_systems_blockout import make_frame
from .core_systems_touchups import parameters

STATES = ('damaged', 'damaged.flicker', 'destroyed')


def contain_dents(obs, originals, footprint):
    """Reduce dent depth continuously if a hit pushes hardware off its tiles."""
    factors = []
    for ob, before in zip(obs, originals):
        after = np.array([(v.co.x, -v.co.y, v.co.z) for v in ob.data.vertices])
        assert before.shape == after.shape
        delta = after - before
        factor = 1.0
        for axis, size in enumerate(footprint):
            for low_side in (False, True):
                mask = delta[:, axis] < -1e-9 if low_side else delta[:, axis] > 1e-9
                limit = -size + .505 if low_side else .495
                if mask.any():
                    factor = min(factor, float(((limit - before[mask, axis]) / delta[mask, axis]).min()))
        factor = max(0, factor)
        for v, xyz in zip(ob.data.vertices, before + delta * factor): v.co = core.G(*xyz)
        ob.data.update()
        factors.append(factor)
    return min(factors)


def tuck_attachments(obs, footprint):
    """Translate protruding loose panels inward without flattening their shape."""
    w, h = footprint
    changed = 0
    for ob in obs:
        q = np.array([(v.co.x, -v.co.y, v.co.z) for v in ob.data.vertices])
        lo, hi = q.min(0), q.max(0)
        shift = np.zeros(3)
        for axis, size in enumerate((w, h)):
            low, high = -size + .505, .495
            assert hi[axis] - lo[axis] <= high - low
            if lo[axis] < low: shift[axis] = low - lo[axis]
            elif hi[axis] > high: shift[axis] = high - hi[axis]
        if np.any(shift):
            for v, xyz in zip(ob.data.vertices, q + shift): v.co = core.G(*xyz)
            ob.data.update()
            changed += 1
    return changed


def inset_wreck(obs, footprint):
    """A smooth inward collapse keeps the shared sheared wreck on its own tiles.

    Feet at deck level do not move. One continuous factor applies to the upper
    assembly, avoiding per-vertex boundary clamps and flattened edge geometry.
    """
    w, h = footprint
    centre = np.array((-(w - 1) / 2, -(h - 1) / 2))
    limits = np.array((w / 2 - .005, h / 2 - .005))
    data, collapse = [], 0.0
    for ob in obs:
        q = np.array([(v.co.x, -v.co.y, v.co.z) for v in ob.data.vertices])
        weight = np.clip((q[:, 2] - .25) / .35, 0, 1)
        delta = np.abs(q[:, :2] - centre)
        excess = np.maximum(0, 1 - limits / np.maximum(delta, 1e-9))
        assert not np.any((excess.max(1) > 0) & (weight == 0))
        collapse = max(collapse, float((excess / np.maximum(weight[:, None], 1e-9)).max()))
        data.append((ob, q, weight))
    assert collapse < .4
    for ob, q, weight in data:
        q[:, :2] = centre + (q[:, :2] - centre) * (1 - weight[:, None] * collapse)
        for v, xyz in zip(ob.data.vertices, q): v.co = core.G(*xyz)
        ob.data.update()
    return 1 - collapse


def build(name, state, rotation=0):
    assert state in STATES
    p = parameters(name)
    obs = getattr(model, name)(p, 0, finished=True, powered=True)
    intact_count = len(obs)
    originals = [np.array([(v.co.x, -v.co.y, v.co.z) for v in ob.data.vertices]) for ob in obs]
    # Keep static module damage mechanical: dents, scorch, a bent panel and
    # reduced lights. No suspended spark chips or scattered floor debris.
    obs = damage.apply(obs, state, f'module.{name}.{state}', electric=False, debris=False)
    if state == 'destroyed':
        obs[0]['wreckInsetFactor'] = inset_wreck(obs, p.footprint)
    else:
        obs[0]['dentDepthFactor'] = contain_dents(obs[:intact_count], originals, p.footprint)
        obs[0]['tuckedDamageAttachments'] = tuck_attachments(obs[intact_count:], p.footprint)
    if rotation:
        a = make_frame(None, p.footprint, 0)
        b = make_frame(None, p.footprint, rotation)
        for ob in obs:
            for vert in ob.data.vertices:
                gx, gy, z = vert.co.x, -vert.co.y, vert.co.z
                u, v = a.cy - gy, gx - a.cx
                x, y = b.xy(u, v)
                vert.co = core.G(x, y, z)
            ob.data.update()
    return obs
