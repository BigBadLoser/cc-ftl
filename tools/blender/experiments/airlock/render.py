"""Low-sample review and independent game layers. No production writes."""
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
import materials
import model

materials.install()
MAN={"version":1,"sheets":{},"assets":{}}


def setup(samples):
    core.setup_scene()
    core._state["scene"].cycles.samples=samples


def raster(out,sid,objects,glow=True,edge=True,review=False):
    xmin,xmax,ymin,ymax=core.extent_px(objects)
    w=2*(math.ceil(max(-xmin,xmax))+7)
    h=2*(math.ceil(max(-ymin,ymax))+7)
    rgb,a=core.render(w,h,"color")
    c,op=post.downsample(rgb,a>.5,core.SS,8,True)
    if edge:
        c,op=post.outline(c,op,True)
    else:
        c=np.pad(c,((1,1),(1,1),(0,0)))
        op=np.pad(op,1)
    g=np.zeros((*op.shape,4),np.uint8)
    if glow:
        rgb,_=core.render(w,h,"glow")
        g=np.pad(post.glow_down(rgb,core.SS,3),((1,1),(1,1),(0,0)))
    occupied=op|(g[...,3]>0)
    if occupied.any():
        x0,y0,x1,y1=post.crop_box(occupied)
    else:
        # A fully retracted door can be wholly hidden in its pressure jamb.
        x0,y0,x1,y1=w//2+1,h//2+1,w//2+2,h//2+2
    rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
    g=g[y0:y1,x0:x1]
    directory=out/("raw" if review else "sprites")
    directory.mkdir(parents=True,exist_ok=True)
    relative=str(directory.relative_to(out))
    post.write_png(directory/(sid+".png"),rgba)
    post.write_png(directory/(sid+".glow.png"),g)
    entry={"kind":"static","sheet":sid,
           "frame":{"x":0,"y":0,"w":int(x1-x0),"h":int(y1-y0)},
           "anchor":{"x":int(w//2+1-x0),"y":int(h//2+1-y0)},
           "glow":bool(g[...,3].any())}
    MAN["assets"][sid]=entry
    MAN["sheets"][sid]={"image":f"{relative}/{sid}.png","glow":f"{relative}/{sid}.glow.png"}
    (out/"review.manifest.json").write_text(json.dumps(MAN,indent=2)+"\n")
    print("ASSET",sid,entry["frame"],flush=True)
    return entry


def scenes(out,rot,samples):
    # Three installation levels; the outer bulkhead never cuts down.
    for mode in ("full","cut","ghost"):
        setup(samples)
        objects=model.context(rot,mode)+model.assembly(rot,mode)
        raster(out,f"scene.r{rot}.{mode}",objects,review=True)
        if mode=="ghost":
            for ob in objects:
                ob.is_holdout=True
            ghost=model.context(rot,mode,True)
            raster(out,f"scene.r{rot}.ghost-overlay",ghost,glow=False,review=True)
    for state in ("sealed","inner-opening","inner-open","cycling","outer-opening","outer-open","unpowered"):
        setup(samples)
        objects=model.assembly(rot,"cut",state)
        raster(out,f"state.r{rot}.{state}",objects,review=True)


def layers(out,rot,samples):
    setup(samples)
    objects=model.frame(rot)
    entry=raster(out,f"module.airlock.r{rot}",objects,glow=False)
    entry["footprint"]=[4,1] if rot%2 else [1,4]
    for which in ("outer","inner"):
        for pose,value in model.POSES.items():
            setup(samples)
            # Frame holdouts trim the leaves in their real pressure tracks.
            for ob in model.frame(rot):
                ob.is_holdout=True
            objects=model.door(rot,which,value)
            raster(out,f"module.airlock.{which}.r{rot}.{pose}",objects,glow=False,edge=False)
        for j,source in enumerate(("opening.f2","opening.f1","opening.f0")):
            # Closing uses the exact same geometry in reverse order.
            aid=f"module.airlock.{which}.r{rot}.closing.f{j}"
            MAN["assets"][aid]=dict(MAN["assets"][f"module.airlock.{which}.r{rot}.{source}"])
    for state in ("sealed","outer-open","inner-open","cycling"):
        for phase in ((0,1) if state=="cycling" else (0,)):
            setup(samples)
            for ob in model.frame(rot):
                ob.is_holdout=True
            objects=model.lights(rot,state,phase)
            sid=f"module.airlock.r{rot}."+(f"cycling.f{phase}" if state=="cycling" else "status."+state)
            raster(out,sid,objects,edge=False)


def beauty(out,rot,samples):
    setup(max(8,samples))
    sc=core._state["scene"]
    sc.cycles.max_bounces=2
    sc.cycles.diffuse_bounces=2
    sc.cycles.filter_width=1.1
    # The environment's Debian Blender build lacks OpenImageDenoise.
    # Keep the low-sample beauty portable, like the undenoised sprite renders.
    sc.cycles.use_denoising=False
    core._state["sun"].data.use_shadow=True
    core._state["sun"].data.angle=.12
    objects=model.context(rot,"cut")+model.assembly(rot,"cut","inner-open")
    # The pressure tube is enclosed even beside cutaway hull neighbours.
    xmin,xmax,ymin,ymax=core.extent_px(objects)
    cam=core._state["cam"]
    w,h=1440,1080
    scale=max((xmax-xmin)/core.PXU,(ymax-ymin)/core.PXU*w/h)*1.12
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.ortho_scale=scale
    cam.data.shift_x=(xmin+xmax)/2/core.PXU/scale
    cam.data.shift_y=(ymin+ymax)/2/core.PXU/scale
    sc.render.resolution_x,sc.render.resolution_y=w,h
    images=[]
    for which in ("color","glow"):
        core._set_pass(which)
        if which=="color":
            core.set_ambient(.4,(.85,.95,1.1))
            bpy.ops.wm.save_as_mainfile(filepath=str(out/"airlock-preview.blend"),compress=True)
        path=out/("blender-airlock."+which+".png")
        sc.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        im=bpy.data.images.load(str(path))
        im.colorspace_settings.name="Non-Color"
        im.alpha_mode="STRAIGHT"
        arr=np.empty(w*h*4,np.float32)
        im.pixels.foreach_get(arr)
        bpy.data.images.remove(im)
        images.append(arr.reshape(h,w,4)[::-1]*255)
    col,glow=images
    alpha=col[...,3:4]/255
    final=np.minimum(255,col[...,:3]*alpha+np.array([13,19,28])*(1-alpha)+glow[...,:3]*.8)
    post.write_png(out/"blender-airlock.png",post.to_rgba(final.astype(np.uint8),np.ones((h,w),bool)))


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--rot",type=int,nargs="+",choices=range(4),default=[0,1])
    p.add_argument("--part",choices=("all","scenes","layers","beauty"),default="all")
    p.add_argument("--samples",type=int,default=4)
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    a.out.mkdir(parents=True,exist_ok=True)
    path=a.out/"review.manifest.json"
    if path.exists():
        MAN.update(json.loads(path.read_text()))
    for rot in a.rot:
        if a.part in ("all","scenes"):
            scenes(a.out,rot,a.samples)
        if a.part in ("all","layers"):
            layers(a.out,rot,a.samples)
    if a.part in ("all","beauty"):
        beauty(a.out,a.rot[0],a.samples)
    path.write_text(json.dumps(MAN,indent=2)+"\n")
    # Keep review composites out of the renderer's fragment.
    assets={k:v for k,v in MAN["assets"].items() if k.startswith("module.")}
    sheets={v["sheet"]:MAN["sheets"][v["sheet"]] for v in assets.values()}
    (a.out/"manifest.fragment.json").write_text(json.dumps({"version":1,"assets":assets,"sheets":sheets},indent=2)+"\n")
    (a.out/"palette.airlock.json").write_text(json.dumps(materials.SWATCHES,indent=2)+"\n")


if __name__=="__main__":
    main()
