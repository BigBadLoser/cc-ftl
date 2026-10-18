"""Isolated look development and final sprites; production assets are never touched."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parents[1]),str(HERE)]
from sprites import core, post
import model


def sprite(out,sid,build,samples):
    core.setup_scene()
    core._state["scene"].cycles.samples=samples
    objects=build()
    xmin,xmax,ymin,ymax=core.extent_px(objects)
    w=2*(math.ceil(max(-xmin,xmax))+6)
    h=2*(math.ceil(max(-ymin,ymax))+6)
    rgb,a=core.render(w,h,"color")
    c,op=post.downsample(rgb,a>.5,core.SS,8,True)
    c,op=post.outline(c,op,True)
    rgb,_=core.render(w,h,"glow")
    g=np.pad(post.glow_down(rgb,core.SS,3),((1,1),(1,1),(0,0)))
    x0,y0,x1,y1=post.crop_box(op|(g[...,3]>0))
    rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
    g=g[y0:y1,x0:x1]
    directory=out/"sprites"
    directory.mkdir(parents=True,exist_ok=True)
    post.write_png(directory/(sid+".png"),rgba)
    post.write_png(directory/(sid+".glow.png"),g)
    lit=rgba.copy()
    lit[...,:3]=np.minimum(255,rgba[...,:3].astype(int)+g[...,:3]).astype(np.uint8)
    lit[...,3]=np.maximum(rgba[...,3],g[...,3])
    post.write_png(directory/(sid+".lit.png"),lit)
    assert set(np.unique(rgba[...,3])).issubset({0,255})
    entry={"kind":"static","sheet":sid,
           "frame":{"x":0,"y":0,"w":int(x1-x0),"h":int(y1-y0)},
           "anchor":{"x":int((w+2)//2-x0),"y":int((h+2)//2-y0)},
           "footprint":[2,2],"glow":bool(g[...,3].any())}
    print("SPRITE",sid,entry,flush=True)
    return entry


def read(path,w,h):
    im=bpy.data.images.load(str(path))
    im.colorspace_settings.name="Non-Color"
    im.alpha_mode="STRAIGHT"
    data=np.empty(w*h*4,np.float32)
    im.pixels.foreach_get(data)
    bpy.data.images.remove(im)
    return data.reshape(h,w,4)[::-1]*255


def beauty(out,save,revision,samples):
    core.setup_scene()
    sc=core._state["scene"]
    sc.cycles.samples=samples
    sc.cycles.max_bounces,sc.cycles.diffuse_bounces=3,2
    sc.cycles.filter_width=1.0
    sc.cycles.use_denoising=True
    core._state["sun"].data.use_shadow=True
    core._state["sun"].data.angle=.15
    model.core_module(0,True,revision,roof_part=True)
    model.roof_sensor("active",0,revision)
    model.context("wall")
    m=core.Mesh("review_ship_floor")
    for x in (-2,-1,0,1):
        for y in (-2,-1,0,1):
            m.box((x,y,-.06),(.99,.99,.06),"steelD",top="plateA" if (x+y)%3 else "plateB",base=True)
    m.build()
    # Simple scale figure, isolated preview geometry (not a new crew asset).
    f=core.Mesh("review_scale_crew")
    x,y=1.04,.65
    for dx in (-.075,.075):
        f.box((x+dx,y,0),(.10,.15,.12),"dark",base=True)
        f.box((x+dx,y,.12),(.10,.10,.35),"steelD",base=True)
    f.box((x,y,.47),(.28,.17,.39),"brass",top="brass",base=True,taper=.76)
    f.cyl((x,y,.87),.10,.20,"skin",sides=8,top="hair")
    for dx in (-.20,.20):
        f.box((x+dx,y,.50),(.10,.12,.29),"brass",base=True)
    f.build()
    w,h=1100,1000
    cam=core._state["cam"]
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.ortho_scale=5.9
    cam.data.shift_x=0
    cam.data.shift_y=.22
    sc.render.resolution_x,sc.render.resolution_y=w,h
    for which in ("color","glow"):
        core._set_pass(which)
        if which=="color":
            core.set_ambient(.5,(.82,.92,1.1))
        sc.render.filepath=str(out/("blender-active."+which+".png"))
        bpy.ops.render.render(write_still=True)
        if which=="color" and save:
            bpy.ops.wm.save_as_mainfile(filepath=str(out/"oracle-preview.blend"),compress=True)
    col=read(out/"blender-active.color.png",w,h)
    glow=read(out/"blender-active.glow.png",w,h)[...,:3]
    a=col[...,3:4]/255
    image=np.minimum(255,col[...,:3]*a+np.array([12,17,25])*(1-a)+glow*.65)
    post.write_png(out/"blender-active.png",post.to_rgba(image.astype(np.uint8),np.ones((h,w),bool)))


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--part",choices=("module","roof-a","roof-b","roof-hero","context","beauty"),required=True)
    p.add_argument("--revision",type=int,choices=(1,2),default=2)
    p.add_argument("--rot",type=int,nargs="+",choices=range(4),default=[0])
    p.add_argument("--quality",choices=("preview","final"),default="preview")
    p.add_argument("--save-blend",action="store_true")
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    a.out.mkdir(parents=True,exist_ok=True)
    samples=24 if a.quality=="final" else 4
    beauty_samples=32 if a.quality=="final" else 12
    production_fragment=a.out/"manifest.fragment.json"
    fragment=a.out/("review.manifest.json" if a.part=="context" else "manifest.fragment.json")
    man=json.loads(fragment.read_text()) if fragment.exists() else {"version":1,"sheets":{},"assets":{}}
    def metadata():
        published=json.loads(production_fragment.read_text())["assets"] if production_fragment.exists() else {}
        rotations=sorted(int(s[-1]) for s in published if s.startswith("module.ai_core.r") and s[-1].isdigit())
        (a.out/"design.json").write_text(json.dumps({
        "name":"ORACLE", "revision":a.revision,
        "status":"design locked; final sprite pack" if a.quality=="final" else "look development",
        "design":"split crown / four-paddle array" if a.revision==1 else "continuous ceiling yoke / swept sensor wings",
        "displayGraphic":"v1 triangular network with upward branch",
        "footprint":[2,2], "bodyTopZ":model.ROOF_Z, "roofZ":model.ROOF_Z,
        "hatch":"six telescoping shutter leaves retract into two below-roof pockets",
        "targetCoverage":.6328, "screensBlankWhenUnpowered":True,
        "separateFloor":False, "deploySeconds":2,
        "runtimeGhostOpacity":.30,"ghostBakedIntoArt":False,
        "rotationsRendered":rotations,"spriteSamples":samples,"beautySamples":beauty_samples,
        },indent=2)+"\n")
    if a.part=="beauty":
        beauty(a.out,a.save_blend,a.revision,beauty_samples)
        metadata()
        return
    jobs=[]
    if a.part=="module":
        for rot in a.rot:
            for hot in (False,True):
                jobs.append((f"module.ai_core.r{rot}"+(".active" if hot else ""),lambda rot=rot,hot=hot:model.core_module(rot,hot,a.revision)))
    elif a.part=="context":
        for kind in ("wall","roof"):
            jobs.append(("review."+kind,lambda kind=kind:model.context(kind)))
    else:
        poses=list(model.POSES)
        chosen=["active"] if a.part=="roof-hero" else (poses[:4] if a.part=="roof-a" else poses[4:])
        for pose in chosen:
            sid="roof.ai_core"+("" if pose=="deployed" else "."+pose)
            jobs.append((sid,lambda pose=pose:model.roof_sensor(pose,0,a.revision)))
    for sid,build in jobs:
        man["assets"][sid]=sprite(a.out,sid,build,samples)
        man["sheets"][sid]={"image":f"sprites/{sid}.png","glow":f"sprites/{sid}.glow.png"}
        fragment.write_text(json.dumps(man,indent=2)+"\n")
        metadata()


if __name__=="__main__":
    main()
