"""The exhaust: an additive volume drawn as a long jet (a white-hot arc core that cools to cyan, feathered edges).

Worked in tile units on the exhaust envelope's Generated coordinates: d along the thrust axis from the bell mouth
(u = 3.88), rho off it. The envelope is model.FLAME; the flame renders as its own sprite (`<asset>.flame.r{n}`).
"""
import sys
import bpy
from sprites import core

MOUTH = 3.88    # u of the bell mouth


def apply(rot, stage=2):
    ob = bpy.data.objects.get("KESTREL_exhaust")
    if ob is None:
        return
    name = f"KESTREL_plasma_r{rot}"
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        strength, temperature = _jet(nt, rot)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0
        ramp.color_ramp.elements[0].color = (*core.lin("arc"), 1)
        ramp.color_ramp.elements[1].position = 0.48
        ramp.color_ramp.elements[1].color = (*core.lin("cyan"), 1)
        nt.links.new(temperature, ramp.inputs[0])
        volume = nt.nodes.new("ShaderNodeVolumePrincipled")
        volume.inputs["Density"].default_value = 0
        nt.links.new(ramp.outputs["Color"], volume.inputs["Emission Color"])
        nt.links.new(strength, volume.inputs["Emission Strength"])
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(volume.outputs[0], out.inputs["Volume"])
    ob.data.materials[0] = mat


def _jet(nt, rot):
    """(emission strength, ramp temperature: 0 arc, 0.48+ cyan) sockets of the jet."""
    def op(kind, a, b=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = kind
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]
    tex = nt.nodes.new("ShaderNodeTexCoord")
    xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tex.outputs["Generated"], xyz.inputs[0])
    x = xyz.outputs["X" if rot % 2 else "Y"]
    if rot in (2, 3):
        x = op("SUBTRACT", 1, x)
    y = op("MULTIPLY", op("SUBTRACT", xyz.outputs["Y" if rot % 2 else "X"], 0.5), 2)
    z = op("MULTIPLY", op("SUBTRACT", xyz.outputs["Z"], 0.5), 2)
    r = op("SQRT", op("ADD", op("MULTIPLY", y, y), op("MULTIPLY", z, z)))

    prof = sys.modules["model"].FLAME
    u0, u1 = prof[0][0], prof[-1][0]
    rmax = max(p[1] for p in prof)
    d = op("SUBTRACT", op("MULTIPLY", x, u1 - u0), MOUTH - u0)
    dp = op("MAXIMUM", d, 0)
    rho = op("MULTIPLY", r, rmax)
    gauss = lambda q, k: op("EXPONENT", op("MULTIPLY", op("MULTIPLY", q, q), -k))
    decay = lambda k: op("EXPONENT", op("MULTIPLY", dp, -1 / k))
    clamp = lambda v: op("MINIMUM", op("MAXIMUM", v, 0), 1)

    def noise(sx, sr, scale, detail=4):
        vec = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(op("MULTIPLY", d, sx), vec.inputs[0])
        nt.links.new(op("MULTIPLY", op("MULTIPLY", y, rmax), sr), vec.inputs[1])
        nt.links.new(op("MULTIPLY", op("MULTIPLY", z, rmax), sr), vec.inputs[2])
        tx = nt.nodes.new("ShaderNodeTexNoise")
        tx.inputs["Scale"].default_value = scale
        tx.inputs["Detail"].default_value = detail
        nt.links.new(vec.outputs[0], tx.inputs["Vector"])
        return tx.outputs["Fac"]

    L = u1 - MOUTH
    t = clamp(op("DIVIDE", dp, L))                                                       # 0 at the mouth, 1 at the tip
    end = op("SUBTRACT", 1, op("POWER", t, 2.2))                                           # fades out over its back half
    taper = op("SUBTRACT", 1, op("MULTIPLY", op("POWER", t, 1.6), 0.55))                  # narrows to a point, no blob
    cw = op("MULTIPLY", op("ADD", 0.45, op("MULTIPLY", dp, 0.035)), taper)                # the core's width
    hot = gauss(op("DIVIDE", rho, cw), 2.0)
    feather = op("ADD", 0.5, op("MULTIPLY", noise(0.25, 0.9, 1.8), 1.0))
    sw = op("MULTIPLY", op("MULTIPLY", op("ADD", 0.8, op("MULTIPLY", dp, 0.09)), feather), taper)
    sheath = gauss(op("DIVIDE", rho, sw), 2.2)
    strength = op("MULTIPLY", op("MULTIPLY", op("ADD", op("MULTIPLY", hot, op("MULTIPLY", 0.75, feather)),
                                                op("MULTIPLY", sheath, 0.16)), decay(14.0)), end)
    # White at the core near the mouth, cooling to cyan outward and downstream.
    temperature = clamp(op("SUBTRACT", op("ADD", op("MULTIPLY", op("DIVIDE", rho, op("MULTIPLY", cw, 2.2)), 0.5),
                                          op("MULTIPLY", dp, 0.07)),
                           op("MULTIPLY", op("MULTIPLY", hot, decay(5.0)), 0.6)))
    return strength, temperature
