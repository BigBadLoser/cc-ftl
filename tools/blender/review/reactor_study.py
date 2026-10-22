"""One quick geometry pass and reference comparison. Never writes game art.

SPRITE_PREVIEW=1 SPRITE_SAMPLES=4 blender -b -t 2 --factory-startup --python-exit-code 1 \
 --python tools/blender/review/reactor_study.py -- --pass-name blockout-a --out artifacts/reactor-study
python3 tools/blender/review/reactor_study.py --pass-name blockout-a --out artifacts/reactor-study --compare
"""
import argparse
import json
import math
import sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/blender'))
BG=(13,19,28,255)
# Approximate manual picks in the unmodified 800x450 reference, not exact calibration.
REFERENCE={"rear_peak":[301,78],"front_peak":[574,205],"port_center":[545,269],
           "cabinet_1":[311,209],"cabinet_2":[373,243],"cabinet_3":[435,277],"controller":[224,221]}
CROP=(140,40,660,420)


def params(name,out):
    from sprites.reactor_blockout import ReactorShape
    path=out/f'{name}.parameters.json'
    return ReactorShape(**json.loads(path.read_text())) if path.exists() else ReactorShape()


def render(out,name):
    from sprites import core,post
    from sprites.reactor_blockout import build_blockout,landmarks
    p=params(name,out)
    core.setup_scene();core._state['scene'].cycles.samples=4
    obs=build_blockout(p)
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
    assert np.abs(q[:,0]).max()<=2 and np.abs(q[:,1]).max()<=1.5
    assert q[:,2].min()>=0 and q[:,2].max()<1.85
    xmin,xmax,ymin,ymax=core.extent_px(obs)
    w=2*(math.ceil(max(abs(xmin),abs(xmax)))+8)
    h=2*(math.ceil(max(abs(ymin),abs(ymax)))+8)
    rgb,a=core.render(w,h,'color')
    c,op=post.downsample(rgb,a>.5,core.SS,8,True);c,op=post.outline(c,op,True)
    x0,y0,x1,y1=post.crop_box(op)
    rgba=post.to_rgba(c,op)[y0:y1,x0:x1]
    post.write_png(out/f'{name}.png',rgba)
    info={'parameters':p.spec(),'tile':[core.TILE_W,core.TILE_H],'samples':4,'SS':core.SS,
          'anchor':[w//2+1-int(x0),h//2+1-int(y0)],'landmarks':landmarks(p),
          'size':[float(v) for v in np.ptp(q,axis=0)],'stage':'primary geometry / neutral materials'}
    if p.connected_service_pipes:
        from sprites.reactor_blockout import service_connections
        connections=[]
        for u in p.cabinet_u:
            pipe_u,flange_v,flange_top,path=service_connections(p,u)
            connections.append({'pipeStart':[pipe_u,*path[0]],'pipeEnd':[pipe_u,*path[-1]],
                                'flangeTopCenter':[pipe_u,flange_v,flange_top],
                                'cabinetFaceV':p.cabinet_v+p.cabinet_depth/2+p.cabinet_outreach})
        info['pipeConnections']=connections
    (out/f'{name}.json').write_text(json.dumps(info,indent=2)+'\n')
    print('BLOCKOUT RENDERED',name,flush=True)


def compare(out,name):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    info=json.loads((out/f'{name}.json').read_text())
    points={k:np.array(v) for k,v in info['landmarks'].items()}
    target={k:np.array(v) for k,v in REFERENCE.items()}
    a=points['front_peak']-points['rear_peak'];b=target['front_peak']-target['rear_peak']
    scale=float(np.dot(a,b)/np.dot(a,a))
    offset=(target['rear_peak']+target['front_peak']-scale*(points['rear_peak']+points['front_peak']))/2
    rendered={k:scale*v+offset for k,v in points.items()}
    errors={k:float(np.linalg.norm(rendered[k]-target[k])) for k in target}
    report={'alignment':'one uniform scale + translation fitted to two barrel-end silhouette peaks',
            'uniformScale':scale,'referencePixelUncertainty':4,'errorsInReferencePixels':errors,
            'referenceLandmarks':REFERENCE,'alignedRenderLandmarks':{k:v.tolist() for k,v in rendered.items()},
            'referenceCameraCaveat':'Project camera stays fixed. Residuals can reflect geometry, landmark uncertainty or reference projection; the comparison does not distinguish these.',
            'stage':'blockout, not a finished or claimed matching asset'}
    (out/f'{name}.comparison.json').write_text(json.dumps(report,indent=2)+'\n')
    ref=Image.open(ROOT/'artifacts/reactor-reference/reference.jpg').convert('RGBA').crop(CROP)
    source=Image.open(out/f'{name}.png').convert('RGBA')
    source=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.NEAREST)
    canvas=np.full((380,520,4),BG,np.uint8)
    xy=offset-scale*np.array(info['anchor'])-np.array(CROP[:2])
    C.over(canvas,np.array(source),round(xy[0]),round(xy[1]))
    font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
    for annotated in (False,True):
        left=ref.copy();right=Image.fromarray(canvas)
        if annotated:
            for i,k in enumerate(target):
                for image,point in ((left,target[k]),(right,rendered[k])):
                    d=ImageDraw.Draw(image);x,y=point-np.array(CROP[:2])
                    d.ellipse((x-3,y-3,x+3,y+3),outline=(255,158,70),width=1)
                    d.text((x+4,y-10),str(i+1),font=font(10),fill=(255,210,150))
        board=Image.new('RGB',(2140,930),BG[:3]);d=ImageDraw.Draw(board)
        d.text((20,12),f'REACTOR / {name.upper()} / PRIMARY GEOMETRY',font=font(22),fill=(213,224,233))
        d.text((20,50),'REFERENCE / crop from supplied image',font=font(16),fill=(160,180,195))
        d.text((1080,50),'RENDER / project camera / uniform scale only',font=font(16),fill=(160,180,195))
        board.paste(left.convert('RGB').resize((1040,760),Image.Resampling.NEAREST),(20,85))
        board.paste(right.convert('RGB').resize((1040,760),Image.Resampling.NEAREST),(1080,85))
        d.text((20,870),'Neutral blockout: compare structure before mechanical details and materials.',font=font(16),fill=(197,176,123))
        board.save(out/f'{name}.{"landmarks" if annotated else "comparison"}.png')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True)
    p.add_argument('--pass-name',required=True);p.add_argument('--compare',action='store_true')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    a.out.mkdir(parents=True,exist_ok=True)
    compare(a.out,a.pass_name) if a.compare else render(a.out,a.pass_name)
