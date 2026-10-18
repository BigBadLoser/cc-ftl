"""Engine layer composites against shipped walls/deck/crew at exact game scale."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"tools/blender"))
from sprites import compose, post  # noqa: E402

AS=ROOT/"public/assets"
MAN=json.loads((AS/"manifest.json").read_text())
CACHE={}
REVIEW={"assets":{},"sheets":{}}
REVIEW_OUT=None
W,H=720,500


def load(path):
    if str(path) not in CACHE:
        CACHE[str(path)]=np.array(Image.open(path).convert("RGBA"))
    return CACHE[str(path)]


def asset(cv,aid,x,y,dim=1):
    man=REVIEW if aid in REVIEW["assets"] else MAN
    root=REVIEW_OUT if man is REVIEW else AS
    a=man["assets"][aid]
    f,an=a["frame"],a["anchor"]
    sheet=load(root/man["sheets"][a["sheet"]]["image"])
    fr=sheet[f["y"]:f["y"]+f["h"],f["x"]:f["x"]+f["w"]].copy()
    fr[...,:3]=(fr[...,:3]*dim).astype(np.uint8)
    compose.over(cv,fr,round(x-an["x"]),round(y-an["y"]))


def crew(cv,x,y,d,orange=False):
    ids=["body","eyes.organic","legs.cargo_pants","torso.work_shirt",
         "arm.R.flesh","arm.L.flesh","hair.short","gear.belt.tool_belt"]
    items=sorted((MAN["assets"]["crew.human."+n] for n in ids),key=lambda a:a["order"])
    stack=None
    for a in items:
        fw,fh=a["frameW"],a["frameH"]
        col=a["clips"]["idle"]["start"]
        sh=load(AS/MAN["sheets"][a["sheet"]]["image"])
        fr=sh[d*fh:(d+1)*fh,col*fw:(col+1)*fw]
        fr=compose.remap_keys(fr,{"team.skin":(212,156,116),"team.cloth":(201,140,50) if orange else (114,132,95),
                                 "team.hair":(58,42,30),"team.accent":(201,162,39)})
        if stack is None:
            stack=np.zeros_like(fr)
        compose.over(stack,fr,0,0)
    c,op=post.outline(stack[...,:3],stack[...,3]>0,True)
    an=items[0]["anchor"]
    compose.over(cv,post.to_rgba(c,op),round(x-an["x"]-1),round(y-an["y"]-1))


def sorted_depth(items):
    """Footprint partial order: draw an object only after its rear neighbours."""
    result=[]
    rest=list(items)
    def behind(a,b):
        return (a[1]<=b[0]+1e-6 or a[3]<=b[2]+1e-6) and not (b[1]<=a[0]+1e-6 or b[3]<=a[2]+1e-6)
    while rest:
        for a in rest:
            if not any(b is not a and behind(b,a) for b in rest):
                result.append(a)
                rest.remove(a)
                break
        else:
            rest.sort(key=lambda a:a[1]+a[3])
            result.append(rest.pop(0))
    return result


def scene(out,man,rot,hot,cut):
    cv=np.full((H,W,4),(10,15,23,255),np.uint8)
    rng=np.random.default_rng(27)
    for _ in range(90):
        cv[rng.integers(0,H),rng.integers(0,W),:3]=rng.integers(40,90)
    def T(x,y):
        return 330+(x-y)*32,150+(x+y)*16
    if rot==1:
        front=(4,3)
        floor=[(x,y) for x in range(-3,5) for y in range(-3,8)]
        walls=[(4,y,5) for y in (-3,-2,-1,4,5,6,7)]
        people=[(0.0,5.0,6),(2.0,5.7,6),(-1.5,-1.2,0)]
        footprint=(-0.5,6.1,-0.5,3.5)
    else:
        front=(3,4)
        floor=[(x,y) for x in range(-3,7) for y in range(0,8)]
        walls=[(x,0,10) for x in (-3,-2,-1,4,5,6)]
        people=[(1.5,5.8,5),(-1.2,2.6,7),(5.0,3.5,2)]
        footprint=(-0.5,3.5,-2.1,4.5)
    for x,y in floor:
        asset(cv,"tile.floor.a",*T(x,y),dim=0.64)
    # Composite hull first, machine second, at the SAME world anchor, with each
    # cropped layer's own metadata offset. Bulkhead is identical in both scenes.
    def engine():
        x,y=T(*front)
        for part in ("hull","machine"):
            sid=f"module.engine.{part}.r{rot}"+(".active" if hot and part=="machine" else "")
            a=man["assets"][sid]
            an=a["anchor"]
            compose.over(cv,load(out/man["sheets"][sid]["image"]),round(x-an["x"]),round(y-an["y"]))
            compose.add(cv,load(out/man["sheets"][sid]["glow"]),round(x-an["x"]),round(y-an["y"]))
    items=[(*footprint,engine)]
    for x,y,m in walls:
        aid=f"tile.hull.{'' if cut else 'full.'}m{m}"
        items.append((x-.5,x+.5,y-.5,y+.5,lambda aid=aid,x=x,y=y:asset(cv,aid,*T(x,y))))
    for i,(x,y,d) in enumerate(people):
        items.append((x-.2,x+.2,y-.2,y+.2,lambda x=x,y=y,d=d,i=i:crew(cv,*T(x,y),d,orange=i==0)))
    for item in sorted_depth(items):
        item[4]()
    tag=f"r{rot}-{'active' if hot else 'idle'}-{'cut' if cut else 'full'}"
    im=Image.fromarray(cv)
    im.save(out/(f"scene-{tag}-1x.png"))
    im.resize((W*3,H*3),Image.Resampling.NEAREST).save(out/(f"scene-{tag}-3x.png"))
    return im


def layer_composite(out,man,rot,hot):
    ids=[f"module.engine.hull.r{rot}",f"module.engine.machine.r{rot}"+(".active" if hot else "")]
    entries=[man["assets"][sid] for sid in ids]
    left=min(-a["anchor"]["x"] for a in entries)
    top=min(-a["anchor"]["y"] for a in entries)
    right=max(a["frame"]["w"]-a["anchor"]["x"] for a in entries)
    bottom=max(a["frame"]["h"]-a["anchor"]["y"] for a in entries)
    cv=np.zeros((bottom-top,right-left,4),np.uint8)
    for sid,a in zip(ids,entries):
        x,y=-a["anchor"]["x"]-left,-a["anchor"]["y"]-top
        compose.over(cv,load(out/man["sheets"][sid]["image"]),x,y)
        compose.add(cv,load(out/man["sheets"][sid]["glow"]),x,y)
    tag=f"engine-r{rot}-{'active' if hot else 'idle'}"
    im=Image.fromarray(cv)
    im.save(out/(tag+"-1x.png"))
    im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(out/(tag+"-3x.png"))


def sheets(out,rots):
    for cut in (False,True):
        sheet=Image.new("RGB",(W*len(rots),H*2+100),(10,15,23))
        d=ImageDraw.Draw(sheet)
        for col,r in enumerate(rots):
            for row,hot in enumerate((False,True)):
                tag=f"r{r}-{'active' if hot else 'idle'}-{'cut' if cut else 'full'}"
                im=Image.open(out/(f"scene-{tag}-1x.png")).convert("RGB")
                x,y=col*W,50+row*(H+30)
                sheet.paste(im,(x,y))
                label=f"R{r} / {'ACTIVE' if hot else 'IDLE'} / {'NEIGHBOURS CUT DOWN' if cut else 'FULL HULL'}"
                d.text((x+20,y-30),label,font=ImageFont.load_default(size=17),fill=(205,217,227))
        tag="cutaway-review" if cut else "full-hull-review"
        sheet.save(out/(tag+"-1x.png"))
        sheet.resize((sheet.width*3,sheet.height*3),Image.Resampling.NEAREST).save(out/(tag+"-3x.png"))


def main():
    global REVIEW,REVIEW_OUT
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    a=p.parse_args()
    context=a.out/"review.manifest.json"
    if context.exists():
        REVIEW=json.loads(context.read_text())
        REVIEW_OUT=a.out
    man=json.loads((a.out/"manifest.fragment.json").read_text())
    rots=sorted(int(s[-1]) for s in man["assets"] if s.startswith("module.engine.hull.r"))
    for r in rots:
        for hot in (False,True):
            sid=f"module.engine.machine.r{r}"+(".active" if hot else "")
            if sid not in man["assets"]:
                continue
            layer_composite(a.out,man,r,hot)
            # Installed layouts have been reviewed only for r0/r1. Other
            # rotations still receive correctly anchored layer composites.
            if r in (0,1):
                for cut in (False,True):
                    scene(a.out,man,r,hot,cut)
    context_rots=[r for r in rots if r in (0,1)]
    if context_rots and all(f"module.engine.machine.r{r}.active" in man["assets"] and
                            f"module.engine.machine.r{r}" in man["assets"] for r in context_rots):
        sheets(a.out,context_rots)


if __name__=="__main__":
    main()
