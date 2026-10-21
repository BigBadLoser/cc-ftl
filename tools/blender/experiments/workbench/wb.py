"""Workbench stand-in for core.render (experiment, runs inside Blender): same signature and return values, so the whole
sprite pipeline (env_build, human_render, post) runs unchanged on top of it.

Cycles here is a pure diffuse sun plus a uniform ambient, no shadows, no bounces. That is a view-space function of the
normal, so Workbench reproduces it with a matcap generated from the same numbers (no real lamps needed). Three cheap passes:
  lit   MATCAP light, vertex colour Col (albedo, scaled)        diffuse term
  self  FLAT light, vertex colour Self                            emission term (added in linear light, like Cycles' Add Shader)
  id    FLAT, per-object colour, items vs holdout objects         Workbench has no holdout: items hidden behind one are masked out
Glow is one FLAT pass of the Glow attribute. Sees no ambient occlusion (Cycles' world light is occluded a little), no
see-through (alpha) materials. Output is the same (rgb float 0..255 (H*SS,W*SS,3), alpha 0..1) core.render returns."""
import math
import os
import tempfile
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from sprites import core

SUN, AMB, TINT = 3.9, 0.15, (0.85, 0.95, 1.15)
K = 1.6                                    # matcap = lighting / K (it must stay <= 1); the albedo attribute is scaled by K
_state = {}


def _srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)


def _matcap_path(sun=SUN, amb=AMB):
    """RGB matcap of Lambert(sun) + ambient for the pipeline camera, as an sRGB PNG (Workbench decodes it to linear)."""
    n = 512
    cam = core.CAM_ROT
    from mathutils import Euler
    rot = Euler(cam).to_matrix()                                   # camera -> world
    L = Vector((0.25, -0.5, 0.8)).normalized()
    Lv = rot.inverted() @ L                                        # light direction in view space (x right, y up, z to camera)
    u = (np.arange(n) + 0.5) / n * 2 - 1
    x, y = np.meshgrid(u, -u)
    r2 = x * x + y * y
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    nl = np.clip(x * Lv.x + y * Lv.y + z * Lv.z, 0, None)
    lin = np.stack([amb * TINT[c] + sun / math.pi * nl for c in range(3)], -1) / K
    img = np.clip(_srgb(np.clip(lin, 0, 1)), 0, 1)
    p = Path(tempfile.gettempdir()) / f"wb_matcap_{os.getpid()}.png"
    im = bpy.data.images.new("wbmatcap", n, n, alpha=False)
    im.pixels.foreach_set(np.dstack([img, np.ones((n, n, 1))]).astype(np.float32).ravel())
    im.filepath_raw, im.file_format = str(p), "PNG"
    im.save()
    bpy.data.images.remove(im)
    return str(p)


def setup():
    sc = bpy.context.scene
    sl = bpy.context.preferences.studio_lights.load(_matcap_path(), "MATCAP")
    _state.update(sl=sl, sc=sc)
    d = sc.display
    d.render_aa = "OFF"
    d.shading.show_object_outline = False
    d.shading.show_cavity = False
    d.shading.show_shadows = False
    d.shading.show_specular_highlight = False
    d.shading.light = "MATCAP"
    d.shading.studio_light = sl.name
    sc.render.film_transparent = True
    sc.render.dither_intensity = 0


def _meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]


def _attr(ob, name):
    me = ob.data
    if name in me.color_attributes:
        me.color_attributes.active_color = me.color_attributes[name]
        me.color_attributes.render_color_index = me.color_attributes.find(name)


def _pass(W, H, origin, light, attr, scale=1.0, view="Raw", objcolor=None, hide_holdouts=True):
    sc = _state["sc"]
    d = sc.display.shading
    d.light = light
    d.color_type = "OBJECT" if objcolor else "VERTEX"
    sc.view_settings.view_transform = view
    saved = []
    for ob in _meshes():
        if hide_holdouts and ob.is_holdout:
            saved.append((ob, ob.hide_render))
            ob.hide_render = True
            continue
        if objcolor:
            ob.color = objcolor(ob)
        else:
            _attr(ob, attr)
    tmp = str(Path(tempfile.gettempdir()) / f"wb_{os.getpid()}.exr")
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    for ob, h in saved:
        ob.hide_render = h
    img = bpy.data.images.load(tmp)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "STRAIGHT"
    px = np.empty(len(img.pixels), np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(H * core.SS, W * core.SS, 4)[::-1]


def render(W, H, which="color", origin=None):
    sc, cam = core._state["scene"], core._state["cam"]
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x, sc.render.resolution_y = W * core.SS, H * core.SS
    sc.render.resolution_percentage = 100
    cam.data.ortho_scale = max(W, H) / core.PXU
    cam.data.sensor_fit = "AUTO"
    ox, oy = origin if origin else (W / 2, H / 2)
    m = max(W, H)
    cam.data.shift_x, cam.data.shift_y = (W / 2 - ox) / m, (oy - H / 2) / m
    try:
        if which == "glow":
            p = _pass(W, H, origin, "FLAT", "Glow", view="Standard")
            return p[..., :3] * 255.0, p[..., 3]
        lit = _pass(W, H, origin, "MATCAP", "Col")
        slf = _pass(W, H, origin, "FLAT", "Self")
        lin = lit[..., :3] * K * 1.0 + slf[..., :3]
        # Cycles' Col is albedo, WB multiplies the matcap (lighting / K) by the colour: scale back by K (done above)
        a = lit[..., 3]
        a = np.maximum(a, slf[..., 3])
        if any(o.is_holdout for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render):
            ids = _pass(W, H, origin, "FLAT", None, objcolor=lambda o: (0, 1, 0, 1) if o.is_holdout else (1, 0, 0, 1),
                        hide_holdouts=False)
            a = np.where(ids[..., 1] > ids[..., 0] + 0.5, 0.0, a)          # a holdout is nearer: not visible
        out = _srgb(np.clip(lin, 0, 1)) * 255.0
        return out, a
    finally:                                           # leave the scene as core.setup_scene made it
        sc.render.engine = "CYCLES"
        sc.render.image_settings.file_format = "PNG"
        sc.render.image_settings.color_depth = "8"
        sc.view_settings.view_transform = "Standard"
