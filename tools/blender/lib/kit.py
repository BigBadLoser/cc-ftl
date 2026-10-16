"""Style kit: the faceted look of crew-lab style 2, plus bevelled plating for machines.

Coordinates are "lab space" (x right, y up, front = +z, 1 unit = 1 tile) and are given relative to the
bone/socket the part is attached to. Mesh data stays in lab space: the armature (or slot root) object is
rotated +90 deg about X in Blender, so after glTF's Y-up conversion every node has identity rotation.
Each (target, material) pair becomes one mesh object named `<target>@<item>.<material>`, with its
origin at the target's rest head so it can be re-parented to that bone/socket without any offset.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector
from . import materials, palette, vcolor


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
    """Collects parts per (target, material) and turns them into mesh objects."""

    def __init__(self, item, rest, seed=1):
        self.item, self.rest, self.seed = item, rest, seed
        self._bms = {}

    # colour spec -> (material key, linear base colour)
    def _spec(self, color):
        if isinstance(color, Tint):
            return f"team.{color.role}", (color.shade,) * 3, 1.0
        if palette.emissive(color):
            return f"emissive.{color}", palette.linear(color), 1.0
        return "base", palette.linear(color), 1.22

    def _add(self, target, geo, color, pos, r, flat_ok=True):
        key, rgb, tone = self._spec(color)
        bm, cl = self._bm(target, key)
        R = rot_lab(r)
        origin = Vector(self.rest[target])
        verts, faces = geo
        local = [Vector(pos) + R @ Vector(v) for v in verts]
        bverts = [bm.verts.new(p) for p in local]
        glow = key.startswith("emissive")
        for idx in faces:
            f = bm.faces.new([bverts[i] for i in idx])
            for lp, i in zip(f.loops, idx):
                w = origin + local[i]
                lp[cl] = (*rgb, 1.0) if glow else (*vcolor.shade(rgb, w, self.seed, tone), 1.0)

    def _bm(self, target, key):
        k = (target, key)
        if k not in self._bms:
            bm = bmesh.new()
            self._bms[k] = (bm, bm.loops.layers.float_color.new("Col"))
        return self._bms[k]

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

    def finish(self, collection=None):
        """Create mesh objects. Returns [(target, object)], object origin at the target's rest head (lab space)."""
        out = []
        coll = collection or bpy.context.scene.collection
        for (target, key), (bm, _cl) in self._bms.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            name = f"{target}@{self.item}.{key}"
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.shade_flat()
            me.materials.append(materials.get(key))
            ob = bpy.data.objects.new(name, me)
            coll.objects.link(ob)
            out.append((target, ob))
        self._bms.clear()
        return out
