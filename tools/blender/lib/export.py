"""glTF export: binary, Y-up, modifiers applied, no cameras/lights, vertex colours kept."""
import json
import struct
import bpy
from . import materials, palette


def export_glb(path, objects, animations=False):
    """Export exactly `objects` (and their animation if asked) to a .glb."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials="EXPORT", export_image_format="NONE",
        export_texcoords=False, export_normals=True, export_tangents=False, export_extras=False,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_animations=animations, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_optimize_animation_size=True, export_anim_single_armature=True,
        export_skins=False, export_def_bones=False, export_leaf_bone=False, export_armature_object_remove=False,
    )
    patch_team_factors(path)


def clear_scene():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            coll.remove(item)


def patch_team_factors(path):
    """Blender's exporter drops the tint of vertex-colour x factor materials: write the default `team.*` tints
    into baseColorFactor so the file is self-describing (the runtime overrides them per crew member)."""
    data = bytearray(open(path, "rb").read())
    jlen = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + jlen])
    for m in doc.get("materials", []):
        kind, _, role = m["name"].partition(".")
        if kind == "team":
            m["pbrMetallicRoughness"]["baseColorFactor"] = [*palette.linear(materials.TEAM_DEFAULTS[role]), 1.0]
    blob = json.dumps(doc, separators=(",", ":")).encode()
    blob += b" " * (-len(blob) % 4)
    rest = bytes(data[20 + jlen:])
    out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(blob) + len(rest)) + struct.pack("<I4s", len(blob), b"JSON") + blob + rest
    open(path, "wb").write(out)
