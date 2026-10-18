"""Native-size review boards, shipped crew for scale, exact 3x enlargement."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"tools/blender"))
from sprites import compose, post

BG=(13,19,28,255)
INK=(209,219,228)
MUTED=(134,154,172)
AMBER=(218,173,92)
FONT=Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def font(size):
    return ImageFont.truetype(str(FONT),size)


def crew_sprite(direction):
    assets=ROOT/"public/assets"
    man=json.loads((assets/"manifest.json").read_text())
    names=["body","eyes.organic","legs.cargo_pants","torso.work_shirt",
           "arm.R.flesh","arm.L.flesh","hair.short","gear.belt.tool_belt"]
    items=sorted((man["assets"]["crew.human."+n] for n in names),key=lambda a:a["order"])
    stack=None
    for a in items:
        fw,fh=a["frameW"],a["frameH"]
        col=a["clips"]["idle"]["start"]
        image=np.array(Image.open(assets/man["sheets"][a["sheet"]]["image"]).convert("RGBA"))
        fr=image[direction*fh:(direction+1)*fh,col*fw:(col+1)*fw]
        fr=compose.remap_keys(fr,{"team.skin":(212,156,116),"team.cloth":(201,140,50),
                                 "team.hair":(58,42,30),"team.accent":(201,162,39)})
        if stack is None:
            stack=np.zeros_like(fr)
        compose.over(stack,fr,0,0)
    c,op=post.outline(stack[...,:3],stack[...,3]>0,True)
    anchor=items[0]["anchor"]
    return post.to_rgba(c,op),(anchor["x"]+1,anchor["y"]+1)


def project(rot,u,v,z=0):
    cx,cy=((0,-1.5) if rot%2==0 else (-1.5,0))
    xy=((cx+v,cy-u),(cx+u,cy+v),(cx-v,cy+u),(cx-u,cy-v))[rot]
    return (xy[0]-xy[1])*32,(xy[0]+xy[1])*16-z*39.19184


class Review:
    def __init__(self,out):
        self.out=out
        self.man=json.loads((out/"review.manifest.json").read_text())
        self.cache={}

    def pixels(self,sid,glow=False):
        key=(sid,glow)
        if key not in self.cache:
            a=self.man["assets"][sid]
            path=self.out/self.man["sheets"][a["sheet"]]["glow" if glow else "image"]
            self.cache[key]=np.array(Image.open(path).convert("RGBA"))
        return self.cache[key].copy()

    def add(self,cv,sid,x,y,ghost=False):
        a=self.man["assets"][sid]
        im=self.pixels(sid)
        if ghost:
            im[...,:3]=(im[...,:3]*.62).astype(np.uint8)
            im[...,3]=(im[...,3]*.24).astype(np.uint8)
        xx,yy=round(x-a["anchor"]["x"]),round(y-a["anchor"]["y"])
        compose.over(cv,im,xx,yy)
        if not ghost:
            compose.add(cv,self.pixels(sid,True),xx,yy)

    def save(self,name,im):
        im.convert("RGB").save(self.out/(name+"-1x.png"))
        im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).convert("RGB").save(self.out/(name+"-3x.png"))

    def installation(self,rot,mode):
        cv=np.full((270,370,4),BG,np.uint8)
        # Align the module centres, not their differently cropped image boxes.
        px,py=project(rot,0,0)
        x,y=185-px,170-py
        self.add(cv,f"scene.r{rot}.{mode}",x,y)
        if mode=="ghost":
            self.add(cv,f"scene.r{rot}.ghost-overlay",x,y,True)
            # Keep the complete pressure tube opaque above ghost hull overlays.
            self.add(cv,f"state.r{rot}.sealed",x,y)
        crew,anchor=crew_sprite(7 if rot==0 else 1)
        px,py=project(rot,-2.50,1.12)
        compose.over(cv,crew,round(x+px-anchor[0]),round(y+py-anchor[1]))
        im=Image.fromarray(cv)
        d=ImageDraw.Draw(im)
        d.text((14,12),f"R{rot} / "+("NORTH HULL" if rot==0 else "EAST HULL"),font=font(12),fill=INK)
        d.text((14,247),"1 x 4 tiles  /  64 x 32 px per tile",font=font(10),fill=MUTED)
        return im

    def installations(self):
        modes=(("full","WALLS UP / 1.85"),("cut","CUTAWAY / 0.38"),("ghost","SHORTEST / HULL GHOST"))
        board=Image.new("RGBA",(740,968),BG)
        d=ImageDraw.Draw(board)
        d.text((18,12),"AIRLOCK / 01",font=font(20),fill=INK)
        d.text((18,41),"Opaque pressure tube in every view. Only an open door reveals the chamber.",font=font(11),fill=MUTED)
        for row,(mode,label) in enumerate(modes):
            y=68+row*300
            d.text((18,y),label,font=font(12),fill=AMBER)
            for rot in (0,1):
                scene=self.installation(rot,mode)
                scene.save(self.out/f"installation-r{rot}-{mode}-1x.png")
                scene.resize((1110,810),Image.Resampling.NEAREST).save(self.out/f"installation-r{rot}-{mode}-3x.png")
                board.paste(scene,(rot*370,y+18))
        self.save("airlock-installations",board)
        for mode,label in modes:
            pair=Image.new("RGBA",(740,308),BG)
            dd=ImageDraw.Draw(pair)
            dd.text((16,9),"AIRLOCK / "+label,font=font(15),fill=INK)
            for rot in (0,1):
                pair.paste(self.installation(rot,mode),(rot*370,33))
            self.save("airlock-"+mode,pair)

    def state_cell(self,rot,state,label):
        cv=np.full((240,190,4),BG,np.uint8)
        px,py=project(rot,0,0)
        self.add(cv,f"state.r{rot}.{state}",95-px,174-py)
        im=Image.fromarray(cv)
        d=ImageDraw.Draw(im)
        d.text((10,10),f"R{rot} / "+label,font=font(11),fill=INK)
        return im

    def doors(self):
        for which in ("inner","outer"):
            board=Image.new("RGBA",(760,558),BG)
            d=ImageDraw.Draw(board)
            d.text((17,12),"AIRLOCK / "+which.upper()+" DOOR",font=font(18),fill=INK)
            d.text((17,40),"Opposite door remains shut. Amber = cycling, red = locked, green = open.",font=font(11),fill=MUTED)
            states=(("sealed","CLOSED"),(which+"-opening","OPENING / 50%"),(which+"-open","OPEN"),("cycling","CYCLING / 4 s"))
            for rot in (0,1):
                for col,(state,label) in enumerate(states):
                    board.paste(self.state_cell(rot,state,label),(col*190,62+rot*240))
            self.save("airlock-doors-"+which,board)
        # Short loop illustrates the mechanical interlock and actual 4 s wait.
        timeline=[("inner-open","INNER OPEN",900),("inner-opening","INNER CLOSING",220),
                  ("sealed","BOTH SEALED",220)]
        timeline += [("cycling",f"DEPRESSURISING / {4-i//2} s",500) for i in range(8)]
        timeline += [("outer-opening","OUTER OPENING",220),("outer-open","OUTER OPEN",900),
                     ("outer-opening","OUTER CLOSING",220),("sealed","BOTH SEALED",220)]
        timeline += [("cycling",f"PRESSURISING / {4-i//2} s",500) for i in range(8)]
        timeline += [("inner-opening","INNER OPENING",220)]
        frames=[]
        durations=[]
        for i,(state,label,duration) in enumerate(timeline):
            canvas=Image.new("RGBA",(420,280),BG)
            d=ImageDraw.Draw(canvas)
            d.text((13,10),"AIRLOCK / "+label,font=font(14),fill=INK)
            for rot in (0,1):
                cell=self.state_cell(rot,state,"INTERLOCK ACTIVE")
                if state=="cycling" and i%2:
                    # Blink overlay only; door geometry remains the sealed pose.
                    cell=self.state_cell(rot,"sealed","INTERLOCK ACTIVE")
                canvas.paste(cell,(20+rot*200,34))
            frames.append(canvas.resize((840,560),Image.Resampling.NEAREST).convert("RGB"))
            durations.append(duration)
        frames[0].save(self.out/"airlock-cycle.gif",save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    args=p.parse_args()
    r=Review(args.out)
    r.installations()
    r.doors()


if __name__=="__main__":
    main()
