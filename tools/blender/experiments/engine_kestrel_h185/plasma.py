"""Additive volume with pressure cells, hot axial cores and a cooling sheath."""
import bpy
from sprites import core


def apply(rot,stage=2):
    ob=bpy.data.objects.get("KESTREL_exhaust")
    if ob is None:
        return
    name=f"KESTREL_plasma_r{rot}_s{stage}"
    mat=bpy.data.materials.get(name)
    if mat is None:
        mat=bpy.data.materials.new(name)
        mat.use_nodes=True
        nt=mat.node_tree
        nt.nodes.clear()
        def op(kind,a,b=None):
            n=nt.nodes.new("ShaderNodeMath")
            n.operation=kind
            for i,v in enumerate((a,b)):
                if v is None:
                    continue
                if isinstance(v,(int,float)):
                    n.inputs[i].default_value=v
                else:
                    nt.links.new(v,n.inputs[i])
            return n.outputs[0]
        tex=nt.nodes.new("ShaderNodeTexCoord")
        xyz=nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tex.outputs["Generated"],xyz.inputs[0])
        x=xyz.outputs["X" if rot%2 else "Y"]
        if rot in (2,3):
            x=op("SUBTRACT",1,x)
        y=op("MULTIPLY",op("SUBTRACT",xyz.outputs["Y" if rot%2 else "X"],0.5),2)
        z=op("MULTIPLY",op("SUBTRACT",xyz.outputs["Z"],0.5),2)
        r=op("SQRT",op("ADD",op("MULTIPLY",y,y),op("MULTIPLY",z,z)))
        wave=op("ADD",0.5,op("MULTIPLY",0.5,op("COSINE",op("SUBTRACT",op("MULTIPLY",x,21),0.8))))
        width=op("MULTIPLY",op("SUBTRACT",0.84 if stage>=3 else 0.68,op("MULTIPLY",x,0.5 if stage>=3 else 0.45)),
                 op("ADD",0.65,op("MULTIPLY",wave,0.35)))
        q=op("DIVIDE",r,width)
        q2=op("MULTIPLY",q,q)
        sheath=op("MULTIPLY",2.2 if stage>=3 else 0.7,op("EXPONENT",op("MULTIPLY",q2,-3)))
        if stage>=4:
            triangle=op("PINGPONG",op("ADD",op("MULTIPLY",x,6.6),0.8),1)
            core_width=op("MULTIPLY",width,op("ADD",0.06,op("MULTIPLY",triangle,0.46)))
            cq=op("DIVIDE",r,core_width)
            hot=op("MULTIPLY",op("EXPONENT",op("MULTIPLY",op("MULTIPLY",cq,cq),-2)),
                   op("POWER",triangle,0.4))
            cells=op("MULTIPLY",hot,6.0)
        else:
            cells=op("MULTIPLY",op("EXPONENT",op("MULTIPLY",q2,-4 if stage>=3 else -10)),
                     op("MULTIPLY",op("POWER",wave,5),8.0 if stage>=3 else 3.6))
        fade=op("POWER",op("MAXIMUM",op("SUBTRACT",1,x),0),0.8)
        strength=op("MULTIPLY",op("ADD",sheath,cells),fade)
        ramp=nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position=0
        ramp.color_ramp.elements[0].color=(*core.lin("arc"),1)
        ramp.color_ramp.elements[1].position=0.48
        ramp.color_ramp.elements[1].color=(*core.lin("cyan"),1)
        temperature=(op("SUBTRACT",1,hot) if stage>=4 else
                     op("ADD",op("MULTIPLY",q,0.5),op("MULTIPLY",x,0.15)))
        nt.links.new(temperature,ramp.inputs[0])
        volume=nt.nodes.new("ShaderNodeVolumePrincipled")
        volume.inputs["Density"].default_value=0
        nt.links.new(ramp.outputs["Color"],volume.inputs["Emission Color"])
        nt.links.new(strength,volume.inputs["Emission Strength"])
        out=nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(volume.outputs[0],out.inputs["Volume"])
    ob.data.materials[0]=mat
