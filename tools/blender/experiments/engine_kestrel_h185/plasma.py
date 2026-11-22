"""Additive volume with pressure cells, hot axial cores and a cooling sheath."""
import os
import bpy
from sprites import core


def apply(rot,stage=2):
    ob=bpy.data.objects.get("KESTREL_exhaust")
    if ob is None:
        return
    flame=os.environ.get("KESTREL_FLAME","now")
    name=f"KESTREL_plasma_r{rot}_s{stage}_{flame}"
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
        if flame!="now":
            strength,temperature=study(op,x,r,flame,y,z)
            return finish(nt,op,strength,temperature,ob,mat)
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


def study(op,x,r,flame,y,z):
    """Flame study variants (arc core, cyan sheath): returns (emission strength, ramp temperature)."""
    gauss=lambda q,k:op("EXPONENT",op("MULTIPLY",op("MULTIPLY",q,q),-k))
    clamp=lambda v:op("MINIMUM",op("MAXIMUM",v,0),1)
    if flame=="A":
        env=op("MAXIMUM",op("SUBTRACT",1,op("MULTIPLY",x,0.68)),0.05)
        tri=op("PINGPONG",op("ADD",op("MULTIPLY",x,7.0),0.35),1)
        cw=op("MULTIPLY",env,op("ADD",0.14,op("MULTIPLY",tri,0.34)))
        hot=op("MULTIPLY",gauss(op("DIVIDE",r,cw),2.2),op("ADD",0.35,op("MULTIPLY",op("POWER",tri,0.6),0.65)))
        core_=op("MULTIPLY",hot,op("MULTIPLY",3.6,op("SUBTRACT",1.15,x)))
        sheath=op("MULTIPLY",gauss(op("DIVIDE",r,op("MULTIPLY",env,op("ADD",0.62,op("MULTIPLY",tri,0.38)))),5.0),1.0)
        mouth=op("MULTIPLY",op("EXPONENT",op("MULTIPLY",x,-12)),op("MULTIPLY",gauss(op("DIVIDE",r,env),2.5),1.4))
        fade=op("POWER",op("MAXIMUM",op("SUBTRACT",1,x),0),0.9)
        strength=op("MULTIPLY",op("ADD",op("ADD",core_,sheath),mouth),fade)
        temp=clamp(op("SUBTRACT",op("ADD",op("MULTIPLY",op("DIVIDE",r,env),0.75),op("MULTIPLY",x,0.3)),op("MULTIPLY",hot,0.7)))
    elif flame=="B":
        env=op("MAXIMUM",op("SUBTRACT",0.62,op("MULTIPLY",x,0.42)),0.04)
        tri=op("POWER",op("PINGPONG",op("MULTIPLY",x,9.0),1),1.6)
        cw=op("MULTIPLY",env,op("ADD",0.1,op("MULTIPLY",tri,0.36)))
        hot=gauss(op("DIVIDE",r,cw),4.0)
        core_=op("MULTIPLY",hot,op("MULTIPLY",op("ADD",0.4,tri),5.0))
        halo=op("MULTIPLY",gauss(op("DIVIDE",r,op("MULTIPLY",env,op("ADD",0.55,op("MULTIPLY",tri,0.45)))),4.0),0.5)
        mouth=op("MULTIPLY",op("EXPONENT",op("MULTIPLY",x,-22)),op("MULTIPLY",gauss(r,3.0),2.2))
        fade=op("POWER",op("MAXIMUM",op("SUBTRACT",1,x),0),0.7)
        strength=op("MULTIPLY",op("ADD",op("ADD",core_,halo),mouth),fade)
        temp=clamp(op("SUBTRACT",op("ADD",op("MULTIPLY",op("DIVIDE",r,env),0.6),op("MULTIPLY",x,0.25)),op("MULTIPLY",hot,0.8)))
    else:
        env=op("MAXIMUM",op("SUBTRACT",1,op("MULTIPLY",x,0.95)),0.03)
        ang=op("ARCTAN2",z,y)
        fil=op("POWER",op("ADD",0.5,op("MULTIPLY",0.5,op("COSINE",op("ADD",op("MULTIPLY",ang,9),op("MULTIPLY",x,5))))),3)
        body=op("MULTIPLY",gauss(op("DIVIDE",r,op("MULTIPLY",env,op("ADD",0.6,op("MULTIPLY",fil,0.4)))),4.0),0.7)
        streak=op("MULTIPLY",op("MULTIPLY",fil,clamp(op("MULTIPLY",op("DIVIDE",r,env),1.6))),2.0)
        hot=gauss(op("DIVIDE",r,op("MULTIPLY",env,0.3)),2.0)
        core_=op("MULTIPLY",hot,op("MULTIPLY",3.5,op("POWER",op("MAXIMUM",op("SUBTRACT",1,x),0),1.5)))
        fade=op("POWER",op("MAXIMUM",op("SUBTRACT",1,x),0),0.6)
        strength=op("MULTIPLY",op("ADD",op("MULTIPLY",body,op("ADD",0.9,streak)),core_),fade)
        temp=clamp(op("SUBTRACT",op("ADD",op("MULTIPLY",op("DIVIDE",r,env),0.55),op("MULTIPLY",x,0.4)),op("MULTIPLY",hot,0.8)))
    return strength,temp


def finish(nt,op,strength,temperature,ob,mat):
    ramp=nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position=0
    ramp.color_ramp.elements[0].color=(*core.lin("arc"),1)
    ramp.color_ramp.elements[1].position=0.48
    ramp.color_ramp.elements[1].color=(*core.lin("cyan"),1)
    nt.links.new(temperature,ramp.inputs[0])
    volume=nt.nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Density"].default_value=0
    nt.links.new(ramp.outputs["Color"],volume.inputs["Emission Color"])
    nt.links.new(strength,volume.inputs["Emission Strength"])
    out=nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(volume.outputs[0],out.inputs["Volume"])
    ob.data.materials[0]=mat
