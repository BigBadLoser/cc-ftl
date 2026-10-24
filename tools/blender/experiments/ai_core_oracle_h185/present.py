"""Review sheets, exact native pixel scale and nearest-neighbour 3x."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"tools/blender"))
from sprites import compose, post

AS=ROOT/"public/assets/2x"
MAN=json.loads((AS/"manifest.json").read_text())
CACHE={}


def load(path):
    if str(path) not in CACHE:
        CACHE[str(path)]=np.array(Image.open(path).convert("RGBA"))
    return CACHE[str(path)]


def asset(cv,aid,x,y,dim=.70):
    a=MAN["assets"][aid]
    fr,an=a["frame"],a["anchor"]
    sh=load(AS/MAN["sheets"][a["sheet"]]["image"])
    im=sh[fr["y"]:fr["y"]+fr["h"],fr["x"]:fr["x"]+fr["w"]].copy()
    im[...,:3]=(im[...,:3]*dim).astype(np.uint8)
    compose.over(cv,im,round(x-an["x"]),round(y-an["y"]))


def crew(cv,x,y,d=5):
    ids=["body","eyes.organic","legs.cargo_pants","torso.work_shirt",
         "arm.R.flesh","arm.L.flesh","hair.short","gear.belt.tool_belt"]
    items=sorted((MAN["assets"]["crew.human."+n] for n in ids),key=lambda a:a["order"])
    stack=None
    for a in items:
        fw,fh=a["frameW"],a["frameH"]
        col=a["clips"]["idle"]["start"]
        sh=load(AS/MAN["sheets"][a["sheet"]]["image"])
        fr=sh[d*fh:(d+1)*fh,col*fw:(col+1)*fw]
        fr=compose.remap_keys(fr,{"team.skin":(212,156,116),"team.cloth":(201,140,50),
                                 "team.hair":(58,42,30),"team.accent":(201,162,39)})
        if stack is None:
            stack=np.zeros_like(fr)
        compose.over(stack,fr,0,0)
    c,op=post.outline(stack[...,:3],stack[...,3]>0,True)
    an=items[0]["anchor"]
    compose.over(cv,post.to_rgba(c,op),round(x-an["x"]-1),round(y-an["y"]-1))


def local(cv,out,man,sid,x,y,opacity=1):
    a=man["assets"][sid]
    an=a["anchor"]
    dx,dy=round(x-an["x"]),round(y-an["y"])
    image=load(out/man["sheets"][sid]["image"]).copy()
    image[...,3]=(image[...,3]*opacity).astype(np.uint8)
    compose.over(cv,image,dx,dy)
    compose.add(cv,load(out/man["sheets"][sid]["glow"]),dx,dy,gain=opacity)


def save(im,out,name):
    im.save(out/(name+"-1x.png"))
    im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(out/(name+"-3x.png"))


def scene(out,man,active,ghost=False):
    cv=np.full((340 if ghost else 280,340,4),(12,17,25,255),np.uint8)
    def T(x,y):
        return 170+(x-y)*32,(237 if ghost else 177)+(x+y)*16
    for x in range(-2,3):
        for y in range(-2,3):
            asset(cv,"tile.floor.a",*T(x,y))
    local(cv,out,man,"review.wall",*T(0,0))
    local(cv,out,man,"module.ai_core.r0"+(".active" if active else ""),*T(0,0))
    if ghost:
        local(cv,out,man,"roof.ai_core.active",*T(0,0),opacity=.30)
    crew(cv,*T(1.35,.75))
    im=Image.fromarray(cv)
    d=ImageDraw.Draw(im)
    font=ImageFont.load_default(size=12)
    d.text((14,12),"ORACLE / R0 / "+("ACTIVE" if active else "UNPOWERED"),font=font,fill=(218,224,235))
    d.text((14,31),"2 x 2 / WALL 1.85 / ROOF 2.05",font=ImageFont.load_default(size=10),fill=(127,146,166))
    if ghost:
        d.text((14,49),"PLAYER CUTAWAY / 30% MAST GHOST",font=ImageFont.load_default(size=10),fill=(127,146,166))
    return im


def main():
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    a=p.parse_args()
    man=json.loads((a.out/"manifest.fragment.json").read_text())
    review=a.out/"review.manifest.json"
    if review.exists():
        extra=json.loads(review.read_text())
        man={**man,"assets":{**man["assets"],**extra["assets"]},
             "sheets":{**man["sheets"],**extra["sheets"]}}
    if all(f"module.ai_core.r{r}.active" in man["assets"] for r in range(4)):
        cv=np.full((380,720,4),(12,17,25,255),np.uint8)
        for r in range(4):
            for row,hot in enumerate((False,True)):
                sid=f"module.ai_core.r{r}"+(".active" if hot else "")
                local(cv,a.out,man,sid,90+r*180,170+row*180)
        im=Image.fromarray(cv)
        d=ImageDraw.Draw(im)
        for r in range(4):
            for row,state in enumerate(("UNPOWERED","ACTIVE")):
                d.text((r*180+18,row*180+12),f"R{r} / {state}",font=ImageFont.load_default(size=11),fill=(216,224,237))
        save(im,a.out,"all-rotations")
    if "review.wall" in man["assets"]:
        sheet=Image.new("RGBA",(680,280),(12,17,25,255))
        for i,hot in enumerate((False,True)):
            im=scene(a.out,man,hot)
            save(im,a.out,"core-r0-"+("active" if hot else "idle"))
            sheet.paste(im,(i*340,0))
        save(sheet,a.out,"core-r0-review")
    poses=["stowed","deploy.f0","deploy.f1","deploy.f2","deploy.f3","deploy.f4","active"]
    if "roof.ai_core.active" not in man["assets"]:
        return
    save(scene(a.out,man,True,ghost=True),a.out,"core-active-cutaway")
    sheet=Image.new("RGBA",(196*7,218),(12,17,25,255))
    for i,pose in enumerate(poses):
        cv=np.full((218,196,4),(12,17,25,255),np.uint8)
        x,y=98,217
        local(cv,a.out,man,"review.roof",x,y)
        local(cv,a.out,man,"roof.ai_core."+pose,x,y)
        im=Image.fromarray(cv)
        d=ImageDraw.Draw(im)
        label="DEPLOYED / ACTIVE" if pose=="active" else pose.upper()
        d.text((10,12),label,font=ImageFont.load_default(size=11),fill=(216,224,237))
        d.text((10,29),"ROOF Z = 2.05",font=ImageFont.load_default(size=9),fill=(127,146,166))
        sheet.paste(im,(i*196,0))
    save(sheet,a.out,"mast-deploy-strip")


if __name__=="__main__":
    main()
