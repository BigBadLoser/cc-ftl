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


def _hits(objs, rnd, n, lo, hi, band=None):
    """n hit points on faces that face the camera (+x, +y or up) in the upper two thirds of the model (or in the band
    (z0, z1))."""
    cands = []
    z0, z1 = (lo.z + (hi.z - lo.z) * 0.3, hi.z + 1) if band is None else band
    for ob in objs:
        cen, nrm, att = _faces(ob)
        for i, (c, nv) in enumerate(zip(cen, nrm)):                         # not on screens and lights: they
            if (z0 < c.z < z1 and (nv.x + nv.y > 0.5 or nv.z > 0.7)   # stay on to flicker
                    and att["Glow"][i].max() < 0.001):
                cands.append((c.copy(), nv.copy()))
    rnd.shuffle(cands)
    out = []
    for c, nv in cands:
        if all((c - o[0]).length > 0.35 for o in out):
            out.append((c, nv))
        if len(out) == n:
            break
    return out


def _dent(ob, hits, rnd, r=0.38, depth=0.14):
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
            if f > 0.6:
                slf[i] = 0
                glw[i] = 0
    lit = [i for i in range(len(cen)) if glw[i].max() > 0.001]          # about half the lights dead, in clusters
    if lit:
        cells = {}
        for i in lit:
            key = (round(cen[i].x / 0.3), round(cen[i].y / 0.3), round(cen[i].z / 0.3))
            cells.setdefault(key, []).append(i)
        for key in sorted(cells):
            if rnd.random() < 0.25:                                     # most stay lit: the flicker frame
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


def _grid(c, nv):
    """A Blender-space hit (point, normal) in the grid frame (core.G flips y)."""
    return Vector((c.x, -c.y, c.z)), Vector((nv.x, -nv.y, nv.z))


def _grid_box(lo, hi):
    return Vector((lo.x, -hi.y, lo.z)), Vector((hi.x, -lo.y, hi.z))


def _orient(nv):
    """(rz, sizes order) to lay a thin box flat against a face of normal nv: its thin axis along nv."""
    if abs(nv.z) > 0.7:
        return 0.0, False
    return math.atan2(nv.y, nv.x), True


def _hole(objs, hw, hg, electric, rnd, r=0.22):
    """Punch the panel out round the hit and set a dark cavity behind it (live wire stubs in an electrical module).
    hw: the hit in Blender space (to find the faces), hg: the same hit in the grid frame core.Mesh builds in."""
    c, nv = hw
    for ob in objs:
        me = ob.data
        mw = ob.matrix_world
        bm = bmesh.new()
        bm.from_mesh(me)
        rot = mw.to_3x3()
        kill = [f for f in bm.faces if ((mw @ f.calc_center_median()) - c).length < r
                and (rot @ f.normal).normalized().dot(nv) > 0.6]
        bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
        bm.to_mesh(me)
        bm.free()
        me.update()
    m = core.Mesh("hole")
    c, nv = hg
    rz, side = _orient(nv)
    q = c - nv * 0.06
    e = r * 1.7
    m.box(tuple(q), (0.08, e, e) if side else (e, e, 0.08), "dark", rz=rz)
    if electric:                                                            # wire stubs out of the cavity
        for k in range(2):
            e = c + nv * 0.05 + Vector((0, 0, -0.04 + k * 0.08))
            m.box(tuple(e), (0.04, 0.04, 0.04), ("orange", "steelL")[k])
    return m.build()


def _flap(objs, hw, hg, rnd):
    """A panel of the module's own colour bent out at the hit (hw / hg: as _hole)."""
    c = hw[0]
    best, col = 9.0, None
    for ob in objs:
        cen, _, att = _faces(ob)
        for i, fc in enumerate(cen):
            d = (fc - c).length
            if d < best and att["Glow"][i].max() < 0.001:
                best, col = d, att["Col"][i].copy()
    m = core.Mesh("flap")
    c, nv = hg
    rz, side = _orient(nv)
    m.box(tuple(c + nv * 0.07 + Vector((0, 0, 0.04))), (0.04, 0.34, 0.3) if side else (0.34, 0.3, 0.04),
          "steelD", rz=rz, rx=-0.75 if side else 0.6)
    ob = m.build()
    if col is not None:
        core.set_attr(ob.data, "Col", [col] * len(ob.data.polygons))
    return ob


def _sparks(c, nv, rnd):
    m = core.Mesh("sparks")
    for _ in range(9):                                                      # a burst of bright chips off the hit
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.2, 1))).normalized()
        p = c + nv * 0.05 + d * rnd.uniform(0.06, 0.26)
        s = rnd.uniform(0.04, 0.065)
        m.box(tuple(p), (s, s, s), rnd.choice(("flameW", "flameY", "flameY", "arc")))
    base = c + nv * 0.04                                                    # a cut cable hanging out, live end
    m.box(tuple(base - Vector((0, 0, 0.12))), (0.035, 0.035, 0.24), "dark", base=False)
    m.box(tuple(base - Vector((0, 0, 0.26))), (0.05, 0.05, 0.05), "orange")
    return m.build()


def _spill(lo, hi, rnd, n=4):
    """A little cargo knocked out onto the floor (non-electrical modules)."""
    m = core.Mesh("spill")
    for _ in range(n):
        x = rnd.uniform(lo.x, hi.x + 0.15)
        y = rnd.uniform(hi.y - 0.1, hi.y + 0.2)
        s = rnd.uniform(0.12, 0.2)
        m.box((x, y, 0.0), (s, s, s * 0.7), rnd.choice(("steel", "rust", "hivis", "plate")), top="plate",
              base=True, rz=rnd.uniform(0, math.pi), bevel=0.01)
    return m.build()


def _dim(objs):
    """The flicker frame: every light still lit goes dim."""
    for ob in objs:
        _, _, att = _faces(ob)
        g = att["Glow"]
        lit = g.max(axis=1) > 0.001
        att["Col"][lit] = g[lit] * 0.15 + CHAR * 0.3
        g[lit] = 0
        att["Self"][lit] = 0
        _set(ob, att)


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


HIT_BAND = {"module.med_bed": (0.15, 0.45)}  # low modules with a tall, finely built part at the back: hits in this
                                            # height band (the bed itself), not anywhere 1/3 up


def apply(objs, level, sid, electric=True, debris=True):
    """Damage the built objects of one sprite in place; returns the object list (with the added parts).
    level: damaged, damaged.flicker (the same damage, every surviving light dimmed, no sparks) or destroyed."""
    keep = [o for o in objs if not (o.type == "MESH" and "Col" in o.data.color_attributes and len(o.data.polygons))]
    objs = [o for o in objs if o not in keep]                                # only palette meshes take damage
    seed = sid.replace(".damaged.flicker", ".damaged")                      # the flicker frame repeats the damage
    rnd = random.Random(zlib.crc32(seed.encode()))
    lo, hi = _bbox(objs)
    out = list(objs) + keep
    if level.startswith("damaged"):
        area = (hi.x - lo.x) * (hi.y - lo.y)
        band = next((b for p, b in HIT_BAND.items() if sid.startswith(p)), None)
        hits = _hits(objs, rnd, min(8, 3 + int(area / 1.5)), lo, hi, band)               # more hits on bigger modules
        k = min(2.2, max(1.0, math.sqrt(area) / 1.5))                                      # and bigger damage
        for ob in objs:
            _dent(ob, hits, rnd, r=0.38 * k, depth=0.14 * k)
            _scorch(ob, hits, rnd, r=0.55 * k)
        hg = [_grid(c, nv) for c, nv in hits]                              # core.Mesh builds in the grid frame
        if hits:
            out.append(_hole(objs, hits[0], hg[0], electric, rnd, r=0.22 * k))
        if len(hits) > 1:
            out.append(_flap(objs, hits[1], hg[1], rnd))
        if electric and hits:
            sp = _sparks(*hg[0], rnd)
            if level == "damaged":
                out.append(sp)
            else:
                bpy.data.objects.remove(sp, do_unlink=True)
        elif sid.startswith("module.storage"):
            out.append(_spill(*_grid_box(lo, hi), rnd))
        if level == "damaged.flicker":
            _dim(objs)
    else:
        lean = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)).normalized()
        for ob in objs:
            _slump(ob, rnd, lo, hi, lean)
            _char(ob, rnd)
        if debris:
            out.append(_debris(*_grid_box(lo, hi), rnd))
    bpy.context.view_layer.update()
    return out


def wrap(builder, level, sid, electric=True, debris=True):
    return lambda: apply(builder(), level, sid, electric, debris)


# ---- jobs -----------------------------------------------------------------------------------------------------------

def _rid(base, rot, rotates):
    """Damage sprite id: the base asset id with .r<rot> when the module has rotation variants, then the state."""
    return f"{base}.r{rot}" if rotates else base


def bases(rots=range(4)):
    """[(asset id stem, footprint, builder, palette extra, electric)] for the idle sprite of every damageable module.
    Storage is not electrical (no sparks, wires or flicker) except the cold store and the armory's lock."""
    from . import battery, consoles, galley, hydroponics, logistics, medbay, props, robot_bay, storage_set, workbench
    from . import console_proto as C
    out = []
    env = {s[0]: s for s in props.SPRITES}
    for aid in ("module.console", "module.bed", "module.life_support", "module.reactor", "module.light"):
        _, fp, _, fn = env[aid]
        out.append((aid, fp, fn, False, aid != "module.bed"))
    for name, aid in consoles.IDS.items():
        nu, nv = C.FOOT[name]
        for r in rots:
            fp = (nv, nu) if r % 2 == 0 else (nu, nv)
            out.append((_rid(aid, r, True), fp, lambda n=name, r=r: C.console(n, r, False), True, True))
    for r in rots:
        out.append((f"module.galley.r{r}", (2, 1) if r % 2 == 0 else (1, 2), lambda r=r: galley.galley(r, False), True,
                    True))
        out.append((f"module.fabricator.r{r}", (2, 1) if r % 2 == 0 else (1, 2),
                    lambda r=r: logistics.fabricator(False, r), False, True))
        out.append((f"module.robot_bay.r{r}", (2, 1) if r % 2 else (1, 2), lambda r=r: robot_bay.build(r, ""), True,
                    True))
    out.append(("module.storage", (1, 1), lambda: logistics.storage("partial"), False, False))
    for name, (fp, fn) in storage_set.BUILDERS.items():
        for r in rots:
            f = fp if r % 2 == 0 else (fp[1], fp[0])
            out.append((f"module.storage_{name}.r{r}", f, lambda fn=fn, r=r: fn("partial", r), True,
                        name in ("cold", "armory")))
    for name, fp, fn, st in (("med_bed", (1, 2), medbay.med_bed, "idle"), ("med_console", (1, 1), medbay.med_console,
                              "idle"), ("battery", (1, 2), battery.battery, "charge2"),
                             ("hydroponics", (2, 1), hydroponics.hydroponics, "grow2"),
                             ("workbench", (2, 1), workbench.workbench, "idle")):
        for r in rots:
            f = fp if r % 2 == 0 else (fp[1], fp[0])
            out.append((f"module.{name}.r{r}", f, lambda fn=fn, r=r, st=st: fn(st, r), True, True))
    return out


def jobs(rots=range(4)):
    """Sprite jobs for `.damaged` and `.destroyed` of every base (plus `.damaged.flicker`, the frame the game alternates
    with `.damaged`, for electrical modules), and the palette pick per id. DAMAGE_ONLY=<text> keeps only the modules
    whose id contains it, for quick previews."""
    import os
    only = os.environ.get("DAMAGE_ONLY", "")
    out, extra = [], {}
    for stem, fp, fn, ex, electric in bases(rots):
        if only not in stem:
            continue
        for level in DMG + (("damaged.flicker",) if electric else ()):
            sid = f"{stem}.{level}"
            out.append((sid, fp, "prop", wrap(fn, level, sid, electric)))
            extra[sid] = ex
    return out, (lambda sid: extra.get(sid, True))
