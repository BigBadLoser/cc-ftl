"""Material conventions: one shared material per role, name carries meaning.

  base               vertex-coloured, flat, rough (all fixed-colour parts)
  emissive.<name>    glows (palette entries with an "emissive" strength)
  team.<role>        factor-tinted; vertex colours carry only grey shading. The runtime recolours
                     it per crew member (skin, hair, cloth, accent...).
"""
import bpy
from . import palette

TEAM_DEFAULTS = {"skin": "skin", "hair": "hair", "cloth": "jacket", "accent": "hivis"}


def _new(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.88
    bsdf.inputs["Metallic"].default_value = 0.12
    return m, nt, bsdf


def _vcol(nt):
    n = nt.nodes.new("ShaderNodeVertexColor")
    n.layer_name = "Col"
    return n


def get(key):
    """Fetch (creating once) the shared material for a key like 'base', 'emissive.cyan', 'team.skin'."""
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    m, nt, bsdf = _new(key)
    kind, _, role = key.partition(".")
    if kind == "base":
        nt.links.new(_vcol(nt).outputs["Color"], bsdf.inputs["Base Color"])
    elif kind == "emissive":
        c = (*palette.linear(role), 1)
        bsdf.inputs["Base Color"].default_value = c
        bsdf.inputs["Emission Color"].default_value = c
        bsdf.inputs["Emission Strength"].default_value = palette.emissive(role) or 1.0
        bsdf.inputs["Roughness"].default_value = 0.5
    elif kind == "team":
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (*palette.linear(TEAM_DEFAULTS[role]), 1)
        nt.links.new(_vcol(nt).outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        raise KeyError(key)
    return m
