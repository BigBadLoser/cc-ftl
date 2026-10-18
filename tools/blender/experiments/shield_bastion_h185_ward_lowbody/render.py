"""Isolated low-sample r0 shield look development. Never writes production art."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parents[1]),str(HERE)]
from sprites import core,post
from geometry import footprint,ZR,WALL_Z
import model,roof


def sprite(out,sid,build,small=False,review=False,rot=0,final=False):
    core.setup_scene()
    core._state["scene"].cycles.samples=24 if final else (8 if sid.startswith("roof.") else 4)
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
    assert set(np.unique(rgba[...,3]))<={0,255}
    entry={"kind":"static","sheet":sid,
           "frame":{"x":0,"y":0,"w":int(x1-x0),"h":int(y1-y0)},
           "anchor":{"x":int((w+2)//2-x0),"y":int((h+2)//2-y0)},
           "footprint":footprint(small,rot),"glow":bool(g[...,3].any())}
    print("SPRITE",sid,entry,flush=True)
    fragment=out/("review.manifest.json" if review else "manifest.fragment.json")
    man=json.loads(fragment.read_text()) if fragment.exists() else {"version":1,"sheets":{},"assets":{}}
    man["assets"][sid]=entry
    man["sheets"][sid]={"image":f"sprites/{sid}.png","glow":f"sprites/{sid}.glow.png"}
    fragment.write_text(json.dumps(man,indent=2)+"\n")


def read(path,w,h):
    im=bpy.data.images.load(str(path))
    im.colorspace_settings.name="Non-Color"
    im.alpha_mode="STRAIGHT"
    a=np.empty(w*h*4,np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h,w,4)[::-1]*255


def beauty(out,small=False,save=False,samples=12):
    core.setup_scene()
    sc=core._state["scene"]
    sc.cycles.samples=samples
    sc.cycles.max_bounces,sc.cycles.diffuse_bounces=3,2
    sc.cycles.filter_width=1
    sc.cycles.use_denoising=True
    core._state["sun"].data.use_shadow=True
    core._state["sun"].data.angle=.15
    (model.small if small else model.large)(0,True)
    (roof.small if small else roof.large)("active",0)
    roof.context(wall=True)
    m=core.Mesh("review_ship_deck")
    for x in (-2,-1,0,1):
        for y in (-3,-2,-1,0,1):
            m.box((x,y,-.06),(.99,.99,.06),"steelD",top="plateA" if (x+y)%3 else "plateB",base=True)
    m.build()
    # Simple 1.55-high scale figure, matching the shipped crew's world height.
    m=core.Mesh("review_scale_crew")
    x,y=1.0,.65
    for dx in (-.075,.075):
        m.box((x+dx,y,0),(.10,.15,.12),"dark",base=True)
        m.box((x+dx,y,.12),(.10,.10,.35),"steelD",base=True)
    m.box((x,y,.47),(.28,.17,.39),"brass",top="brass",base=True,taper=.76)
    m.cyl((x,y,.87),.10,.20,"skin",sides=8,top="hair")
    for dx in (-.20,.20):
        m.box((x+dx,y,.50),(.10,.12,.29),"brass",base=True)
    m.v=[(x+(p[0]-x)*1.45,-y+(p[1]+y)*1.45,p[2]*1.45) for p in m.v]
    m.build()
    w,h=1100,1000
    cam=core._state["cam"]
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.ortho_scale=6.35
    cam.data.shift_x=0
    cam.data.shift_y=.22
    sc.render.resolution_x,sc.render.resolution_y=w,h
    tag="blender-small" if small else "blender-large"
    for which in ("color","glow"):
        core._set_pass(which)
        if which=="color":
            core.set_ambient(.5,(.82,.92,1.1))
        sc.render.filepath=str(out/(tag+"."+which+".png"))
        bpy.ops.render.render(write_still=True)
        if which=="color" and save:
            bpy.ops.wm.save_as_mainfile(filepath=str(out/(tag+".blend")),compress=True)
    col=read(out/(tag+".color.png"),w,h)
    glow=read(out/(tag+".glow.png"),w,h)[...,:3]
    a=col[...,3:4]/255
    image=np.minimum(255,col[...,:3]*a+np.array([12,17,25])*(1-a)+glow*.65)
    post.write_png(out/(tag+".png"),post.to_rgba(image.astype(np.uint8),np.ones((h,w),bool)))


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",required=True,type=Path)
    p.add_argument("--part",required=True,choices=("modules","roof-large-a","roof-large-b","roof-small-a","roof-small-b","context","beauty"))
    p.add_argument("--size",choices=("large","small","both"),default="both")
    p.add_argument("--save-blend",action="store_true")
    p.add_argument("--rot",type=int,nargs="+",choices=range(4),default=[0])
    p.add_argument("--quality",choices=("preview","final"),default="preview")
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    a.out.mkdir(parents=True,exist_ok=True)
    (a.out/"design.json").write_text(json.dumps({
        "status":"low-sample r0 study; awaiting look approval",
        "large":{"name":"BASTION","footprint":[2,3],
                 "roofTargetCoverage":(2.4*1.6-2*.16*.16)/6,
                 "body":"seven-cell longitudinal resonator with cast return yokes",
                 "projector":"central hex plus six hinged hexagonal petals"},
        "small":{"name":"WARD","footprint":[2,2],
                 "roofTargetCoverage":(3*math.sqrt(3)/2*.95**2)/4,
                 "body":"lower pressure case with original-length swept spine",
                 "casingTopZ":.86,"lensClearance":.0459,
                 "projector":"telescoping field fork with inward-curving claws"},
        "variant":"wall-1.85-roof-2.05/ward-lowbody", "wallZ":WALL_Z,
        "floorZ":0,"roofZ":ZR,"bodyFeedTopZ":ZR,"separateFloor":False,
        "hexMotif":"one central cell plus six neighbours",
        "cyanPaint":False,"unpowered":"dark; pilot only",
        "deploySeconds":2,"shieldCoreEnergises":"fully deployed endpoint",
        "bakedGhost":False,"runtimeGhostOpacity":.30,
        "rotationsRendered":sorted(a.rot),"activeAnimation":"static",
        "samples":{"interior":24 if a.quality=="final" else 4,
                   "roof":24 if a.quality=="final" else 8,
                   "beauty":32 if a.quality=="final" else 12},
    },indent=2)+"\n")
    if a.part=="beauty":
        beauty(a.out,a.size=="small",a.save_blend,32 if a.quality=="final" else 12)
    elif a.part=="modules":
        for small in ((False,True) if a.size=="both" else (a.size=="small",)):
            for rot in a.rot:
                for active in (False,True):
                    sid="module.shield_gen"+("_small" if small else "")+f".r{rot}"+(".active" if active else "")
                    sprite(a.out,sid,lambda small=small,active=active,rot=rot:(model.small if small else model.large)(rot,active),small,rot=rot,final=a.quality=="final")
    elif a.part=="context":
        sprite(a.out,"review.wall",lambda:roof.context(wall=True),review=True)
        for small in (False,True):
            sid="review.roof."+("small" if small else "large")
            sprite(a.out,sid,lambda small=small:roof.context(small),small,True)
    else:
        small="small" in a.part
        poses=list(roof.POSES)
        for pose in poses[:4] if a.part.endswith("-a") else poses[4:]:
            sid="roof.shield_gen"+("_small" if small else "")+("" if pose=="deployed" else "."+pose)
            sprite(a.out,sid,lambda small=small,pose=pose:(roof.small if small else roof.large)(pose,0),small,final=a.quality=="final")
    # Subsequent roof/context jobs must not reset a completed four-rotation
    # pack's metadata to the CLI default rotation.
    fragment=a.out/"manifest.fragment.json"
    assets=json.loads(fragment.read_text())["assets"] if fragment.exists() else {}
    metadata=json.loads((a.out/"design.json").read_text())
    metadata["rotationsRendered"]=sorted({int(sid.split(".r")[-1].split(".")[0])
        for sid in assets if sid.startswith("module.")})
    (a.out/"design.json").write_text(json.dumps(metadata,indent=2)+"\n")


if __name__=="__main__":
    main()
