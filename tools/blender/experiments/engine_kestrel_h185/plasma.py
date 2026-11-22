"""Additive volume with pressure cells, hot axial cores and a cooling sheath."""
import os
import sys
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
            strength,temperature=study(op,x,r,flame,y,z,nt)
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


def study(op,x,r,flame,y,z,nt):
    """Flame study variants (arc core, cyan sheath) in tile units: d along the axis from the bell mouth, rho off it.
    Returns (emission strength, ramp temperature)."""
    prof=sys.modules["model"].FLAMES[flame]
    u0,u1=prof[0][0],prof[-1][0]
    rmax=max(p[1] for p in prof)
    d=op("SUBTRACT",op("MULTIPLY",x,u1-u0),3.88-u0)
    dp=op("MAXIMUM",d,0)
    rho=op("MULTIPLY",r,rmax)
    gauss=lambda q,k:op("EXPONENT",op("MULTIPLY",op("MULTIPLY",q,q),-k))
    decay=lambda k:op("EXPONENT",op("MULTIPLY",dp,-1/k))
    clamp=lambda v:op("MINIMUM",op("MAXIMUM",v,0),1)
    def noise(sx,sr,scale,detail=4):
        vec=nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(op("MULTIPLY",d,sx),vec.inputs[0])
        nt.links.new(op("MULTIPLY",op("MULTIPLY",y,rmax),sr),vec.inputs[1])
        nt.links.new(op("MULTIPLY",op("MULTIPLY",z,rmax),sr),vec.inputs[2])
        tx=nt.nodes.new("ShaderNodeTexNoise")
        tx.inputs["Scale"].default_value=scale
        tx.inputs["Detail"].default_value=detail
        nt.links.new(vec.outputs[0],tx.inputs["Vector"])
        return tx.outputs["Fac"]
    end=op("POWER",clamp(op("MULTIPLY",op("SUBTRACT",u1-3.88,d),0.22)),1.5)          # fade out before the envelope's end
    def plume(k):
        # Flares from the mouth radius to ~3.2 tiles; streaks along the axis; slow fade.
        R=op("ADD",1.05,op("MULTIPLY",2.2,op("SUBTRACT",1,decay(2.2))))
        streak=op("POWER",op("MULTIPLY",noise(0.1,1.3,1.6),1.8),3.5)
        edge=op("ADD",0.75,op("MULTIPLY",noise(0.35,0.6,2.2),0.5))
        body=gauss(op("DIVIDE",rho,op("MULTIPLY",R,edge)),2.4)
        hotmouth=op("MULTIPLY",decay(0.9),op("MULTIPLY",gauss(op("DIVIDE",rho,1.0),1.5),2.5))
        s=op("ADD",op("MULTIPLY",op("MULTIPLY",body,op("ADD",0.15,streak)),op("MULTIPLY",decay(3.2),op("MULTIPLY",k,0.3))),hotmouth)
        t=clamp(op("SUBTRACT",op("ADD",op("MULTIPLY",op("DIVIDE",rho,R),0.45),op("MULTIPLY",dp,0.04)),
                              op("MULTIPLY",decay(0.9),0.6)))
        return s,t
    def jet(k):
        # A long white-hot core, widening slowly, with feathered, puffing edges.
        cw=op("ADD",0.5,op("MULTIPLY",dp,0.05))
        hot=gauss(op("DIVIDE",rho,cw),2.0)
        feather=op("ADD",0.5,op("MULTIPLY",noise(0.25,0.9,1.8),1.0))
        sheath=gauss(op("DIVIDE",rho,op("MULTIPLY",op("ADD",0.85,op("MULTIPLY",dp,0.11)),feather)),2.2)
        s=op("MULTIPLY",op("ADD",op("MULTIPLY",hot,op("MULTIPLY",2.2,feather)),op("MULTIPLY",sheath,0.3)),op("MULTIPLY",decay(4.5),k))
        t=clamp(op("SUBTRACT",op("ADD",op("MULTIPLY",op("DIVIDE",rho,op("MULTIPLY",cw,2.2)),0.5),op("MULTIPLY",dp,0.07)),
                              op("MULTIPLY",op("MULTIPLY",hot,decay(5.0)),0.6)))
        return s,t
    if flame=="D":
        s,t=plume(1.6)
    elif flame=="E":
        s,t=jet(1.0)
    else:
        s1,t1=jet(1.0)
        s2,t2=plume(0.7)
        s=op("ADD",s1,s2)
        t=op("MINIMUM",t1,t2)
    s=op("MULTIPLY",s,end)
    return s,t


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
