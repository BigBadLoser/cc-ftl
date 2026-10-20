"""Damage states for modules (family `damage`): `.damaged` (hp under half) and `.destroyed` (hp 0), made by a pass over
the built objects of the module's own idle sprite, so every module and rotation gets them from one recipe.
Runs inside Blender.

  damaged    two hits on camera-facing surfaces: dents pushed in, scorch fading out from each, about half the lights
             dead (the rest still lit), a spark burst and a cut cable hanging from the worst hit
  destroyed  a burnt-out wreck of the same footprint: everything charred (tops sooted darkest), the upper part slumped
             and sheared over, holes punched in the shell, no glow, debris scattered round the base

Seeded by the sprite id: repeatable, and different from module to module. Colours are edited in the Col / Self / Glow
face attributes (core.finalize), geometry with bmesh."""
import math
import random
import zlib

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from . import core

CHAR = np.array(core.lin("dark"), np.float32)
SOOT = np.array(core.lin("rustD"), np.float32)
DMG = ("damaged", "destroyed")


def _faces(ob):
    """Per-face (centre, normal, area) in world space and per-face Col / Self / Glow (linear rgb)."""
    me = ob.data
    mw = ob.matrix_world
    rot = mw.to_3x3()
    cen = [mw @ p.center for p in me.polygons]
    nrm = [(rot @ p.normal).normalized() for p in me.polygons]
    lt = np.array([p.loop_total for p in me.polygons])
    ls = np.array([p.loop_start for p in me.polygons])
    att = {}
    for name in ("Col", "Self", "Glow"):
        a = np.empty(len(me.loops) * 4, np.float32)
        me.color_attributes[name].data.foreach_get("color", a)
        att[name] = a.reshape(-1, 4)[ls, :3] if len(lt) else np.zeros((0, 3), np.float32)
    return cen, nrm, att


def _set(ob, att):
    for name, v in att.items():
        core.set_attr(ob.data, name, v)


def _bbox(objs):
    pts = [ob.matrix_world @ v.co for ob in objs for v in ob.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _hits(objs, rnd, n, lo, hi):
    """n hit points on faces that face the camera (+x, +y or up) in the upper two thirds of the model."""
    cands = []
    h = hi.z - lo.z
    for ob in objs:
        cen, nrm, _ = _faces(ob)
        for c, nv in zip(cen, nrm):
            if c.z > lo.z + h * 0.3 and (nv.x + nv.y > 0.5 or nv.z > 0.7):
                cands.append((c.copy(), nv.copy()))
    rnd.shuffle(cands)
    out = []
    for c, nv in cands:
        if all((c - o[0]).length > 0.35 for o in out):
            out.append((c, nv))
        if len(out) == n:
            break
    return out


def _dent(ob, hits, rnd, r=0.3, depth=0.08):
    me = ob.data
    mwi = ob.matrix_world.inverted()
    for v in me.vertices:
        p = ob.matrix_world @ v.co
        for c, nv in hits:
            d = (p - c).length
            if d < r:
                k = (1 - d / r) ** 1.5
                p = p - nv * depth * k + Vector([rnd.uniform(-1, 1) * 0.012 * k for _ in range(3)])
        v.co = mwi @ p
    me.update()


def _scorch(ob, hits, rnd, r=0.55):
    cen, nrm, att = _faces(ob)
    col, slf, glw = att["Col"], att["Self"], att["Glow"]
    for i, c in enumerate(cen):
        f = 0.0
        for hc, _ in hits:
            d = (c - hc).length
            if d < r:
                f = max(f, (1 - d / r) ** 0.45)
        if f > 0:
            col[i] = col[i] * (1 - 0.95 * f) + CHAR * 0.95 * f
            if f > 0.3:
                slf[i] = 0
                glw[i] = 0
    lit = [i for i in range(len(cen)) if glw[i].max() > 0.001]          # about half the lights dead, in clusters
    if lit:
        cells = {}
        for i in lit:
            key = (round(cen[i].x / 0.3), round(cen[i].y / 0.3), round(cen[i].z / 0.3))
            cells.setdefault(key, []).append(i)
        for key in sorted(cells):
            if rnd.random() < 0.55:
                for i in cells[key]:
                    col[i] = glw[i] * 0.12 + CHAR * 0.3
                    glw[i] = 0
                    slf[i] = 0
    _set(ob, att)


def _char(ob, rnd):
    cen, nrm, att = _faces(ob)
    col = att["Col"]
    for i, nv in enumerate(nrm):
        soot = 0.8 if nv.z > 0.6 else 0.62
        mix = CHAR if rnd.random() < 0.85 else SOOT
        col[i] = col[i] * (1 - soot) * rnd.uniform(0.8, 1.1) + mix * soot
    att["Self"][:] = 0
    att["Glow"][:] = 0
    _set(ob, att)


def _slump(ob, rnd, lo, hi, lean):
    """Squash and shear everything above 40% height, punch holes in the upper shell."""
    me = ob.data
    h = hi.z - lo.z
    z0 = lo.z + h * 0.4
    mw, mwi = ob.matrix_world, ob.matrix_world.inverted()
    for v in me.vertices:
        p = mw @ v.co
        if p.z > z0:
            t = p.z - z0
            p = Vector((p.x + lean.x * t * 0.35, p.y + lean.y * t * 0.35, z0 + t * 0.6))
            p += Vector([rnd.uniform(-1, 1) * 0.025 for _ in range(3)])
        v.co = mwi @ p
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    kill = [f for f in bm.faces if (mw @ f.calc_center_median()).z > lo.z + h * 0.45 and rnd.random() < 0.14]
    bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
    bm.to_mesh(me)
    bm.free()
    me.update()


def _sparks(c, nv, rnd):
    m = core.Mesh("sparks")
    for _ in range(9):                                                      # a burst of bright chips off the hit
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.2, 1))).normalized()
        p = c + nv * 0.05 + d * rnd.uniform(0.06, 0.26)
        s = rnd.uniform(0.04, 0.065)
        m.box(tuple(p), (s, s, s), rnd.choice(("flameW", "flameY", "flameY", "arc")))
    t = Vector((-nv.y, nv.x, 0)).normalized() if abs(nv.z) < 0.9 else Vector((1, 0, 0))
    a = math.atan2(t.y, t.x)                                                # a torn panel flap peeled out of the hit
    m.box(tuple(c + nv * 0.12 + t * 0.08 + Vector((0, 0, 0.06))), (0.24, 0.03, 0.2), "steelD", top="dark",
          rz=a, rx=-0.7)
    base = c + nv * 0.04                                                    # a cut cable hanging out, live end
    m.box(tuple(base - Vector((0, 0, 0.12))), (0.035, 0.035, 0.24), "dark", base=False)
    m.box(tuple(base - Vector((0, 0, 0.26))), (0.05, 0.05, 0.05), "orange")
    return m.build()


def _debris(lo, hi, rnd, n=9):
    m = core.Mesh("debris")
    for _ in range(n):
        x = rnd.uniform(lo.x - 0.1, hi.x + 0.1)
        y = rnd.uniform(lo.y - 0.1, hi.y + 0.1)
        s = rnd.uniform(0.06, 0.16)
        m.box((x, y, 0.0), (s, s * rnd.uniform(0.6, 1.4), s * rnd.uniform(0.3, 0.8)),
              rnd.choice(("dark", "rustD", "steelD", "gmD")), base=True, rz=rnd.uniform(0, math.pi))
    for _ in range(2):                                                      # bent panels fallen against the base
        x, y = rnd.uniform(lo.x, hi.x), rnd.uniform(lo.y, hi.y)
        m.box((x, y, 0.06), (rnd.uniform(0.25, 0.4), 0.03, rnd.uniform(0.15, 0.25)), "steelD", top="dark",
              rz=rnd.uniform(0, math.pi), rx=rnd.uniform(0.6, 1.2))
    return m.build()


def apply(objs, level, sid):
    """Damage the built objects of one sprite in place; returns the object list (with sparks / debris added)."""
    objs = [o for o in objs if o.type == "MESH" and len(o.data.polygons)]
    rnd = random.Random(zlib.crc32(sid.encode()))
    lo, hi = _bbox(objs)
    out = list(objs)
    if level == "damaged":
        hits = _hits(objs, rnd, 3, lo, hi)
        for ob in objs:
            _dent(ob, hits, rnd)
            _scorch(ob, hits, rnd)
        if hits:
            out.append(_sparks(*hits[0], rnd))
    else:
        lean = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)).normalized()
        for ob in objs:
            _slump(ob, rnd, lo, hi, lean)
            _char(ob, rnd)
        out.append(_debris(lo, hi, rnd))
    bpy.context.view_layer.update()
    return out


def wrap(builder, level, sid):
    return lambda: apply(builder(), level, sid)


# ---- jobs -----------------------------------------------------------------------------------------------------------

def _rid(base, rot, rotates):
    """Damage sprite id: the base asset id with .r<rot> when the module has rotation variants, then the state."""
    return f"{base}.r{rot}" if rotates else base


def bases(rots=range(4)):
    """[(asset id stem, footprint, builder, palette extra)] for the idle sprite of every damageable module."""
    from . import consoles, galley, logistics, props, robot_bay, storage_set
    from . import console_proto as C
    out = []
    env = {s[0]: s for s in props.SPRITES}
    for aid in ("module.console", "module.bed", "module.life_support", "module.reactor", "module.light"):
        _, fp, _, fn = env[aid]
        out.append((aid, fp, fn, False))
    for name, aid in consoles.IDS.items():
        nu, nv = C.FOOT[name]
        for r in rots:
            fp = (nv, nu) if r % 2 == 0 else (nu, nv)
            out.append((_rid(aid, r, True), fp, lambda n=name, r=r: C.console(n, r, False), True))
    for r in rots:
        out.append((f"module.galley.r{r}", (2, 1) if r % 2 == 0 else (1, 2), lambda r=r: galley.galley(r, False), True))
        out.append((f"module.fabricator.r{r}", (2, 1) if r % 2 == 0 else (1, 2),
                    lambda r=r: logistics.fabricator(False, r), False))
        out.append((f"module.robot_bay.r{r}", (2, 1) if r % 2 else (1, 2), lambda r=r: robot_bay.build(r, ""), True))
    out.append(("module.storage", (1, 1), lambda: logistics.storage("partial"), False))
    for name, (fp, fn) in storage_set.BUILDERS.items():
        for r in rots:
            f = fp if r % 2 == 0 else (fp[1], fp[0])
            out.append((f"module.storage_{name}.r{r}", f, lambda fn=fn, r=r: fn("partial", r), True))
    return out


def jobs(rots=range(4)):
    """Sprite jobs for `.damaged` and `.destroyed` of every base, and the palette pick per id."""
    out, extra = [], {}
    for stem, fp, fn, ex in bases(rots):
        for level in DMG:
            sid = f"{stem}.{level}"
            out.append((sid, fp, "prop", wrap(fn, level, sid)))
            extra[sid] = ex
    return out, (lambda sid: extra.get(sid, True))
