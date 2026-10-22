"""Quick standalone 128x64 reactor preview; one Blender process, no atlas writes.

SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup \
 --python-exit-code 1 --python tools/blender/review/reactor_preview.py -- --out artifacts/reactor-v1
python3 tools/blender/review/reactor_preview.py --out artifacts/reactor-v1 --compose
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


def render(out):
    import bpy
    from sprites import core,post
    from sprites.reactor_vessel import reactor_vessel,FOOTPRINT
    assert (core.TILE_W,core.TILE_H)==(128,64)
    core.setup_scene()
    core._state["scene"].cycles.samples=4
    obs=reactor_vessel(0,True)
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
    assert np.abs(q[:,0]).max()<2 and np.abs(q[:,1]).max()<1.5
    assert q[:,2].min()>=-1e-6 and q[:,2].max()<1.85
    meta={"tile":[128,64],"footprint":FOOTPRINT,"origin":"footprint centre / deck z=0",
          "measuredSize":[round(float(v),4) for v in np.ptp(q,axis=0)],
          "height":round(float(q[:,2].max()),4),"floorSlab":False,"state":"active",
          "samples":4,"supersample":core.SS,"previewOnly":True,"geometryChecks":"passed"}
    xmin,xmax,ymin,ymax=core.extent_px(obs)
    w=2*(math.ceil(max(-xmin,xmax))+12)
    h=2*(math.ceil(max(-ymin,ymax))+12)
    rgb,a=core.render(w,h,"color")
    c,op=post.downsample(rgb,a>.5,core.SS,8,True)
    c,op=post.outline(c,op,True)
    rgb,_=core.render(w,h,"glow")
    g=np.pad(post.glow_down(rgb,core.SS,3),((1,1),(1,1),(0,0)))
    x0,y0,x1,y1=post.crop_box(op|(g[...,3]>0))
    rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
    glow=g[y0:y1,x0:x1]
    assert set(np.unique(rgba[...,3])).issubset({0,255})
    post.write_png(out/"reactor.png",rgba)
    post.write_png(out/"reactor.glow.png",glow)
    meta["anchor"]={"x":w//2+1-int(x0),"y":h//2+1-int(y0)}
    meta["spritePixels"]=[int(x1-x0),int(y1-y0)]
    (out/"design.json").write_text(json.dumps(meta,indent=2)+"\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"reactor-preview.blend"),compress=True)
    print("REACTOR PREVIEW",meta,flush=True)


def compose(out):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    raw=np.array(Image.open(out/"reactor.png"))
    glow=np.array(Image.open(out/"reactor.glow.png"))
    w,h=raw.shape[1]+64,raw.shape[0]+100
    cv=np.full((h,w,4),BG,np.uint8)
    C.over(cv,raw,32,67)
    C.add(cv,glow,32,67,.8)
    im=Image.fromarray(cv).convert("RGB")
    d=ImageDraw.Draw(im)
    font=lambda n:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",n)
    d.text((20,15),"REACTOR / V1",font=font(18),fill=(213,224,233))
    d.text((20,40),"4 x 3 tiles / 128 x 64 / quick shape preview",font=font(12),fill=(142,161,177))
    im.save(out/"reactor-preview-1x.png")
    big=im.resize((w*3,h*3),Image.Resampling.NEAREST)
    big.save(out/"reactor-preview-3x.png")
    for dy in range(3):
        for dx in range(3):
            np.testing.assert_array_equal(np.array(big)[dy::3,dx::3],np.array(im))
    (out/"pixel-checks.json").write_text(json.dumps({"binaryAlpha":True,"exact3x":True},indent=2)+"\n")
    print("PREVIEW PIXEL CHECKS passed")


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--compose",action="store_true")
    a=p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    a.out.mkdir(parents=True,exist_ok=True)
    compose(a.out) if a.compose else render(a.out)
