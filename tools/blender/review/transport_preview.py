"""Concept B, preview only: one Blender process, four samples, no atlas writes.

blender -b -t 2 --factory-startup --python-exit-code 1 --python \
  tools/blender/review/transport_preview.py -- --out artifacts/shuttle-sweepback-r6
python3 tools/blender/review/transport_preview.py --out artifacts/shuttle-sweepback-r6 --compose
"""
import argparse
import json
import math
import sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"tools/blender"))
BG=(13,19,28,255)
FACTION={"primary":(82,117,147),"secondary":(199,161,94)}


def recolor(rgb):
    """Review palette only; native sprite files retain their exact export keys."""
    result=rgb.copy()
    for key,value in (((255,0,0),FACTION["primary"]),((0,255,0),FACTION["secondary"])):
        match=np.all(rgb[...,:3]==key,axis=-1)
        result[...,:3][match]=value
    return result


def room_geometry(core,depth):
    """Placeholder 4x5 pit, deck at zero, walls 1.85. Not a bay asset."""
    m=core.Mesh("review_room")
    # Continuous deck rings around the exact 4x5 hole.
    for x,y,sx,sy in ((-3,0,2,9),(3,0,2,9),(0,-3.5,4,2),(0,3.5,4,2)):
        m.box((x,y,-.10),(sx,sy,.10),"plateA",top="plateA",base=True)
    # Plain seams at the same world-unit grid metric as the game.
    for x in range(-4,5):
        for y0,y1 in ((-4.5,-2.5),(2.5,4.5)):
            m.box((x,(y0+y1)/2,.001),(.012,y1-y0,.003),"steelD")
    for x0,x1 in ((-4,-2),(2,4)):
        for y in np.arange(-4.5,4.6,1):
            m.box(((x0+x1)/2,y,.001),(x1-x0,.012,.003),"steelD")
    m.box((0,0,-depth-.07),(4,5,.07),"steelD",top="plateC",base=True)
    for x,y,sx,sy in ((-2.015,0,.03,5),(2.015,0,.03,5),(0,-2.515,4,.03),(0,2.515,4,.03)):
        m.box((x,y,-depth),(sx,sy,depth),"steelD",top="steelL",base=True)
    # Narrow flush rim and pad corner marks indicate the recess, without a slab.
    for x in (-2.03,2.03):
        m.box((x,0,.005),(.07,5.1,.012),"steelL")
    for y in (-2.53,2.53):
        m.box((0,y,.005),(4.1,.07,.012),"steelL")
    for x in (-1.70,1.70):
        for y in (-2.18,2.18):
            m.box((x,y,-depth+.004),(.34,.06,.008),"hazY")
            m.box((x,y,-depth+.004),(.06,.34,.008),"hazY")
    # Far room walls use the established 0.38 sloped skirt and 1.85 wall top.
    m.box((-4.1,0,0),(.25,9,1.85),"steel",top="steelL",base=True)
    m.box((0,-4.6,0),(8.45,.25,1.85),"steel",top="steelL",base=True)
    m.box((-4.1,0,0),(.65,9,.38),"steelD",top="steel",base=True,taper=.55)
    m.box((0,-4.6,0),(8.45,.65,.38),"steelD",top="steel",base=True,taper=.55)
    return [m.build()]


def render(out,flight_only=False,validate_only=False):
    import bpy
    from sprites import core,post,shuttle_craft as craft
    post.select(True)
    man={"version":1,"assets":{},"sheets":{}}
    if (out/"preview.manifest.json").exists():
        man=json.loads((out/"preview.manifest.json").read_text())
    def setup(samples=4):
        core.setup_scene()
        core._state["scene"].cycles.samples=samples
        # Exact export-key paint is camera-visible ink, never a mesh light.
        # Avoid red/green spill onto the side faces of the stacked wing panels.
        core._mats["color"].cycles.emission_sampling="NONE"
        nodes=core._mats["color"].node_tree
        rays=nodes.nodes.new("ShaderNodeLightPath")
        ink=next(n for n in nodes.nodes if n.type=="EMISSION")
        nodes.links.new(rays.outputs["Is Camera Ray"],ink.inputs["Strength"])
    from review.transport_geometry import validate
    design,pit=validate(craft,core,setup,FACTION)
    (out/"design.json").write_text(json.dumps(design,indent=2)+"\n")

    if validate_only:
        print("GEOMETRY CHECKS passed",flush=True)
        return

    def sprite(sid,build,glow=False,top=False):
        setup()
        obs=build()
        xmin,xmax,ymin,ymax=core.extent_px(obs)
        w=2*(math.ceil(max(-xmin,xmax))+7)
        h=2*(math.ceil(max(-ymin,ymax))+7)
        if top:
            core._state["cam"].location=(0,0,60)
            core._state["cam"].rotation_euler=(0,0,0)
            w,h=380,300
        rgb,a=core.render(w,h,"color")
        c,op=post.downsample(rgb,a>.5,core.SS,8,True)
        c,op=post.outline(c,op,True)
        g=np.zeros((*op.shape,4),np.uint8)
        if glow:
            rgb,_=core.render(w,h,"glow")
            g=np.pad(post.glow_down(rgb,core.SS,3),((1,1),(1,1),(0,0)))
        x0,y0,x1,y1=post.crop_box(op|(g[...,3]>0))
        rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
        g=g[y0:y1,x0:x1]
        post.write_png(out/(sid+".png"),rgba)
        post.write_png(out/(sid+".glow.png"),g)
        man["assets"][sid]={"sheet":sid,"frame":{"x":0,"y":0,"w":int(x1-x0),"h":int(y1-y0)},
                            "anchor":{"x":int(w//2+1-x0),"y":int(h//2+1-y0)}}
        man["sheets"][sid]={"image":sid+".png","glow":sid+".glow.png"}
        print("PREVIEW",sid,flush=True)
    if not flight_only:
        sprite("parked-room-r0",lambda:room_geometry(core,pit)+craft.transport_shuttle(-math.pi/2,"parked",dz=-pit))
    for d in (0,2,5):
        sprite(f"fly-d{d}",lambda d=d:craft.transport_shuttle(d*math.pi/4,"fly"),True)
    # Review comparison of the folded shape above a pad, without the pit occluding it.
    if not flight_only:
        sprite("folded-r0",lambda:craft.transport_shuttle(-math.pi/2,"parked"))
        sprite("folded-r2",lambda:craft.transport_shuttle(math.pi/2,"parked"))
        sprite("plan-folded",lambda:craft.transport_shuttle(math.pi/2,"parked"),top=True)
        sprite("plan-deployed",lambda:craft.transport_shuttle(math.pi/2,"fly"),top=True)
        sprite("ramp-closed",lambda:craft.transport_shuttle(math.pi,"parked"))
        sprite("ramp-lowered",lambda:craft.transport_shuttle(math.pi,"parked",ramp_open=1))
    (out/"preview.manifest.json").write_text(json.dumps(man,indent=2)+"\n")
    # One low-sample beauty, in the same process. This build has no OIDN support.
    setup(8)
    beauty_objects=craft.transport_shuttle(math.pi/2,"fly")
    # Recolour only the review scene; sprite renders above stay in raw key RGB.
    from lib import palette
    for ob in beauty_objects:
        attr=ob.data.color_attributes["Self"]
        values=np.empty(len(attr.data)*4,np.float32)
        attr.data.foreach_get("color",values)
        values=values.reshape(-1,4)
        for key,paint in (((1,0,0),FACTION["primary"]),((0,1,0),FACTION["secondary"])):
            match=np.all(np.abs(values[:,:3]-key)<1e-6,axis=1)
            values[match,:3]=[palette.srgb_to_linear(x/255) for x in paint]
        attr.data.foreach_set("color",values.ravel())
    sc,cam=core._state["scene"],core._state["cam"]
    sc.cycles.max_bounces=2
    sc.cycles.diffuse_bounces=2
    sc.cycles.use_denoising=False
    sc.cycles.filter_width=1.1
    core._state["sun"].data.use_shadow=True
    core._state["sun"].data.angle=.12
    xmin,xmax,ymin,ymax=core.extent_px([o for o in sc.objects if o.type=="MESH"])
    w,h=1440,1000
    scale=max((xmax-xmin)/core.PXU,(ymax-ymin)/core.PXU*w/h)*1.15
    cam.data.sensor_fit="HORIZONTAL"
    cam.data.ortho_scale=scale
    cam.data.shift_x=(xmin+xmax)/2/core.PXU/scale
    cam.data.shift_y=(ymin+ymax)/2/core.PXU/scale
    sc.render.resolution_x,sc.render.resolution_y=w,h
    parts=[]
    for which in ("color","glow"):
        core._set_pass(which)
        if which=="color":
            core.set_ambient(.4,(.9,.96,1.05))
            bpy.ops.wm.save_as_mainfile(filepath=str(out/"transport-B-preview.blend"),compress=True)
        path=out/("beauty-"+which+".png")
        sc.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        im=bpy.data.images.load(str(path))
        im.colorspace_settings.name="Non-Color"
        im.alpha_mode="STRAIGHT"
        px=np.empty(w*h*4,np.float32)
        im.pixels.foreach_get(px)
        parts.append(px.reshape(h,w,4)[::-1]*255)
        bpy.data.images.remove(im)
    c,g=parts
    a=c[...,3:4]/255
    result=np.minimum(255,c[...,:3]*a+np.array(BG[:3])*(1-a)+g[...,:3]*.8)
    post.write_png(out/"transport-B-beauty.png",post.to_rgba(result.astype(np.uint8),np.ones((h,w),bool)))


def compose(out):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C,post
    font=lambda n:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",n)
    man=json.loads((out/"preview.manifest.json").read_text())
    design=json.loads((out/"design.json").read_text())
    def paste(cv,sid,x,y,faction=True,silhouette=False):
        a=man["assets"][sid]["anchor"]
        pixels=np.array(Image.open(out/(sid+".png")))
        if faction:
            pixels=recolor(pixels)
        if silhouette:
            pixels[...,:3]=(207,216,222)
        C.over(cv,pixels,round(x-a["x"]),round(y-a["y"]))
        if not silhouette:
            C.add(cv,np.array(Image.open(out/(sid+".glow.png"))),round(x-a["x"]),round(y-a["y"]))
    def save(name,im):
        im.convert("RGB").save(out/(name+"-1x.png"))
        im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).convert("RGB").save(out/(name+"-3x.png"))
    cv=np.full((520,640,4),BG,np.uint8)
    paste(cv,"parked-room-r0",320,270)
    assets=ROOT/"public/assets"
    shipped=json.loads((assets/"manifest.json").read_text())
    stack=None
    names=["body","eyes.organic","legs.cargo_pants","torso.work_shirt","arm.R.flesh","arm.L.flesh","hair.short"]
    items=sorted((shipped["assets"]["crew.human."+n] for n in names),key=lambda a:a["order"])
    for a in items:
        fw,fh=a["frameW"],a["frameH"]
        sh=np.array(Image.open(assets/shipped["sheets"][a["sheet"]]["image"]))
        frame=a["clips"]["idle"]["start"]
        fr=sh[3*fh:4*fh,frame*fw:(frame+1)*fw]
        fr=C.remap_keys(fr,{"team.skin":(212,156,116),"team.cloth":(114,132,95),"team.hair":(58,42,30),"team.accent":(201,162,39)})
        if stack is None:
            stack=np.zeros_like(fr)
        C.over(stack,fr,0,0)
    c,op=post.outline(stack[...,:3],stack[...,3]>0,True)
    # Crew stands on deck at (3, .7), next to the near rim, never inside the craft.
    an=items[0]["anchor"]
    C.over(cv,post.to_rgba(c,op),round(320+(3-.7)*32-an["x"]-1),round(270+(3+.7)*16-an["y"]-1))
    im=Image.fromarray(cv)
    d=ImageDraw.Draw(im)
    d.text((18,15),"TRANSPORT / B6 — WINGS FOLDED",font=font(18),fill=(213,224,233))
    d.text((18,42),"Placeholder 4 x 5 pit / crew at deck level / 64 x 32 tiles",font=font(12),fill=(142,161,177))
    d.text((18,474),f"Height {design['parkedSize'][2]:.2f}  |  pit depth {design['pitDepth']:.2f}  |  top above deck {design['topAboveDeck']:.2f}",font=font(12),fill=(210,181,119))
    d.text((18,496),"Preview only. Bay geometry is a scale placeholder.",font=font(11),fill=(142,161,177))
    save("transport-B-parked",im)
    flight=np.full((380,1200,4),BG,np.uint8)
    for col,direction in enumerate((0,2,5)):
        paste(flight,f"fly-d{direction}",200+col*400,280)
    im=Image.fromarray(flight)
    d=ImageDraw.Draw(im)
    d.text((18,14),"TRANSPORT / B6 — WINGS DEPLOYED",font=font(18),fill=(213,224,233))
    for col,direction in enumerate((0,2,5)):
        d.text((col*400+18,46),f"D{direction} / landing legs retracted",font=font(12),fill=(142,161,177))
    d.text((18,357),"Flight span 7.20 / faction livery preview / nozzle-only glow",font=font(12),fill=(210,181,119))
    save("transport-B-flight",im)
    # Same direction, anchors and pixel metric for both wing poses.
    comparison=np.full((620,800,4),BG,np.uint8)
    for col,sid in enumerate(("folded-r2","fly-d2")):
        paste(comparison,sid,180+col*400,270)
        paste(comparison,sid,180+col*400,550,silhouette=True)
    C.over(comparison,post.to_rgba(c,op),round(325-an["x"]-1),round(270-an["y"]-1))
    im=Image.fromarray(comparison)
    d=ImageDraw.Draw(im)
    d.text((18,14),"TRANSPORT / B6 — FOLDED AND DEPLOYED",font=font(18),fill=(213,224,233))
    for col,label in enumerate(("FOLDED / 1.60 circular airlock hatch","DEPLOYED / 7.20 span")):
        d.text((18+col*400,48),label,font=font(12),fill=(142,161,177))
    d.text((18,335),"Matching silhouettes / same heading / native 1x pixel scale",font=font(12),fill=(210,181,119))
    d.text((294,294),"1.5 crew",font=font(10),fill=(142,161,177))
    save("transport-B-silhouettes",im)
    keys=np.full((380,1200,4),BG,np.uint8)
    for col,direction in enumerate((0,2,5)):
        paste(keys,f"fly-d{direction}",200+col*400,280,faction=False)
    im=Image.fromarray(keys)
    d=ImageDraw.Draw(im)
    d.text((18,14),"TRANSPORT / B6 — RAW EXPORT KEYS",font=font(18),fill=(213,224,233))
    d.text((18,357),"Exact #ff0000 primary / #00ff00 secondary. Faction preview colours are presentation only.",font=font(12),fill=(142,161,177))
    save("transport-B-export-keys",im)
    previous=ROOT/"artifacts/shuttle-sweepback-r5"
    comparison_names=[]
    if (previous/"preview.manifest.json").exists():
        old=json.loads((previous/"preview.manifest.json").read_text())
        before_after=np.full((340,800,4),BG,np.uint8)
        a=old["assets"]["fly-d2"]["anchor"]
        C.over(before_after,recolor(np.array(Image.open(previous/"fly-d2.png"))),
               round(180-a["x"]),round(260-a["y"]))
        C.add(before_after,np.array(Image.open(previous/"fly-d2.glow.png")),
              round(180-a["x"]),round(260-a["y"]))
        paste(before_after,"fly-d2",580,260)
        im=Image.fromarray(before_after)
        d=ImageDraw.Draw(im)
        d.text((18,14),"TRANSPORT / BEFORE AND AFTER",font=font(18),fill=(213,224,233))
        d.text((18,47),"B5 / previous revision",font=font(12),fill=(142,161,177))
        d.text((418,47),"B6 / shaped nose, hatch and mounts",font=font(12),fill=(142,161,177))
        d.text((18,317),"Same heading, pixel scale and review livery",font=font(12),fill=(210,181,119))
        save("transport-B-before-after",im)
        comparison_names.append("transport-B-before-after")
    plan=np.full((360,880,4),BG,np.uint8)
    for col,sid in enumerate(("plan-folded","plan-deployed")):
        paste(plan,sid,220+col*440,200)
    im=Image.fromarray(plan)
    d=ImageDraw.Draw(im)
    d.text((18,14),"TRANSPORT / B6 — WING PLANFORM",font=font(18),fill=(213,224,233))
    d.text((18,46),"FOLDED / 4 x 5 bay outline",font=font(12),fill=(142,161,177))
    d.text((458,46),"DEPLOYED / 2.70 fore-aft wing chord",font=font(12),fill=(142,161,177))
    px=64/math.sqrt(2)
    d.rectangle((220-2*px,200-2.5*px,220+2*px,200+2.5*px),outline=(142,161,177))
    d.text((18,335),"Outer panels fold flat over aft roof / 7.20 deployed span",font=font(12),fill=(210,181,119))
    save("transport-B-planform",im)
    ramps=np.full((420,900,4),BG,np.uint8)
    for col,sid in enumerate(("ramp-closed","ramp-lowered")):
        paste(ramps,sid,220+col*450,260)
    im=Image.fromarray(ramps)
    d=ImageDraw.Draw(im)
    d.text((18,14),"TRANSPORT / B6 — ANGLED REAR LOADING RAMP",font=font(18),fill=(213,224,233))
    d.text((18,46),"CLOSED / upper edge aft, hinge tucked forward",font=font(12),fill=(142,161,177))
    d.text((468,46),"LOWERED / traction ribs and loading surface",font=font(12),fill=(142,161,177))
    d.text((18,395),"Mechanism preview / interior stays opaque / lowered ramp extends beyond parked envelope",font=font(11),fill=(210,181,119))
    save("transport-B-ramp",im)
    raw=np.array(Image.open(out/"folded-r0.png"))
    on=raw[...,3]>0
    colors=raw[on,:3]
    checks={"redKeyPixels":int(np.all(colors==[255,0,0],axis=1).sum()),
            "greenKeyPixels":int(np.all(colors==[0,255,0],axis=1).sum()),"exact3x":True}
    assert checks["redKeyPixels"]>20 and checks["greenKeyPixels"]>5
    for sid in man["assets"]:
        rgba=np.array(Image.open(out/(sid+".png")))
        assert set(np.unique(rgba[...,3])).issubset({0,255})
    for name in ["transport-B-parked","transport-B-flight","transport-B-silhouettes","transport-B-export-keys","transport-B-planform","transport-B-ramp"]+comparison_names:
        a=np.array(Image.open(out/(name+"-1x.png")))
        b=np.array(Image.open(out/(name+"-3x.png")))
        for dy in range(3):
            for dx in range(3):
                np.testing.assert_array_equal(b[dy::3,dx::3],a)
    (out/"pixel-checks.json").write_text(json.dumps(checks,indent=2)+"\n")
    print("PREVIEW CHECKS",checks)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--compose",action="store_true")
    p.add_argument("--flight-only",action="store_true")
    p.add_argument("--validate-only",action="store_true")
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    a.out.mkdir(parents=True,exist_ok=True)
    compose(a.out) if a.compose else render(a.out,a.flight_only,a.validate_only)
