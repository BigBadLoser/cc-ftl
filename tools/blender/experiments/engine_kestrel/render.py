"""Render isolated layer assets + Cycles views. No production writes."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parents[1]),str(HERE)]
from sprites import core, post, walls  # noqa: E402
from sprites.cmbkit import Frame  # noqa: E402
import model  # noqa: E402
import plasma  # noqa: E402


def flame_visible(visible):
    for ob in bpy.data.objects:
        if ob.name.startswith("KESTREL_exhaust"):
            ob.hide_render=not visible


def sprite(out,rot,hot,part,stage):
    core.setup_scene()
    core._state["scene"].cycles.samples=24
    objects=model.hull(rot,stage) if part=="hull" else model.machine(rot,hot,stage)
    bounds=core.extent_px(objects)
    xmin,xmax,ymin,ymax=bounds
    w=2*(math.ceil(max(-xmin,xmax))+5)
    h=2*(math.ceil(max(-ymin,ymax))+5)
    flame_visible(False)
    rgb,a=core.render(w,h,"color")
    c,op=post.downsample(rgb,a>0.5,core.SS,8,True)
    if part=="machine":
        c,op=post.outline(c,op,True)
    else:
        c=np.pad(c,((1,1),(1,1),(0,0)))
        op=np.pad(op,1)
    flame_visible(True)
    if stage>=1 and hot:
        # core.render sets the shared materials itself, so install the volume
        # immediately after that pass selection through this local wrapper.
        original=core._set_pass
        def set_pass(which):
            original(which)
            if which=="glow":
                plasma.apply(rot,stage)
        core._set_pass=set_pass
    rgb,_=core.render(w,h,"glow")
    if stage>=1 and hot:
        core._set_pass=original
    g=np.pad(post.glow_down(rgb,core.SS,3),((1,1),(1,1),(0,0)))
    x0,y0,x1,y1=post.crop_box(op|(g[...,3]>0))
    rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
    g=g[y0:y1,x0:x1]
    sid=f"module.engine.{part}.r{rot}"+(".active" if hot else "")
    directory=out/"sprites"
    directory.mkdir(parents=True,exist_ok=True)
    post.write_png(directory/(sid+".png"),rgba)
    post.write_png(directory/(sid+".glow.png"),g)
    preview=rgba.copy()
    preview[...,:3]=np.minimum(255,rgba[...,:3].astype(int)+g[...,:3]).astype(np.uint8)
    preview[...,3]=np.maximum(rgba[...,3],g[...,3])
    post.write_png(directory/(sid+".lit.png"),preview)
    assert set(np.unique(rgba[...,3])).issubset({0,255})
    entry={"kind":"static","sheet":sid,"frame":{"x":0,"y":0,"w":int(x1-x0),"h":int(y1-y0)},
           "anchor":{"x":int((w+2)//2-x0),"y":int((h+2)//2-y0)},
           "footprint":[5,4] if rot%2 else [4,5],"glow":bool(g[...,3].any())}
    print("SPRITE",sid,entry,flush=True)
    return sid,entry


def read(path,w,h):
    im=bpy.data.images.load(str(path))
    im.colorspace_settings.name="Non-Color"
    im.alpha_mode="STRAIGHT"
    data=np.empty(w*h*4,np.float32)
    im.pixels.foreach_get(data)
    bpy.data.images.remove(im)
    return data.reshape(h,w,4)[::-1]*255


def blur(a,r):
    for axis in (0,1):
        pads=[(0,0)]*3
        pads[axis]=(r,r)
        p=np.pad(a,pads)
        s=np.cumsum(p,axis=axis,dtype=np.float32)
        pads[axis]=(1,0)
        s=np.pad(s,pads)
        hi=[slice(None)]*3
        lo=[slice(None)]*3
        hi[axis]=slice(2*r+1,None)
        lo[axis]=slice(None,-(2*r+1))
        a=(s[tuple(hi)]-s[tuple(lo)])/(2*r+1)
    return a


def beauty(out,rot,hot,stage,save=False):
    core.setup_scene()
    sc=core._state["scene"]
    sc.cycles.samples=16
    sc.cycles.max_bounces,sc.cycles.diffuse_bounces=3,2
    sc.cycles.filter_width=1.2
    sc.cycles.use_denoising=True
    sun=core._state["sun"]
    sun.data.use_shadow=True
    sun.data.angle=0.12
    objects=model.hull(rot,stage)+model.machine(rot,hot,stage,holdout=False)
    xmin,xmax,ymin,ymax=core.extent_px(objects)
    # Actual ship deck stops at the hull: the bell and exhaust hang over space.
    m=core.Mesh("review_inboard_deck")
    f=Frame(m,rot,centre=model.CENTRE[rot])
    for u in (-3,-2,-1,0,1):
        for v in (-3,-2,-1,0,1,2,3):
            f.box(u,v,-0.06 if stage>=7 else -0.08,0.99,0.99,0.06,"plateA",top="plateA" if (u+v)%3 else "plateB")
    m.build()
    f=Frame(core.Mesh("unused"),rot,centre=model.CENTRE[rot])
    for v in (-2.5,2.5):
        ob=walls.block(5 if rot%2 else 10,"hull",full=True)[0]
        x,y=f.xy(2,v)
        ob.location=core.G(x,y,0)
    w,h=1400,1000
    cam=core._state["cam"]
    scale=max((xmax-xmin)/core.PXU,(ymax-ymin)/core.PXU*w/h)*1.26
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.ortho_scale=scale
    cam.data.shift_x=(xmin+xmax)/2/core.PXU/scale
    cam.data.shift_y=(ymin+ymax)/2/core.PXU/scale
    sc.render.resolution_x,sc.render.resolution_y=w,h
    tag=f"blender-r{rot}-{'active' if hot else 'idle'}"
    for which in ("color","glow"):
        core._set_pass(which)
        flame_visible(which=="glow")
        if which=="glow" and hot and stage>=1:
            plasma.apply(rot,stage)
        if which=="color":
            core.set_ambient(0.5,(0.8,0.92,1.15))
        else:
            sc.cycles.samples=8 if hot and stage>=1 else 4
        sc.render.filepath=str(out/(tag+f".{which}.png"))
        bpy.ops.render.render(write_still=True)
        if which=="color" and save:
            flame_visible(True)
            if hot and stage>=1:
                plasma.apply(rot,stage)
            bpy.ops.wm.save_as_mainfile(filepath=str(out/(tag+".blend")),compress=True)
    col=read(out/(tag+".color.png"),w,h)
    glow=read(out/(tag+".glow.png"),w,h)[...,:3]
    a=col[...,3:4]/255
    image=col[...,:3]*a+np.array([12,17,25])*(1-a)
    image=np.minimum(255,image+glow*0.85+blur(glow,7)*0.22)
    post.write_png(out/(tag+".png"),post.to_rgba(image.astype(np.uint8),np.ones((h,w),bool)))
    print("BEAUTY",tag,flush=True)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--rot",type=int,nargs="+",default=[0,1],choices=range(4))
    p.add_argument("--stage",type=int,default=7,choices=(1,2,3,4,5,6,7))
    p.add_argument("--save-blend",action="store_true")
    p.add_argument("--no-beauty",action="store_true")
    p.add_argument("--no-sprites",action="store_true")
    p.add_argument("--sprite-state",choices=("idle","active","both"),default="both")
    p.add_argument("--beauty-state",choices=("idle","active","both"),default="both")
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    a.out.mkdir(parents=True,exist_ok=True)
    fragment=a.out/"manifest.fragment.json"
    entries=json.loads(fragment.read_text())["assets"] if fragment.exists() else {}
    for r in a.rot:
        if not a.no_sprites:
            for part,hot in (("hull",False),("machine",False),("machine",True)):
                if part=="machine" and a.sprite_state!="both" and hot!=(a.sprite_state=="active"):
                    continue
                sid,entry=sprite(a.out,r,hot,part,a.stage)
                entries[sid]=entry
            sheets={sid:{"image":f"sprites/{sid}.png","glow":f"sprites/{sid}.glow.png"} for sid in entries}
            manifest={"version":1,"sheets":sheets,"assets":entries}
            (a.out/"manifest.fragment.json").write_text(json.dumps(manifest,indent=2)+"\n")
        if not a.no_beauty:
            for hot in (False,True):
                if a.beauty_state=="both" or hot==(a.beauty_state=="active"):
                    beauty(a.out,r,hot,a.stage,a.save_blend)
    entries=json.loads(fragment.read_text())["assets"] if fragment.exists() else entries
    (a.out/"design.json").write_text(json.dumps({"name":"KESTREL / 02","stage":a.stage,
        "rotationsRendered":sorted(int(s[-1]) for s in entries if s.startswith("module.engine.hull.r")),
        "footprintAlongHull":4,"footprintDepth":5,
        "bellOuterDiameter":2.6,"metalProtrusion":1.5,"bulkheadAlwaysFullHeight":True,
        "separateFloorPlate":a.stage<7,"mountingSurface":"ship-deck" if a.stage>=7 else "legacy-plinth"},indent=2)+"\n")


if __name__=="__main__":
    main()
