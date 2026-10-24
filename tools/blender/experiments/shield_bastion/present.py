"""Native/3x shield review sheets using the shipped deck and crew."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"tools/blender"))
from sprites import compose,post

AS=ROOT/"public/assets/2x"
MAN=json.loads((AS/"manifest.json").read_text())
CACHE={}


def load(path):
    if str(path) not in CACHE:
        CACHE[str(path)]=np.array(Image.open(path).convert("RGBA"))
    return CACHE[str(path)]


def asset(cv,sid,x,y):
    a=MAN["assets"][sid]
    fr,an=a["frame"],a["anchor"]
    sh=load(AS/MAN["sheets"][a["sheet"]]["image"])
    im=sh[fr["y"]:fr["y"]+fr["h"],fr["x"]:fr["x"]+fr["w"]].copy()
    im[...,:3]=(im[...,:3]*.70).astype(np.uint8)
    compose.over(cv,im,round(x-an["x"]),round(y-an["y"]))


def crew(cv,x,y):
    ids=["body","eyes.organic","legs.cargo_pants","torso.work_shirt",
         "arm.R.flesh","arm.L.flesh","hair.short","gear.belt.tool_belt"]
    items=sorted((MAN["assets"]["crew.human."+n] for n in ids),key=lambda a:a["order"])
    stack=None
    for a in items:
        fw,fh=a["frameW"],a["frameH"]
        col=a["clips"]["idle"]["start"]
        sh=load(AS/MAN["sheets"][a["sheet"]]["image"])
        fr=sh[5*fh:6*fh,col*fw:(col+1)*fw]
        fr=compose.remap_keys(fr,{"team.skin":(212,156,116),"team.cloth":(201,140,50),
                                 "team.hair":(58,42,30),"team.accent":(201,162,39)})
        if stack is None:
            stack=np.zeros_like(fr)
        compose.over(stack,fr,0,0)
    c,op=post.outline(stack[...,:3],stack[...,3]>0,True)
    an=items[0]["anchor"]
    compose.over(cv,post.to_rgba(c,op),round(x-an["x"]-1),round(y-an["y"]-1))


def local(cv,out,man,sid,x,y):
    a=man["assets"][sid]
    an=a["anchor"]
    dx,dy=round(x-an["x"]),round(y-an["y"])
    compose.over(cv,load(out/man["sheets"][sid]["image"]),dx,dy)
    compose.add(cv,load(out/man["sheets"][sid]["glow"]),dx,dy)


def save(im,out,tag):
    im.save(out/(tag+"-1x.png"))
    im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(out/(tag+"-3x.png"))


def scene(out,man,small,active):
    cv=np.full((330,400,4),(12,17,25,255),np.uint8)
    def T(x,y):
        return 200+(x-y)*32,225+(x+y)*16
    for x in range(-2,3):
        for y in range(-3,3):
            asset(cv,"tile.floor.a",*T(x,y))
    local(cv,out,man,"review.wall",*T(0,0))
    sid="module.shield_gen"+("_small" if small else "")+".r0"+(".active" if active else "")
    local(cv,out,man,sid,*T(0,0))
    crew(cv,*T(1.25,.9))
    im=Image.fromarray(cv)
    d=ImageDraw.Draw(im)
    title=("WARD / 2 X 2" if small else "BASTION / 2 X 3")+" / "+("ACTIVE" if active else "UNPOWERED")
    d.text((14,12),title,font=ImageFont.load_default(size=12),fill=(218,224,235))
    d.text((14,31),"R0 / SHIP DECK / 2.4-HIGH WALL",font=ImageFont.load_default(size=10),fill=(127,146,166))
    return im


def main():
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    a=p.parse_args()
    # Same camera scale for both units; retain individual full-size renders.
    if all((a.out/("blender-"+size+".png")).exists() for size in ("large","small")):
        cv=Image.new("RGB",(1760,860),(12,17,25))
        d=ImageDraw.Draw(cv)
        for i,(size,title) in enumerate((("large","BASTION / SHIELD GENERATOR / 2 X 3"),
                                         ("small","WARD / SMALL SHIELD GENERATOR / 2 X 2"))):
            im=Image.open(a.out/("blender-"+size+".png")).convert("RGB")
            cv.paste(im.resize((880,800),Image.Resampling.LANCZOS),(i*880,60))
            d.text((i*880+22,18),title,font=ImageFont.load_default(size=20),fill=(216,224,237))
        cv.save(a.out/"blender-both.png")
    man=json.loads((a.out/"manifest.fragment.json").read_text())
    extra=json.loads((a.out/"review.manifest.json").read_text())
    man={**man,"assets":{**man["assets"],**extra["assets"]},"sheets":{**man["sheets"],**extra["sheets"]}}
    full=Image.new("RGBA",(800,660),(12,17,25,255))
    for small in (False,True):
        tag="small" if small else "large"
        pair=Image.new("RGBA",(800,330),(12,17,25,255))
        for i,active in enumerate((False,True)):
            im=scene(a.out,man,small,active)
            pair.paste(im,(i*400,0))
        save(pair,a.out,tag+"-review")
        full.paste(pair,(0,330 if small else 0))
        strip=Image.new("RGBA",(210*7,230),(12,17,25,255))
        for i,pose in enumerate(("stowed","deploy.f0","deploy.f1","deploy.f2","deploy.f3","deploy.f4","active")):
            cv=np.full((230,210,4),(12,17,25,255),np.uint8)
            local(cv,a.out,man,"review.roof."+tag,105,235)
            sid="roof.shield_gen"+("_small" if small else "")+"."+pose
            local(cv,a.out,man,sid,105,235)
            im=Image.fromarray(cv)
            d=ImageDraw.Draw(im)
            d.text((10,12),"DEPLOYED / ACTIVE" if pose=="active" else pose.upper(),font=ImageFont.load_default(size=11),fill=(216,224,237))
            d.text((10,29),("WARD" if small else "BASTION")+" / ROOF Z = 2.4",font=ImageFont.load_default(size=9),fill=(127,146,166))
            strip.paste(im,(i*210,0))
        save(strip,a.out,tag+"-deploy-strip")
    save(full,a.out,"both-modules-review")


if __name__=="__main__":
    main()
