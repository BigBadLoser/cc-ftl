"""Rigid-body kit for the robot crew: smooth-shaded primitives on a joint rig (runs inside Blender).

Robots are machines, so they are not skinned: every part is a rigid mesh parented to a joint empty, and clips pose
the joints. Parts are modelled in the REST pose in the character frame (x = the robot's right, f = forward, z up,
1 unit = 1 tile) and converted to Blender (x' = -x, y' = -f; the character faces Blender -Y at azimuth 0, as the human
crew do). Curved sides are smooth shaded and caps are split from them, so the quantiser makes clean bands, never facets.
Colours follow core.Mesh: palette names, `team.*` keys (palette swap: faction livery) and emissive names (glow sheet)."""
import math
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from . import core

_C = core.Mesh("robot.colours")      # emissive parts: dim base colour + full glow (additive at runtime)
Z_UP = Matrix.Identity(3)
AXES = {"z": Z_UP, "x": Matrix.Rotation(math.pi / 2, 3, "Y"), "f": Matrix.Rotation(-math.pi / 2, 3, "X")}


def bl(p):
    """Character frame (x right, f forward, z) -> Blender."""
    return Vector((-p[0], -p[1], p[2]))


def _rr(w, d, r, seg):
    """Rounded-rectangle outline (w x d, corner radius r) as 2D points, counter-clockwise."""
    r = max(0.0, min(r, w / 2 - 1e-4, d / 2 - 1e-4))
    pts = []
    for k, (cx, cy) in enumerate(((w / 2 - r, d / 2 - r), (-w / 2 + r, d / 2 - r), (-w / 2 + r, -d / 2 + r), (w / 2 - r, -d / 2 + r))):
        for i in range(seg + 1):
            a = math.pi / 2 * (k + i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


class Part:
    """One rigid mesh on one joint."""

    def __init__(self, name, joint):
        self.name, self.joint = name, joint
        self.v, self.f = [], []           # verts (character frame, rest world), faces (idx, col, self, glow, smooth)
        self.obj = None

    def _xf(self, c, rot, axis):
        R = Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix() if rot else Z_UP
        M = R @ AXES[axis]
        return lambda p: tuple(M @ Vector(p) + Vector(c))

    def _face(self, idx, color, smooth):
        self.f.append((idx, *_C._cols(color), smooth))

    def _ring(self, pts2, z, s, xf):
        base = len(self.v)
        self.v += [xf((x * s, y * s, z)) for x, y in pts2]
        return base

    def _loft(self, pts2, h, color, top, taper, xf, cap0=True, smooth=True, bottom=None):
        n = len(pts2)
        a, b = self._ring(pts2, -h / 2, 1.0, xf), self._ring(pts2, h / 2, taper, xf)
        for i in range(n):
            j = (i + 1) % n
            self._face([a + i, a + j, b + j, b + i], color, smooth)
        t = self._ring(pts2, h / 2, taper, xf)              # caps on their own verts: flat, no smearing into the sides
        self._face([t + i for i in range(n)], top or color, False)
        if cap0:
            u = self._ring(pts2, -h / 2, 1.0, xf)
            self._face([u + i for i in range(n)][::-1], bottom or color, False)

    def rbox(self, c, s, color, r=0.04, top=None, axis="z", rot=None, taper=1.0, seg=3, bottom=None):
        """Rounded box: size s = (w, d, h) across x, f and along the axis; rounded edges run along the axis."""
        w, d, h = s
        self._loft(_rr(w, d, r, seg), h, color, top, taper, self._xf(c, rot, axis), bottom=bottom)

    def box(self, c, s, color, rot=None):
        """Sharp flat-shaded box (small details)."""
        self._loft(_rr(s[0], s[1], 0, 1)[::2][:4], s[2], color, None, 1.0, self._xf(c, rot, "z"), smooth=False)

    def cyl(self, c, r, h, color, axis="z", rot=None, sides=20, taper=1.0, top=None):
        pts = [(r * math.cos(math.tau * i / sides), r * math.sin(math.tau * i / sides)) for i in range(sides)]
        self._loft(pts, h, color, top, taper, self._xf(c, rot, axis))

    def ball(self, c, r, color, rot=None, segs=16, rings=10, z0=-1.0):
        """Ellipsoid with radii r = (rx, rf, rz); z0 > -1 cuts it flat below (a dome; the cut gets a flat cap)."""
        rx, rf, rz = (r, r, r) if isinstance(r, (int, float)) else r
        xf = self._xf(c, rot, "z")
        lo = math.asin(max(-1.0, min(1.0, z0)))
        rows = []
        for k in range(rings + 1):
            phi = lo + (math.pi / 2 - lo) * k / rings
            rows.append(self._ring([(math.cos(math.tau * i / segs), math.sin(math.tau * i / segs)) for i in range(segs)],
                                   0, 1, lambda p, phi=phi: xf((p[0] * rx * math.cos(phi), p[1] * rf * math.cos(phi), rz * math.sin(phi)))))
        for k in range(rings):
            for i in range(segs):
                j = (i + 1) % segs
                self._face([rows[k] + i, rows[k] + j, rows[k + 1] + j, rows[k + 1] + i], color, True)
        if z0 > -1:
            u = self._ring([(math.cos(math.tau * i / segs), math.sin(math.tau * i / segs)) for i in range(segs)], 0, 1,
                           lambda p: xf((p[0] * rx * math.cos(lo), p[1] * rf * math.cos(lo), rz * math.sin(lo))))
            self._face([u + i for i in range(segs)][::-1], color, False)

    def build(self, pivot):
        me = bpy.data.meshes.new(self.name)
        p = Vector(pivot)
        me.from_pydata([tuple(bl(v) - p) for v in self.v], [], [f[0] for f in self.f])
        me.update()
        me.polygons.foreach_set("use_smooth", [bool(f[4]) for f in self.f])
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        core.finalize(ob)
        core.set_attr(me, "Col", [f[1] for f in self.f])
        core.set_attr(me, "Self", [f[2] for f in self.f])
        core.set_attr(me, "Glow", [f[3] for f in self.f])
        self.obj = ob
        return ob


class Rig:
    """Joint tree of empties. joint(name, parent, pivot) takes the rest pivot in the character frame."""

    def __init__(self, name):
        self.name = name
        self.root = bpy.data.objects.new(f"{name}.root", None)
        bpy.context.scene.collection.objects.link(self.root)
        self.root.rotation_mode = "XYZ"
        self.joints = {"root": (self.root, Vector((0, 0, 0)))}
        self._rest = {"root": Vector((0, 0, 0))}
        self._parent, self._loose = {}, set()
        self.parts, self.tags = [], {}

    def joint(self, name, parent, pivot):
        e = bpy.data.objects.new(f"{self.name}.{name}", None)
        bpy.context.scene.collection.objects.link(e)
        pe, pp = self.joints[parent]
        e.parent = pe
        e.location = bl(pivot) - pp
        e.rotation_mode = "XYZ"
        self.joints[name] = (e, bl(pivot))
        self._rest[name] = e.location.copy()
        self._parent[name] = pe
        return name

    def part(self, joint, tag=None):
        p = Part(f"{self.name}.{joint}.{len(self.parts)}", joint)
        self.parts.append(p)
        if tag:
            self.tags.setdefault(tag, []).append(p)
        return p

    def build(self):
        for p in self.parts:
            je, jp = self.joints[p.joint]
            ob = p.build(jp)
            ob.parent = je

    def objects(self, tag=None):
        return [p.obj for p in (self.tags.get(tag, []) if tag else self.parts)]

    def show(self, tag, on):
        for ob in self.objects(tag):
            ob.hide_render = not on

    # ---- posing -------------------------------------------------------------------------------------------------
    def rest(self):
        """Rest pose (keeps the root's facing); detached joints go back on their parents."""
        for n in self._loose:
            self.joints[n][0].parent = self._parent[n]
        self._loose.clear()
        for n, (e, _) in self.joints.items():
            e.location = self._rest[n]
            if n != "root":
                e.rotation_euler = (0, 0, 0)

    def rot(self, joint, pitch=0.0, roll=0.0, yaw=0.0):
        """Degrees. pitch > 0 tips the part's top forward (a hanging limb swings BACK), roll > 0 tips it to the robot's
        left, yaw > 0 turns it to the robot's left."""
        self.joints[joint][0].rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw))

    def shift(self, joint, dx=0.0, df=0.0, dz=0.0):
        e = self.joints[joint][0]
        e.location = e.location + bl((dx, df, dz))

    def min_z(self, objs=None):
        bpy.context.view_layer.update()
        lo = 1e9
        for ob in objs or self.objects():
            if ob.hide_render:
                continue
            n = len(ob.data.vertices)
            co = np.empty(n * 3, np.float32)
            ob.data.vertices.foreach_get("co", co)
            mw = np.array(ob.matrix_world)
            w = np.c_[co.reshape(-1, 3), np.ones(n)] @ mw.T
            lo = min(lo, float(w[:, 2].min()))
        return lo

    def ground(self, objs=None, height=0.0):
        """Shift the root so the lowest point of `objs` (default: every visible part) sits at `height`."""
        self.root.location.z += height - self.min_z(objs)

    def subtree(self, joint):
        e = self.joints[joint][0]
        out = {joint}
        for n, (je, _) in self.joints.items():
            p = je.parent
            while p is not None:
                if p is e:
                    out.add(n)
                    break
                p = p.parent
        return out

    def detach(self, joint, at, rot=(0.0, 0.0, 0.0)):
        """Knock a joint (and everything on it) off: it lies at `at` (character frame, from the root) with Euler `rot`
        (degrees). Ground the rest with ground_attached(), then drop() it onto the floor (the root is only ever yawed)."""
        e = self.joints[joint][0]
        e.parent = self.root
        e.location = bl(at)
        e.rotation_euler = tuple(math.radians(a) for a in rot)
        self._loose.add(joint)

    def loose_objects(self):
        sub = set().union(*(self.subtree(j) for j in self._loose)) if self._loose else set()
        return [p.obj for p in self.parts if p.joint in sub]

    def drop(self, joint):
        """Rest a detached joint's parts on the floor."""
        sub = self.subtree(joint)
        self.joints[joint][0].location.z -= self.min_z([p.obj for p in self.parts if p.joint in sub]) / self.root.scale.z

    def ground_attached(self, height=0.0):
        loose = set(self.loose_objects())
        self.ground([o for o in self.objects() if o not in loose], height)
