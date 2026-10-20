"""Content digests of the Blender scene, for the crew render cache: an item's geometry and the rig. Runs inside Blender.
Floats are rounded before hashing so a rebuild gives the same digest."""
import hashlib
import bpy
import numpy as np

ND = 5


def _upd(h, a):
    h.update(np.round(np.asarray(a, np.float64), ND).tobytes())


def _attrs(me):
    """[(name, domain, ndarray (n, w))] of the mesh's value attributes (positions and internal ones excluded)."""
    out = []
    for at in sorted(me.attributes, key=lambda a: a.name):
        if at.name.startswith(".") or at.name == "position":
            continue
        prop, w = {"FLOAT_COLOR": ("color", 4), "BYTE_COLOR": ("color", 4), "FLOAT_VECTOR": ("vector", 3), "FLOAT": ("value", 1),
                   "INT": ("value", 1), "BOOLEAN": ("value", 1)}.get(at.data_type, (None, 0))
        if prop:
            buf = np.zeros(len(at.data) * w, np.float32)
            at.data.foreach_get(prop, buf)
            out.append((at.name, at.domain, np.round(buf.reshape(-1, w), 3)))
    return out


def _mesh_digest(ob, h):
    """Canonical (vertex/face order independent) digest of a mesh: skinned items are cut from the base by code that iterates
    sets, so their vertex and face order differs between processes while the geometry is identical."""
    me = ob.data
    n = len(me.vertices)
    co = np.zeros(n * 3, np.float32)
    me.vertices.foreach_get("co", co)
    q = np.round(co.reshape(-1, 3) * 1e4).astype(np.int64)
    vkey = [tuple(r) for r in q.tolist()]
    if ob.vertex_groups:
        names = {g.index: g.name for g in ob.vertex_groups}
        vkey = [(k, tuple(sorted((names[g.group], round(g.weight, 3)) for g in v.groups))) for k, v in zip(vkey, me.vertices)]
    attrs = _attrs(me)
    polys = []
    for p in me.polygons:
        corners = []
        for lp in range(p.loop_start, p.loop_start + p.loop_total):
            vi = me.loops[lp].vertex_index
            vals = tuple(tuple(a[{"POINT": vi, "CORNER": lp, "FACE": p.index}.get(dom, 0)].tolist()) for _, dom, a in attrs)
            corners.append((vkey[vi], vals))
        polys.append(repr(sorted(corners)))
    h.update(repr((n, len(polys), [(a[0], a[1]) for a in attrs])).encode())
    h.update(repr(sorted(polys)).encode())


def object_digest(ob):
    h = hashlib.sha1()
    h.update(repr((ob.name, ob.type, ob.parent_type, ob.parent_bone, ob.parent.name if ob.parent else "")).encode())
    _upd(h, [list(r) for r in ob.matrix_basis])
    h.update(repr(sorted((k, str(ob[k])) for k in ob.keys() if not k.startswith("_"))).encode())
    h.update(repr([(m.type, getattr(m, "object", None) and m.object.name) for m in ob.modifiers]).encode())
    if ob.type == "MESH":
        _mesh_digest(ob, h)
        h.update(repr([s.material.name if s.material else "" for s in ob.material_slots]).encode())
    return h.hexdigest()


def item_digest(it):
    """Geometry + flags of one layer item (everything that can change its pixels besides the rig and the code)."""
    h = hashlib.sha1()
    h.update(repr((it.id, it.slot, it.name, it.order, it.default, it.glow)).encode())
    for d in sorted(object_digest(o) for o in it.objs):
        h.update(d.encode())
    return h.hexdigest()


def rig_digest(arm):
    """Armature rest bones and every action's keys."""
    h = hashlib.sha1()
    h.update(repr(tuple(arm.scale)).encode())
    for b in sorted(arm.data.bones, key=lambda b: b.name):
        h.update(b.name.encode())
        _upd(h, [list(b.head_local), list(b.tail_local)])
        h.update((b.parent.name if b.parent else "").encode())
    for act in sorted(bpy.data.actions, key=lambda a: a.name):
        h.update(act.name.encode())
        for fc in sorted(act.fcurves, key=lambda f: (f.data_path, f.array_index)):
            h.update(repr((fc.data_path, fc.array_index)).encode())
            pts = np.zeros(len(fc.keyframe_points) * 2, np.float32)
            fc.keyframe_points.foreach_get("co", pts)
            _upd(h, pts)
    return h.hexdigest()
