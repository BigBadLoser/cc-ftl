"""Powered idle, four working poses and unpowered: low-sample art review only."""
import argparse,json,math,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'tools/blender'))
POSES=[('idle',0)]+[('working',i) for i in range(4)]+[('unpowered',0)]


def stem(state,frame): return f'{state}-{frame}' if state=='working' else state


def render(out,reference):
    from sprites import core,post
    from sprites.refinery_blockout import GREY
    from sprites.refinery_revision_b import CONTROL_GREYS,FINISH_PALETTE,VesselRefinery,refinery_revision_b
    from sprites.refinery_operating import operating_pose
    p=VesselRefinery(**json.loads((reference/'b.parameters.json').read_text()))
    (out/'parameters.json').write_text(json.dumps(p.spec(),indent=2)+'\n')
    for state,frame in POSES:
        pose=operating_pose(p,state,frame);name=stem(state,frame)
        core.setup_scene();core._state['scene'].cycles.samples=4;core._state['sun'].data.use_shadow=True
        for data in (GREY,CONTROL_GREYS,FINISH_PALETTE): post._BASE_PAL.update(data)
        post._STATES.clear();post.select(False)
        obs=refinery_revision_b(pose)
        q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
        assert np.abs(q[:,0]).max()<=2 and np.abs(q[:,1]).max()<=1.5
        assert q[:,2].min()>=0 and q[:,2].max()<1.85
        emission=np.array([c.color[:3] for ob in obs for c in ob.data.color_attributes['Glow'].data])
        if state=='unpowered': assert not emission.any()
        else: assert emission.max()>0
        x0,x1,y0,y1=core.extent_px(obs)
        w=2*(math.ceil(max(abs(x0),abs(x1)))+12);h=2*(math.ceil(max(abs(y0),abs(y1)))+12)
        rgb,alpha=core.render(w,h,'color');rgb,op=post.downsample(rgb,alpha>.5,core.SS,8,True)
        rgb,op=post.outline(rgb,op,True)
        assert not(op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
        gx,_=core.render(w,h,'glow');glow=np.pad(post.glow_down(gx,core.SS),((1,1),(1,1),(0,0)))
        x0,y0,x1,y1=post.crop_box(op);rgba=post.to_rgba(rgb,op)[y0:y1,x0:x1]
        post.write_png(out/f'{name}.png',rgba);post.write_png(out/f'{name}-glow.png',glow[y0:y1,x0:x1])
        lit=int((glow[...,3]>0).sum())
        if state=='unpowered': assert lit==0
        meta={'state':state,'frame':frame,'rotation':1,'footprint':[3,4],
              'bounds':[float(x) for x in np.ptp(q,axis=0)],'anchor':[w//2+1-int(x0),h//2+1-int(y0)],
              'tile':[core.TILE_W,core.TILE_H],'samples':4,'SS':core.SS,'glowPixels':lit,
              'gateClosed':pose.gate_closed,'gateTravel':pose.gate_travel,
              'billetU':pose.billet_u,'billetVisible':pose.show_billet}
        (out/f'{name}.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta),flush=True)


def compose(out,reference):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    bg=(27,34,43,255);panes={};font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    for state,frame in POSES:
        name=stem(state,frame);im=Image.open(out/f'{name}.png').convert('RGBA')
        meta=json.loads((out/f'{name}.json').read_text());canvas=np.full((300,380,4),bg,np.uint8)
        xy=np.array([190,205])-meta['anchor'];C.over(canvas,np.array(im),int(xy[0]),int(xy[1]))
        panes[name]=Image.fromarray(canvas).convert('RGB')
        im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(out/f'{name}-3x.png')
    same=np.array_equal(np.array(Image.open(out/'idle.png')),np.array(Image.open(reference/'b.png')))
    assert same,'Powered idle changed from approved art'
    board=Image.new('RGB',(1560,690),bg[:3]);draw=ImageDraw.Draw(board)
    for i,(key,title) in enumerate((('idle','POWERED IDLE'),('unpowered','UNPOWERED / FEED ISOLATED'))):
        draw.text((20+i*780,15),title,font=font,fill=(220,229,236))
        board.paste(panes[key].resize((760,600),Image.Resampling.NEAREST),(10+i*780,50))
    draw.text((20,660),'Same light, camera and scale / unpowered display has no emission',font=font,fill=(170,185,199))
    board.save(out/'power-comparison.png')
    sheet=Image.new('RGB',(1560,1330),bg[:3]);draw=ImageDraw.Draw(sheet)
    animation=[]
    for i in range(4):
        pane=panes[f'working-{i}'];x=10+(i%2)*780;y=10+(i//2)*650
        draw.text((x+10,y),f'WORKING / FRAME {i+1}',font=font,fill=(220,229,236))
        sheet.paste(pane.resize((760,600),Image.Resampling.NEAREST),(x,y+35))
        animated=pane.resize((1140,900),Image.Resampling.NEAREST)
        labelled=Image.new('RGB',(1140,945),bg[:3]);labelled.paste(animated,(0,45))
        ImageDraw.Draw(labelled).text((20,12),'REFINERY / WORKING LOOP / PREVIEW',font=font,fill=(220,229,236))
        animation.append(labelled)
    sheet.save(out/'working-frames.png')
    palette_source=Image.new('RGB',(1140,945*4))
    for i,im in enumerate(animation): palette_source.paste(im,(0,i*945))
    palette=palette_source.quantize(colors=256,dither=Image.Dither.NONE)
    frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in animation]
    frames[0].save(out/'working.gif',save_all=True,append_images=frames[1:],duration=250,loop=0,disposal=2,optimize=False)
    (out/'review.json').write_text(json.dumps({'approvedIdlePixelIdentical':same,'workingFrames':4,
        'previewFps':4,'unpoweredGlowPixels':0,'scope':'r1 state review only; no runtime wiring'},indent=2)+'\n')


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--reference',type=Path,default=ROOT/'artifacts/refinery-ab');ap.add_argument('--compose',action='store_true')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]);args.out.mkdir(parents=True,exist_ok=True)
    compose(args.out,args.reference) if args.compose else render(args.out,args.reference)
