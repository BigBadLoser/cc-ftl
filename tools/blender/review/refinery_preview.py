"""Quick single-angle reference study. Run in Blender, then --compare in Python."""
import argparse
import json
import math
import sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/blender'))
# Manual centre estimates in the supplied 300x167 image; uncertainty ~3 px.
REFERENCE={'rear_1':[119,12],'rear_2':[157,33],'rear_3':[194,55],
           'front_1':[114,59],'front_2':[151,80],'front_3':[187,101],
           'drum_1':[76,88],'drum_2':[114,108],'drum_3':[151,129]}


def render(out,name):
    from sprites import core,post
    from sprites.refinery import RefineryShape,refinery,landmarks,LOCAL_COLOURS
    p=RefineryShape(**json.loads((out/f'{name}.parameters.json').read_text()))
    core.setup_scene();core._state['scene'].cycles.samples=4
    if p.coloured:
        # Local study paint, no edits to the production palettes or shared pipeline.
        post._BASE_PAL.update(LOCAL_COLOURS);post._STATES.clear();post.select(False)
    obs=refinery(p)
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
    # Local long axis x=5; short axis y=3. Integration rotation comes later.
    assert np.abs(q[:,0]).max()<=p.footprint[1]/2 and np.abs(q[:,1]).max()<=p.footprint[0]/2
    assert q[:,2].min()>=0 and q[:,2].max()<1.85
    xmin,xmax,ymin,ymax=core.extent_px(obs)
    w=2*(math.ceil(max(abs(xmin),abs(xmax)))+12)
    h=2*(math.ceil(max(abs(ymin),abs(ymax)))+12)
    rgb,a=core.render(w,h,'color')
    c,op=post.downsample(rgb,a>.5,core.SS,8,True);c,op=post.outline(c,op,True)
    assert not (op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any()),'Render clipped'
    x0,y0,x1,y1=post.crop_box(op)
    post.write_png(out/f'{name}.png',post.to_rgba(c,op)[y0:y1,x0:x1])
    meta={'parameters':p.spec(),'footprint':p.footprint,'tile':[core.TILE_W,core.TILE_H],'samples':4,'SS':core.SS,
          'camera':{'yaw':45,'elevation':30},'landmarks':landmarks(p),
          'anchor':[w//2+1-int(x0),h//2+1-int(y0)],'bounds':[float(x) for x in np.ptp(q,axis=0)]}
    if p.coloured:
        meta['previewPaint']=LOCAL_COLOURS
    (out/f'{name}.json').write_text(json.dumps(meta,indent=2)+'\n')
    print('PREVIEW COMPLETE',name,flush=True)


def compare(out,name):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    meta=json.loads((out/f'{name}.json').read_text());points=meta['landmarks']
    # Fixed uniform normalization from the two outer rear-mouth centres.
    a=np.array(points['rear_3'])-points['rear_1'];b=np.array(REFERENCE['rear_3'])-REFERENCE['rear_1']
    scale=float(np.dot(a,b)/np.dot(a,a))
    offset=(np.array(REFERENCE['rear_1'])+REFERENCE['rear_3']-scale*(np.array(points['rear_1'])+points['rear_3']))/2
    aligned={k:scale*np.array(v)+offset for k,v in points.items()}
    errors={k:float(np.linalg.norm(aligned[k]-REFERENCE[k])) for k in REFERENCE}
    report={'alignment':'uniform scale and translation only, fitted to rear mouth 1 and 3',
            'uniformScale':scale,'offset':offset.tolist(),'manualUncertaintyPixels':3,
            'referenceLandmarks':REFERENCE,'alignedLandmarks':{k:v.tolist() for k,v in aligned.items()},
            'errorsInReferencePixels':errors,'caveat':'Sparse picks do not validate topology; fitted points are not independent checks.'}
    (out/f'{name}.comparison.json').write_text(json.dumps(report,indent=2)+'\n')
    ref=Image.open(ROOT/'artifacts/refinery-reference/main.jpg').convert('RGBA')
    src=Image.open(out/f'{name}.png').convert('RGBA')
    # Compose directly at display size to avoid discarding native pixels before zooming.
    zoom=3
    src=src.resize((round(src.width*scale*zoom),round(src.height*scale*zoom)),Image.Resampling.NEAREST)
    bg=(224,226,226,255);canvas=np.full((185*zoom,320*zoom,4),bg,np.uint8)
    xy=offset-scale*np.array(meta['anchor'])+np.array([10,8])
    C.over(canvas,np.array(src),round(xy[0]*zoom),round(xy[1]*zoom))
    left=Image.new('RGBA',(320*zoom,185*zoom),bg)
    left.alpha_composite(ref.resize((ref.width*zoom,ref.height*zoom),Image.Resampling.NEAREST),(10*zoom,8*zoom))
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
    for marked in (False,True):
        l=left.copy();r=Image.fromarray(canvas)
        if marked:
            for i,k in enumerate(REFERENCE):
                for im,pt in ((l,np.array(REFERENCE[k])),(r,aligned[k])):
                    d=ImageDraw.Draw(im);x,y=(pt+[10,8])*zoom
                    d.ellipse((x-6,y-6,x+6,y+6),outline=(255,40,70),width=2)
        board=Image.new('RGB',(1950,650),bg[:3]);d=ImageDraw.Draw(board)
        d.text((15,12),f'REFERENCE / main geometry',font=font,fill=(35,43,52))
        d.text((990,12),f'{name.upper()} / project camera / uniform scale',font=font,fill=(35,43,52))
        board.paste(l.convert('RGB'),(10,50));board.paste(r.convert('RGB'),(980,50))
        footprint=meta.get('footprint',[3,4])
        d.text((15,620),f'{footprint[0]} x {footprint[1]} tiles / one angle / low-sample preview / not final art',font=font,fill=(55,65,75))
        board.save(out/f'{name}.{"landmarks" if marked else "comparison"}.png')
    sprite=Image.open(out/f'{name}.png').convert('RGBA')
    sprite.resize((sprite.width*3,sprite.height*3),Image.Resampling.NEAREST).save(out/f'{name}.3x.png')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--pass-name',required=True);parser.add_argument('--compare',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    args.out.mkdir(parents=True,exist_ok=True)
    compare(args.out,args.pass_name) if args.compare else render(args.out,args.pass_name)
