"""Content digests of the live Blender scene for the sprite render cache (env_build): the scene state and every object's
geometry, flags and colour attributes. Runs inside Blender. Floats are rounded before hashing so a rebuild gives the same
digest. (The crew cache has its own per-item digests: crew_digest.py.)"""
import hashlib
import bpy
import numpy as np


def _upd(h, a, nd=5):
    h.update(np.round(np.asarray(a, np.float64), nd).tobytes())


def scene_digest():
    """Everything but the meshes that shapes a render: world, lights, camera placement, render and Cycles settings."""
    sc = bpy.context.scene
    h = hashlib.sha1()
    c = sc.cycles
    h.update(repr((sc.render.engine, sc.render.film_transparent, sc.view_settings.view_transform, sc.view_settings.look,
                   sc.view_settings.exposure, sc.view_settings.gamma, sc.render.dither_intensity, c.device, c.samples,
                   c.use_denoising, c.use_adaptive_sampling, round(c.filter_width, 5), c.max_bounces, c.diffuse_bounces,
                   c.transparent_max_bounces)).encode())
    if sc.world and sc.world.node_tree:
        for n in sc.world.node_tree.nodes:
            for i in n.inputs:
                if hasattr(i, "default_value"):
                    v = i.default_value
                    _upd(h, list(v) if hasattr(v, "__len__") else [v])
    for ob in sc.objects:
        if ob.type in ("LIGHT", "CAMERA"):
            h.update(repr((ob.type, ob.hide_render)).encode())
            _upd(h, [list(r) for r in ob.matrix_world])
            d = ob.data
            for k in ("energy", "angle", "use_shadow", "type", "clip_start", "clip_end"):
                if hasattr(d, k):
                    h.update(repr(getattr(d, k)).encode())
    return h.hexdigest()


def _mesh(ob, h):
    me = ob.data
    n, npoly, nloop = len(me.vertices), len(me.polygons), len(me.loops)
    co = np.zeros(n * 3, np.float32)
    me.vertices.foreach_get("co", co)
    _upd(h, co, 5)
    ls, lt, sm = (np.zeros(npoly, np.int32) for _ in range(3))
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    me.polygons.foreach_get("use_smooth", sm)
    vi = np.zeros(nloop, np.int32)
    me.loops.foreach_get("vertex_index", vi)
    for a in (ls, lt, sm, vi):
        h.update(a.tobytes())
    for at in sorted(me.attributes, key=lambda a: a.name):
        if at.name == "position":
            continue
        prop, w = {"FLOAT_COLOR": ("color", 4), "BYTE_COLOR": ("color", 4), "FLOAT_VECTOR": ("vector", 3),
                   "FLOAT": ("value", 1), "INT": ("value", 1), "BOOLEAN": ("value", 1)}.get(at.data_type, (None, 0))
        h.update(repr((at.name, at.domain, at.data_type)).encode())
        if prop:
            buf = np.zeros(len(at.data) * w, np.float32)
            at.data.foreach_get(prop, buf)
            _upd(h, buf, 4)
    h.update(repr([s.material.name if s.material else "" for s in ob.material_slots]).encode())


def _idx(objs, o):
    return objs.index(o) if o in objs else -1


def objects_digest(objs):
    """Digest of every object in the scene (order kept, names not: Blender numbers duplicates) plus which of them `objs` are."""
    sc_objs = list(bpy.context.scene.objects)
    h = hashlib.sha1()
    h.update(repr([_idx(sc_objs, o) for o in objs]).encode())
    for ob in sc_objs:
        if ob.type in ("LIGHT", "CAMERA"):
            continue
        h.update(repr((ob.type, ob.hide_render, ob.hide_viewport, ob.is_holdout, ob.parent_type,
                       _idx(sc_objs, ob.parent),
                       sorted((k, str(ob[k])) for k in ob.keys() if not k.startswith("_")),
                       [(m.type, _idx(sc_objs, getattr(m, "object", None))) for m in ob.modifiers])).encode())
        _upd(h, [list(r) for r in ob.matrix_world])
        if ob.type == "MESH":
            _mesh(ob, h)
    return h.hexdigest()
