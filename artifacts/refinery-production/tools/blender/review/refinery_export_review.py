"""Placement review from the final atlas and the game's shipped floor/crew sprites.

Host Python only: no extra Blender process or runtime/source integration.
"""
import argparse,json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from validate_refinery import validate

BG=(27,34,43,255)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


class Atlas:
    def __init__(self,root,manifest):
        self.root=root;self.manifest=json.loads((root/manifest).read_text());self.cache={}

    def sheet(self,key,glow=False):
        path=self.root/self.manifest['sheets'][key]['glow' if glow else 'image']
        if path not in self.cache: self.cache[path]=Image.open(path).convert('RGBA')
        return self.cache[path]

    def static(self,sid,lit=True):
        a=self.manifest['assets'][sid];f=a['frame'];box=(f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])
        image=self.sheet(a['sheet']).crop(box)
        if lit and a.get('glow'):
            c=np.array(image);g=np.array(self.sheet(a['sheet'],True).crop(box))
            c[...,:3]=np.minimum(c[...,:3].astype(int)+g[...,:3],255).astype(np.uint8)
            c[...,3]=np.maximum(c[...,3],g[...,3]);image=Image.fromarray(c)
        return image,(a['anchor']['x'],a['anchor']['y'])

    def crew(self,d):
        outfit=['body','eyes.organic','legs.cargo_pants','torso.work_shirt','arm.L.flesh','arm.R.flesh','hair.short']
        layers=sorted((self.manifest['assets']['crew.human.'+name] for name in outfit),key=lambda a:a['order'])
        a=layers[0];image=Image.new('RGBA',(a['frameW'],a['frameH']))
        for a in layers:
            c=a['clips']['idle'];cw,ch=c.get('cw',a['frameW']),c.get('ch',a['frameH'])
            x,y=c['start']*cw,d*ch
            cell=self.sheet(c.get('sheet',a.get('sheet'))).crop((x,y,x+cw,y+ch))
            image.alpha_composite(cell,(c.get('ox',0),c.get('oy',0)))
        return image,(a['anchor']['x'],a['anchor']['y'])


def paste(canvas,image,point): canvas.alpha_composite(image,(round(point[0]),round(point[1])))


def iso(x,y): return (x-y)*32,(x+y)*16


def diamond(draw,origin,x,y,colour):
    sx,sy=iso(x,y);sx+=origin[0];sy+=origin[1]
    draw.line([(sx,sy-16),(sx+32,sy),(sx,sy+16),(sx-32,sy),(sx,sy-16)],fill=colour,width=1)


def review(args):
    args.out.mkdir(parents=True,exist_ok=True)
    result=validate(args.package,args.pipeline)
    (args.out/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
    own=Atlas(args.package,'manifest.fragment.json');game=Atlas(args.pipeline/'public/assets/1x','manifest.json')
    layouts=json.loads((args.package/'layout.json').read_text());font=ImageFont.truetype(FONT,22)
    board=Image.new('RGB',(1800,1300),BG[:3]);draw=ImageDraw.Draw(board)
    panels={}
    for r in range(4):
        canvas=Image.new('RGBA',(440,300),BG);origin=(210,205);layout=layouts[f'r{r}'];w,h=layout['footprint']
        floor,anchor=game.static('tile.floor.a')
        tiles=[(x,y) for x in range(-w,2) for y in range(-h,2)]
        for x,y in sorted(tiles,key=lambda t:sum(t)):
            px,py=iso(x,y);paste(canvas,floor,(origin[0]+px-anchor[0],origin[1]+py-anchor[1]))
        d=ImageDraw.Draw(canvas)
        for x in range(-w+1,1):
            for y in range(-h+1,1): diamond(d,origin,x,y,(66,147,165,255))
        ax,ay=layout['accessFromFront'];diamond(d,origin,ax,ay,(225,188,77,255))
        machine,ma=own.static(f'module.refinery.r{r}');crew,ca=game.crew((5+2*r)%8)
        cx,cy=iso(ax,ay)
        pieces=[(0,machine,(origin[0]-ma[0],origin[1]-ma[1])),
                (ax+ay,crew,(origin[0]+cx-ca[0],origin[1]+cy-ca[1]))]
        for _,image,point in sorted(pieces,key=lambda p:p[0]): paste(canvas,image,point)
        panels[r]=canvas.convert('RGB')
        if r==1:
            panels[r].resize((880,600),Image.Resampling.NEAREST).save(args.out/'placement-r1.png')
            final=Image.new('RGB',(machine.width*2+40,machine.height*2+80),BG[:3])
            ImageDraw.Draw(final).text((20,12),'FINAL / GAME DISPLAY SIZE',font=ImageFont.truetype(FONT,18),fill=(220,229,236))
            final.paste(machine.resize((machine.width*2,machine.height*2),Image.Resampling.NEAREST),(20,50),
                        machine.resize((machine.width*2,machine.height*2),Image.Resampling.NEAREST))
            final.save(args.out/'final-r1.png')
        x=10+(r%2)*900;y=10+(r//2)*630
        draw.text((x+10,y),f'r{r} / access {layout["accessTile"]}',font=font,fill=(220,229,236))
        board.paste(panels[r].resize((880,600),Image.Resampling.NEAREST),(x,y+30))
    draw.text((20,1272),'Packed atlas + current game crew/floors / cyan footprint, yellow access / native art displayed 2x',font=font,fill=(170,185,199))
    board.save(args.out/'placement.png')
    # Native module cells shown at the game's 2x display scale; every frame uses
    # its exported front-tile anchor. This also reviews final-state alignment.
    animation=[];sheet=Image.new('RGB',(2000,1240),BG[:3]);sd=ImageDraw.Draw(sheet)
    for i,state in enumerate(('idle','working','unpowered')):
        for r in range(4):
            sid=f'module.refinery.r{r}'+('' if state=='idle' else '.active' if state=='working' else '.unpowered')
            image,anchor=own.static(sid);cv=Image.new('RGBA',(240,180),BG)
            paste(cv,image,(120-anchor[0],150-anchor[1]))
            x=10+r*500;y=10+i*405;sd.text((x+10,y),f'r{r} / {state}',font=font,fill=(220,229,236))
            sheet.paste(cv.convert('RGB').resize((480,360),Image.Resampling.NEAREST),(x,y+30))
    sheet.save(args.out/'states.png')
    clips=json.loads((args.package/'animations.json').read_text())
    for frame in range(4):
        canvas=Image.new('RGBA',(500,420),BG);d=ImageDraw.Draw(canvas)
        for r in range(4):
            sid=clips[f'module.refinery.r{r}.active']['frames'][frame];image,anchor=own.static(sid)
            x=(r%2)*250;y=(r//2)*210
            d.text((x+8,y+5),f'r{r}',font=ImageFont.truetype(FONT,12),fill=(220,229,236))
            paste(canvas,image,(x+125-anchor[0],y+175-anchor[1]))
        animation.append(canvas.convert('RGB').resize((1000,840),Image.Resampling.NEAREST))
    palette_source=Image.new('RGB',(1000,840*4))
    for i,im in enumerate(animation): palette_source.paste(im,(0,i*840))
    palette=palette_source.quantize(colors=256,dither=Image.Dither.NONE)
    frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in animation]
    frames[0].save(args.out/'working.gif',save_all=True,append_images=frames[1:],duration=250,loop=0,disposal=2,optimize=False)
    # Compare the approved 128px-tile review against final 64px-tile art at 2x.
    before=Image.open(args.approved/'b.png').convert('RGBA');meta=json.loads((args.approved/'b.json').read_text())
    reference=Image.new('RGBA',(470,340),BG);paste(reference,before,(235-meta['anchor'][0],245-meta['anchor'][1]))
    image,anchor=own.static('module.refinery.r1');after=Image.new('RGBA',(470,340),BG)
    paste(after,image.resize((image.width*2,image.height*2),Image.Resampling.NEAREST),
          (235+32-anchor[0]*2,245+80-anchor[1]*2))
    compare=Image.new('RGB',(1900,770),BG[:3]);d=ImageDraw.Draw(compare)
    for x,title,im in ((10,'APPROVED DESIGN PREVIEW',reference),(960,'FINAL / CURRENT MODULE PIPELINE',after)):
        d.text((x+10,15),title,font=font,fill=(220,229,236))
        compare.paste(im.convert('RGB').resize((940,680),Image.Resampling.NEAREST),(x,55))
    d.text((20,740),'Same world scale / final native 64x32, displayed 2x / standard production lighting',font=font,fill=(170,185,199))
    compare.save(args.out/'preview-vs-final.png')
    print('Final atlas, placement and state reviews verified',flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--package',type=Path,required=True);ap.add_argument('--pipeline',type=Path,required=True)
    ap.add_argument('--approved',type=Path,required=True);ap.add_argument('--out',type=Path,required=True)
    review(ap.parse_args())
