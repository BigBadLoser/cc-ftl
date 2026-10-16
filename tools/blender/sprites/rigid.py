"""Rigid armour/gear pieces skinned 100% to one bone, modelled in Blender (character) frame: x lateral
(+X = character's left), y front is NEGATIVE, z up. Built against the REST pose."""
import bpy
from . import core


class Rigid(core.Mesh):
    """Mesh whose coordinates are Blender-frame (core.Mesh is grid-frame, y mirrored)."""

    def box(self, c, s, color, rz=0.0, rx=0.0, ry=0.0, **kw):
        super().box((c[0], -c[1], c[2]), s, color, rz=-rz, rx=-rx, ry=ry, **kw)

    def cyl(self, c, r, h, color, **kw):
        super().cyl((c[0], -c[1], c[2]), r, h, color, **kw)


class RigidSet:
    def __init__(self, arm):
        self.arm, self.by_bone = arm, {}

    def on(self, bone):
        return self.by_bone.setdefault(bone, Rigid(f"gear.{bone}", selflit=True))

    def build(self):
        out = []
        for bone, m in self.by_bone.items():
            ob = m.build()
            vg = ob.vertex_groups.new(name=bone)
            vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
            mod = ob.modifiers.new("Armature", "ARMATURE")
            mod.object = self.arm
            ob.parent = self.arm
            out.append(ob)
        return out
