"""glTF export: binary, Y-up, modifiers applied, no cameras/lights, vertex colours kept."""
import bpy


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


def clear_scene():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            coll.remove(item)
