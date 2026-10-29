"""Scene, mesh builder and renderer for the pixel-art sprite pipeline (runs inside Blender).

Frame: props are modelled in the GRID frame (gx right-down on screen, gy left-down, z up) and flipped to
Blender's y (by = -gy) on creation. Camera: orthographic, yaw 45, elevation 30 deg (2:1 needs sin(el)=0.5), so a
1x1 tile floor is exactly TILE_W x TILE_H px. 1 world unit = 1 tile = TILE_W px wide.
"""
import math
import os
import sys
import tempfile
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import palette  # noqa: E402
from . import post  # noqa: E402
from .scale import ART_SCALE, TILE_H, TILE_W  # noqa: E402,F401  (the one tile-size constant: scale.py)

PXU = TILE_W / math.sqrt(2)          # px per ortho unit
ZPX = PXU * math.cos(math.radians(30))  # px per world unit of height
TEAM_ALBEDO = 0.7                    # key albedo scale (keeps lit top faces below clipping)
# Render quality. FINAL (the default) is what ships; `npm run sprites -- ... --preview` sets SPRITE_PREVIEW=1 for a fast,
# approximate look (never commit it: sprite_cache keeps preview and final renders apart).
PREVIEW = os.environ.get("SPRITE_PREVIEW") == "1"
SS = int(os.environ.get("SPRITE_SS") or (2 if PREVIEW else 4))        # supersample factor (mode-downsampled, never blurred)
SAMPLES = int(os.environ.get("SPRITE_SAMPLES") or (1 if PREVIEW else 4))
CAM_ROT = (math.radians(60), 0, math.radians(45))
_R = np.array([0.7071068, 0.7071068, 0.0])
_U = np.array([-0.3535534, 0.3535534, 0.8660254])


def screen_xy(p):
    """Blender-space point -> (px right, px up) relative to the origin."""
    return float(np.dot(_R, p) * PXU), float(np.dot(_U, p) * PXU)


def G(x, y, z=0.0):
    return Vector((x, -y, z))


def lin(name):
    """Linear RGB of a palette name; team.* names give their pure key albedo (see post.TEAM_VEC)."""
    if name.startswith("team."):
        base, _, k = name.partition("*")
        return tuple(float(v) * TEAM_ALBEDO * (float(k) if k else 1.0) for v in post.TEAM_VEC[base])
    return palette.linear(name)


# ---- scene ------------------------------------------------------------------------------------------------

_mats = {}
_state = {}


def _material(kind, alpha=None, rim=0.0):
    """The shared attribute-driven material for a pass (kind color / glow). alpha: a see-through variant (a mix with a
    transparent shader, opacity alpha, rising by rim toward grazing angles), baked into the sprite by the render."""
    m = bpy.data.materials.new(kind if alpha is None else f"{kind}_a{alpha}_r{rim}")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")

    def attr(name):
        n = nt.nodes.new("ShaderNodeVertexColor")
        n.layer_name = name
        return n.outputs["Color"]
    if kind == "shade":                                 # (plain white diffuse: render_shadow)
        d = nt.nodes.new("ShaderNodeBsdfDiffuse")
        d.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        nt.links.new(d.outputs[0], out.inputs["Surface"])
    elif kind == "color":
        d = nt.nodes.new("ShaderNodeBsdfDiffuse")
        nt.links.new(attr("Col"), d.inputs["Color"])
        e = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(attr("Self"), e.inputs["Color"])
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(d.outputs[0], add.inputs[0])
        nt.links.new(e.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Surface"])
    else:
        e = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(attr("Glow"), e.inputs["Color"])
        nt.links.new(e.outputs[0], out.inputs["Surface"])
    if alpha is not None:
        shader = out.inputs["Surface"].links[0].from_socket
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.3
        fac = nt.nodes.new("ShaderNodeMath")
        fac.operation, fac.use_clamp = "MULTIPLY_ADD", True
        nt.links.new(lw.outputs["Facing"], fac.inputs[0])
        fac.inputs[1].default_value, fac.inputs[2].default_value = rim, alpha
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(fac.outputs[0], mix.inputs["Fac"])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(shader, mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
    m.blend_method = "BLEND" if alpha is not None else m.blend_method
    return m


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    c = sc.cycles
    c.device, c.samples, c.use_denoising, c.use_adaptive_sampling = "CPU", SAMPLES, False, False
    c.filter_width = 0.01
    c.max_bounces = 0
    c.diffuse_bounces = 0
    c.transparent_max_bounces = 12            # see-through (alpha) materials only; opaque art never uses it
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.dither_intensity = 0
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    cam.data.clip_start, cam.data.clip_end = 1, 200
    d = 60.0
    cam.rotation_euler = CAM_ROT
    cam.location = Matrix.Rotation(CAM_ROT[2], 3, "Z") @ Matrix.Rotation(CAM_ROT[0], 3, "X") @ Vector((0, 0, d))
    sc.collection.objects.link(cam)
    sc.camera = cam
    # key light: top bright, screen-left faces mid, screen-right faces dark
    ld = bpy.data.lights.new("Sun", "SUN")
    ld.use_shadow = False
    ld.energy = 3.9
    sun = bpy.data.objects.new("Sun", ld)
    L = Vector((0.25, -0.5, 0.8)).normalized()
    sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(-L).to_euler()
    sc.collection.objects.link(sun)
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    sc.world = w
    _state.update(scene=sc, cam=cam, sun=sun, world=w)
    _mats.clear()
    _mats["color"], _mats["glow"] = _material("color"), _material("glow")
    set_ambient(0.15)


def set_ambient(v, tint=(0.85, 0.95, 1.15)):
    bg = _state["world"].node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (v * tint[0], v * tint[1], v * tint[2], 1)
    bg.inputs["Strength"].default_value = 1.0


def finalize(ob):
    """Ensure Col/Self/Glow attributes and the shared material on a mesh object."""
    me = ob.data
    n = len(me.loops)
    for name in ("Col", "Self", "Glow"):
        if name not in me.color_attributes:
            a = me.color_attributes.new(name, "FLOAT_COLOR", "CORNER")
            a.data.foreach_set("color", np.tile([0, 0, 0, 1.0], n).astype(np.float32))
    me.materials.clear()
    me.materials.append(_mats["color"])


def set_attr(me, name, per_face_rgb):
    """per_face_rgb: (nfaces,3) linear."""
    lt = np.array([p.loop_total for p in me.polygons])
    arr = np.repeat(np.asarray(per_face_rgb, np.float32), lt, axis=0)
    arr = np.hstack([arr, np.ones((len(arr), 1), np.float32)])
    me.color_attributes[name].data.foreach_set("color", arr.ravel())


SHADOWS = {}            # the builder's request for the sprite being built: {"on": True} shades what the sun's
                        # shadows fall on (render_shadow, post.shade), "L": that sun's direction (towards it,
                        # Blender space; else SHADOW_L), "ramp" and "steps": the tones it steps down (post.shade),
                        # "band": px kept along what casts it (post.band; else all of it); cleared with the scene
SHADOW_L = Vector((0.25, -0.5, 0.8)).normalized()   # the key light's


def clear_scene_meshes():
    SHADOWS.clear()
    for ob in [o for o in bpy.data.objects if o.type in ("MESH", "ARMATURE", "EMPTY")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)


# ---- procedural mesh builder (grid frame) -----------------------------------------------------------------

REMAP = {}                    # palette name -> name, applied to every polygon made (a family re-toned while it builds)
TINT = None                   # a tint mask pass: the palette names the ship's colour tints (drawn TINT_KEYS[0]), the
TINT_KEYS = ("tintW", "tintK")  # rest TINT_KEYS[1], so the render is the mask (a piece's `.deco`)


def tone(color):
    """A polygon's palette name as built: REMAP's, then in a tint mask pass its key."""
    color = REMAP.get(color, color)
    if TINT is not None:
        color = TINT_KEYS[0] if color in TINT else TINT_KEYS[1]
    return color


class Mesh:
    def __init__(self, name, selflit=False, flat=False):
        """flat: every polygon is unlit (Self emission = its palette colour), so tones are exactly the palette's."""
        self.name, self.selflit, self.flat = name, selflit, flat
        self.dz = 0.0             # whole-mesh z shift applied at build (modules drop their old floor slab by this much)
        self.v, self.f = [], []   # verts (blender space), faces (idx list, col, self, glow)

    def _cols(self, color):
        c = lin(color)
        if not color.startswith("team.") and palette.emissive(color):
            if self.selflit:
                return (0, 0, 0), c, c
            dim = tuple(x * 0.18 + 0.004 for x in c)
            return dim, (0, 0, 0), tuple(x * 0.85 for x in c)
        if self.flat:
            return (0, 0, 0), c, (0, 0, 0)
        return c, (0, 0, 0), (0, 0, 0)

    def poly(self, pts, color, flip=False):
        """pts: Blender-space points."""
        color = tone(color)
        base = len(self.v)
        self.v += [tuple(p) for p in pts]
        idx = list(range(base, base + len(pts)))
        self.f.append((idx[::-1] if flip else idx, *self._cols(color)))

    def _xf(self, local, c, rz, rx, ry=0.0):
        R = Euler((rx, ry, rz), "XYZ").to_matrix()
        return R @ Vector(local) + Vector(c)

    def box(self, c, s, color, top=None, rz=0.0, rx=0.0, ry=0.0, taper=1.0, bevel=0.0, base=False):
        """Box centred at grid point c (or bottom-centred if base=True), size s=(sx,sy,sz) in grid axes."""
        if base:
            c = (c[0], c[1], c[2] + s[2] / 2)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            t = taper if v.co.z > 0 else 1.0
            v.co = Vector((v.co.x * s[0] * t, v.co.y * s[1] * t, v.co.z * s[2]))
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(s) * 0.4), segments=1, affect="EDGES")
        for f in bm.faces:
            f.normal_update()
        for f in bm.faces:
            pts = [G(*self._xf(v.co, c, rz, rx, ry)) for v in f.verts]
            # grid normal z>0.7 => top face
            nz = (Euler((rx, ry, rz), "XYZ").to_matrix() @ f.normal).z
            col = top if (top and nz > 0.7) else color
            self.poly(pts, col, flip=True)
        bm.free()

    def cyl(self, c, r, h, color, sides=8, taper=1.0, top=None, rz=0.0, base=True, rtop=None):
        if base:
            c = (c[0], c[1], c[2] + h / 2)
        rt = r * taper if rtop is None else rtop
        a0 = math.pi / sides + rz
        ring = lambda rad, z: [self._xf((rad * math.cos(a0 + i * math.tau / sides), rad * math.sin(a0 + i * math.tau / sides), z), c, 0, 0) for i in range(sides)]  # noqa: E731
        top_r, bot_r = ring(rt, h / 2), ring(r, -h / 2)
        for i in range(sides):
            j = (i + 1) % sides
            self.poly([G(*bot_r[i]), G(*bot_r[j]), G(*top_r[j]), G(*top_r[i])], color, flip=True)
        self.poly([G(*p) for p in top_r][::-1], top or color, flip=True)

    def pattern(self, o, du, dv, nu, nv, fn, flip=False):
        """Quad grid in the plane spanned by du,dv (grid-frame vectors, whole extent) from corner o."""
        o, du, dv = Vector(o), Vector(du), Vector(dv)
        for j in range(nv):
            for i in range(nu):
                col = fn(i, j)
                if col is None:
                    continue
                p = [o + du * (i / nu) + dv * (j / nv), o + du * ((i + 1) / nu) + dv * (j / nv),
                     o + du * ((i + 1) / nu) + dv * ((j + 1) / nv), o + du * (i / nu) + dv * ((j + 1) / nv)]
                pts = [G(*q) for q in p]
                self.poly(pts, col, flip=flip)

    def build(self, link=True):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([(x, y, z + self.dz) for x, y, z in self.v], [], [f[0] for f in self.f])
        me.update()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        finalize(ob)
        # normals: closed shells outward; patterns point up
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        set_attr(me, "Col", [f[1] for f in self.f])
        set_attr(me, "Self", [f[2] for f in self.f])
        set_attr(me, "Glow", [f[3] for f in self.f])
        return ob


# ---- rendering --------------------------------------------------------------------------------------------

def _set_pass(which):
    sun = _state["sun"]
    sun.hide_render = which == "glow"
    kind = which if which in ("color", "shade") else "glow"
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.data.materials:
            a = ob.get("alpha")
            key = kind if a is None else (kind, a, ob.get("rim", 0.0))
            if key not in _mats:
                _mats[key] = _material(kind, a, ob.get("rim", 0.0))
            ob.data.materials[0] = _mats[key]
    bg = _state["world"].node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 1.0 if which == "color" else 0.0


def render_shadow(W, H):
    """How much of the sun the shadows take off each sample (H*SS, W*SS), 0..1: the scene rendered (as render) in
    plain white diffuse lit by a hard-edged sun from SHADOWS["L"] (or SHADOW_L), with its shadows and without (faces
    turned from it: 0); objects flagged "noshadow" cast none."""
    sun = _state["sun"]
    ld, rot = sun.data, sun.rotation_euler.copy()
    L = Vector(SHADOWS.get("L", SHADOW_L)).normalized()
    sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(-L).to_euler()
    angle, ld.angle = ld.angle, 0.0
    quiet = [ob for ob in bpy.data.objects if ob.get("noshadow")]     # (parts casting no shadow)
    for ob in quiet:
        ob.visible_shadow = False
    try:
        ld.use_shadow = True
        a, _ = render(W, H, "shade")
        ld.use_shadow = False
        b, _ = render(W, H, "shade")
    finally:
        ld.use_shadow, ld.angle, sun.rotation_euler = False, angle, rot
        for ob in quiet:
            ob.visible_shadow = True
    a, b = a.mean(-1), b.mean(-1)
    return np.where(b > 1.0, np.clip(1.0 - a / np.maximum(b, 1e-6), 0.0, 1.0), 0.0)


def _glows():
    """True if a visible mesh has any non-black Glow colour, i.e. a glow pass could show something."""
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH" or ob.hide_render or "Glow" not in ob.data.color_attributes:
            continue
        d = ob.data.color_attributes["Glow"].data
        if not len(d):                                     # a zero-face mesh has an empty corner-domain buffer
            continue
        buf = np.empty(len(d) * 4, np.float32)
        d.foreach_get("color", buf)
        if buf.reshape(-1, 4)[:, :3].max() > 0:            # rgb only: alpha is always 1
            return True
    return False


def render(W, H, which="color", origin=None):
    """Render the scene; the world origin lands at pixel `origin` = (x, y from the top) of the WxH canvas (default:
    centre). Returns (rgb float 0..255 (H*SS,W*SS,3), alpha float 0..1). A glow pass of a scene with no Glow colour
    anywhere is all black, so it is not rendered (the alpha of a glow pass is not used)."""
    if which == "glow" and not _glows():
        return np.zeros((H * SS, W * SS, 3), np.float32), np.zeros((H * SS, W * SS), np.float32)
    sc, cam = _state["scene"], _state["cam"]
    _set_pass(which)
    sc.render.resolution_x, sc.render.resolution_y = W * SS, H * SS
    sc.render.resolution_percentage = 100
    cam.data.ortho_scale = max(W, H) / PXU
    cam.data.sensor_fit = "AUTO"
    ox, oy = origin if origin else (W / 2, H / 2)
    m = max(W, H)
    # shift is a fraction of the larger dimension; positive shift moves the view up/right (objects down/left)
    cam.data.shift_x, cam.data.shift_y = (W / 2 - ox) / m, (oy - H / 2) / m
    tmp = str(Path(tempfile.gettempdir()) / f"spr_render_{os.getpid()}.png")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "STRAIGHT"
    px = np.empty(len(img.pixels), np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    px = px.reshape(H * SS, W * SS, 4)[::-1]
    return px[..., :3] * 255.0, px[..., 3]


def extent_px(objs):
    """Max |screen x|, |screen y| (px) of the evaluated mesh vertices of objects (rest/current pose)."""
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for ob in objs:
        e = ob.evaluated_get(dg)
        me = e.to_mesh()
        mw = np.array(e.matrix_world)
        co = np.array([v.co[:] for v in me.vertices])
        if len(co):
            w = (np.c_[co, np.ones(len(co))] @ mw.T)[:, :3]
            xs.append(w @ _R * PXU)
            ys.append(w @ _U * PXU)
        e.to_mesh_clear()
    x, y = np.concatenate(xs), np.concatenate(ys)
    return x.min(), x.max(), y.min(), y.max()
