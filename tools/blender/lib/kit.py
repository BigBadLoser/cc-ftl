"""Style kit: the faceted look of crew-lab style 2, plus bevelled plating for machines.

Coordinates are "lab space" (x right, y up, front = +z, 1 unit = 1 tile) and are given relative to the
bone/socket the part is attached to. Mesh data stays in lab space: the armature (or slot root) object is
rotated +90 deg about X in Blender, so after glTF's Y-up conversion every node has identity rotation.
Rigid mode: each (target, material) pair becomes one mesh object named `<target>@<item>.<material>`, origin at
the target's rest head, so it can be re-parented to that bone/socket without any offset.
Skinned mode: one mesh per material named `skin@<item>.<material>` in armature space with vertex groups named
after the bones (weights from lib.skinning), for soft parts (body, flesh, clothing).
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector
from . import materials, palette, skinning, vcolor


def rot_lab(r):
    """Euler (three.js XYZ order, radians) -> 3x3 matrix in lab space."""
    if not r:
        return Matrix.Identity(3)
    return Matrix.Rotation(r[0], 3, "X") @ Matrix.Rotation(r[1], 3, "Y") @ Matrix.Rotation(r[2], 3, "Z")


class Tint:
    """A recolourable part: colour comes from the shared `team.<role>` material; `shade` is a grey multiplier."""

    def __init__(self, role, shade=1.0):
        self.role, self.shade = role, shade


def skin(shade=1.0): return Tint("skin", shade)
def hair(shade=1.0): return Tint("hair", shade)
def cloth(shade=1.0): return Tint("cloth", shade)
def accent(shade=1.0): return Tint("accent", shade)


# ---- raw geometry: (verts, faces) in lab-local space, centred on the origin -------------------------------

def prism_geo(sides, w, h, d, taper):
    """Faceted prism: top radius 0.5, bottom radius 0.5*taper, vertex pointing to +z, x stretched 1.1 (lab rule)."""
    top, bot = [], []
    for i in range(sides):
        a = i / sides * math.tau
        s, c = math.sin(a), math.cos(a)
        top.append((w * 1.1 * 0.5 * s, h / 2, d * 0.5 * c))
        bot.append((w * 1.1 * 0.5 * taper * s, -h / 2, d * 0.5 * taper * c))
    faces = [list(range(sides)), list(range(sides, 2 * sides))]
    faces += [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    return top + bot, faces


def ball_geo(w, h, d):
    """Faceted ellipsoid (icosphere, 80 faces; 20 for tiny parts)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2 if max(w, h, d) >= 0.07 else 1, radius=0.5)
    verts = [(v.co.x * w, v.co.y * h, v.co.z * d) for v in bm.verts]
    bm.verts.ensure_lookup_table()
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def box_geo(w, h, d, bevel=0.0, taper=1.0):
    """Box with optional uniform edge chamfer (bevel width, clamped) and bottom taper."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        t = taper if v.co.y < 0 else 1.0
        v.co = Vector((v.co.x * w * t, v.co.y * h, v.co.z * d * t))
    if bevel > 0:
        amt = min(bevel, min(w, h, d) * 0.35)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=amt, offset_type="OFFSET", segments=1, affect="EDGES")
    bm.verts.ensure_lookup_table()
    verts = [tuple(v.co) for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


# ---- the builder ----------------------------------------------------------------------------------------------

class Builder:
    """Collects parts per (target, material) and turns them into mesh objects.

    `tscale` maps a target to a uniform scale applied to every part on it (positions and sizes), so a part
    list authored for one head size can be reused for another.
    """

    def __init__(self, item, rest, seed=1, skinned=False, tscale=None):
        self.item, self.rest, self.seed, self.skinned = item, rest, seed, skinned
        self.tscale = tscale or {}
        self._bms = {}

    def _spec(self, color):
        if isinstance(color, Tint):
            return f"team.{color.role}", (color.shade,) * 3, 1.0
        if palette.emissive(color):
            return f"emissive.{color}", palette.linear(color), 1.0
        return "base", palette.linear(color), 1.22

    def _bm(self, target, key):
        k = ("skin" if self.skinned else target, key)
        if k not in self._bms:
            bm = bmesh.new()
            self._bms[k] = (bm, bm.loops.layers.float_color.new("Col"), bm.verts.layers.deform.verify())
        return self._bms[k]

    def _add(self, target, geo, color, pos, r):
        key, rgb, tone = self._spec(color)
        bm, cl, dl = self._bm(target, key)
        k = self.tscale.get(target, 1.0)
        R = rot_lab(r)
        origin = Vector(self.rest[target])
        verts, faces = geo
        local = [Vector(pos) * k + R @ (Vector(v) * k) for v in verts]
        off = origin if self.skinned else Vector()
        bverts = [bm.verts.new(p + off) for p in local]
        if self.skinned:
            for bv, p in zip(bverts, local):
                for bone, w in skinning.weights(target, origin + p).items():
                    bv[dl][skinning.INDEX[bone]] = w
        glow = key.startswith("emissive")
        for idx in faces:
            f = bm.faces.new([bverts[i] for i in idx])
            for lp, i in zip(f.loops, idx):
                w = origin + local[i]
                lp[cl] = (*rgb, 1.0) if glow else (*vcolor.shade(rgb, w, self.seed, tone), 1.0)

    def prism(self, target, kind, w, h, d, color, p=(0, 0, 0), r=None, taper=None):
        """kind 'box' = hexagonal prism, 'limb' = tapered pentagonal prism (the lab's two prism kinds)."""
        sides = 6 if kind == "box" else 5
        t = taper if taper is not None else (0.8 if kind == "limb" else 0.92)
        self._add(target, prism_geo(sides, w, h, d, t), color, p, r)

    def ball(self, target, w, h, d, color, p=(0, 0, 0), r=None):
        self._add(target, ball_geo(w, h, d), color, p, r)

    def box(self, target, w, h, d, color, p=(0, 0, 0), r=None, chamfer=0.0, taper=1.0):
        self._add(target, box_geo(w, h, d, chamfer, taper), color, p, r)

    def plate(self, target, w, h, d, color, p=(0, 0, 0), r=None, bevel=0.012, taper=1.0):
        """Bevelled plating for mechanical parts (style 3's idea): a crisp chamfered slab."""
        self._add(target, box_geo(w, h, d, bevel, taper), color, p, r)

    def finish(self, arm=None):
        """Create mesh objects. Returns [(target, object)]; skinned objects get vertex groups, an Armature
        modifier on `arm` and are parented to it."""
        out = []
        coll = bpy.context.scene.collection
        for (target, key), (bm, _cl, _dl) in self._bms.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            name = f"skin@{self.item}.{key}" if self.skinned else f"{target}@{self.item}.{key}"
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.shade_flat()
            me.materials.append(materials.get(key))
            me.color_attributes.active_color = me.color_attributes["Col"]
            ob = bpy.data.objects.new(name, me)
            ob.rotation_euler = (math.pi / 2, 0, 0)  # see module doc; keeps standalone nodes consistent with bone children
            coll.objects.link(ob)
            if self.skinned:
                for bone in skinning.ORDER:
                    ob.vertex_groups.new(name=bone)
                if arm is not None:
                    mod = ob.modifiers.new("Armature", "ARMATURE")
                    mod.object = arm
                    ob.parent = arm
                    ob.matrix_world = arm.matrix_world
            out.append((target, ob))
        self._bms.clear()
        return out
