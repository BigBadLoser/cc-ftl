"""Audit the exported refinery's actual atlas pixels, dimensions and handoff data."""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image


def load(path): return json.loads(path.read_text())


def validate(package,pipeline):
    m=load(package/'manifest.fragment.json');settings=load(package/'settings.json')
    integration=load(package/'integration.json');build=load(package/'build.json')
    assert build['complete'] and build['uniqueFrames']==24 and build['manifestEntries']==31
    game=load(pipeline/'public/assets/1x/manifest.json')
    assert m['tile']==game['tile']=={'w':64,'h':32}
    assert all(m[key]==game[key] for key in ('version','heights','keyColors'))
    assert settings['blenderVersion'].startswith(settings['pinnedBlender']) and settings['pinnedBlender']=='4.2.9'
    assert settings['supersample']==4 and settings['cyclesSamples']==4 and not settings['preview']
    assert settings['sunShadows'] is False and settings['cameraYaw']==45 and settings['cameraElevation']==30
    assert settings['threadsFlag']=='2' and settings['displayScale']==2
    for path,digest in settings['pipeline']['pipelineFiles'].items():
        assert hashlib.sha256((pipeline/path).read_bytes()).hexdigest()==digest,path
    model_root=Path(__file__).resolve().parents[2]
    for path,digest in settings['pipeline']['modelFiles'].items():
        assert hashlib.sha256((model_root/'tools/blender/sprites'/path).read_bytes()).hexdigest()==digest,path
    assert hashlib.sha256((model_root/'tools/blender/export_refinery.py').read_bytes()).hexdigest()==settings['pipeline']['exporter']
    sheets={};report={'nativeTile':[64,32],'displayGrid':[128,64],'blender':settings['blenderVersion'],
       'supersample':4,'cyclesSamples':4,'sheetSizes':{},'frameSets':build['frameSets'],
       'uniqueFrames':24,'manifestEntries':31,'access':integration['requiredAccess'],'rotations':{}}
    for sid,sd in m['sheets'].items():
        col=Image.open(package/sd['image']);g=Image.open(package/sd['glow'])
        assert col.mode==g.mode=='RGBA' and col.size==g.size
        w,h=col.size;assert w<=4096 and h<=4096 and w&(w-1)==0
        sheets[sid]=(np.array(col),np.array(g));report['sheetSizes'][sid]=[w,h]
    layouts=load(package/'layout.json');params=load(package/'parameters.json');regions={};canonical=0
    for sid,a in m['assets'].items():
        assert a['kind']=='static' and all(isinstance(a['anchor'][k],int) for k in ('x','y'))
        if sid in integration['aliases']:
            assert a==m['assets'][integration['aliases'][sid]]
            continue
        f=a['frame'];x,y,w,h=(f[k] for k in ('x','y','w','h'))
        col,g=sheets[a['sheet']];assert x>=1 and y>=1 and x+w<col.shape[1] and y+h<col.shape[0]
        key=(a['sheet'],x,y,w,h)
        assert key not in regions
        regions[key]=sid;canonical+=1
        raw=np.array(Image.open(package/'frames'/f'{sid}.png'));raw_g=np.array(Image.open(package/'frames'/f'{sid}.glow.png'))
        assert np.array_equal(col[y:y+h,x:x+w],raw),sid
        assert np.array_equal(g[y:y+h,x:x+w],raw_g),sid
        assert bool(a.get('glow'))==bool(raw_g[...,3].any())
        for atlas in (col,g):
            assert not (atlas[y-1,x-1:x+w+1,3].any() or atlas[y+h,x-1:x+w+1,3].any() or
                        atlas[y:y+h,x-1,3].any() or atlas[y:y+h,x+w,3].any()),sid
        meta=load(package/'frames'/f'{sid}.json');r=meta['rotation'];layout=layouts[f'r{r}']
        assert a['footprint']==layout['footprint'] and a['anchor']==meta['anchor']
        size=build['frameSets'][f'r{r}'];assert [w,h]==[size['w'],size['h']] and a['anchor']==size['anchor']
        low,high=meta['gridBounds'];fw,fh=a['footprint']
        assert low[0]>=-fw+.5 and high[0]<=.5 and low[1]>=-fh+.5 and high[1]<=.5
        assert low[2]>=0 and high[2]<1.85
        if meta['state']=='unpowered': assert not raw_g[...,3].any() and not a.get('glow')
        if raw_g[...,3].any():
            points=[];u,v=params['terminal_u'],params['terminal_v']
            cx,cy=layout['centreFromFront']
            for du in (-.265,.265):
                for dv in (-.18,.11):
                    xx,yy=u+du,v+dv
                    gx,gy=((yy,-xx),(xx,yy),(-yy,xx),(-xx,-yy))[r]
                    gx+=cx;gy+=cy;z=1.15-params['terminal_drop']-.90*dv-.045
                    points.append(((gx-gy)*32,(gx+gy)*16-z*64/math.sqrt(2)*math.cos(math.pi/6)))
            points=np.array(points);ys,xs=np.where(raw_g[...,3]>0)
            lit=np.column_stack((xs-a['anchor']['x'],ys-a['anchor']['y']))
            assert (lit.min(axis=0)>=points.min(axis=0)-2).all() and (lit.max(axis=0)<=points.max(axis=0)+2).all(),sid
    assert canonical==24 and len(regions)==24
    rects=list(regions)
    for i,(sheet,x,y,w,h) in enumerate(rects):
        for other,xx,yy,ww,hh in rects[i+1:]:
            assert sheet!=other or x+w<=xx or xx+ww<=x or y+h<=yy or yy+hh<=y
    animations=load(package/'animations.json');assert len(animations)==4
    for r in range(4):
        layout=layouts[f'r{r}'];a=layout['accessTile'];w,h=layout['footprint']
        assert not(0<=a[0]<w and 0<=a[1]<h) and layout['nearestControlDistance']<.70
        assert layout['terminalEdgeClearance']>=.0199
        clip=animations[f'module.refinery.r{r}.active'];assert clip['fps']==4 and clip['loop'] and len(clip['frames'])==4
        assert all(sid in m['assets'] for sid in clip['frames'])
        report['rotations'][f'r{r}']={'accessTile':a,'nearestControlDistance':layout['nearestControlDistance'],
                                    'controlHeight':layout['controlHeight'],'framesAligned':True}
    report.update(atlasRoundTripExact=True,glowAlignedAndDisplayOnly=True,unpoweredEmissionZero=True,
                  atlasGuttersClear=True,footprintsAndAnchorsVerified=True)
    return report


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--package',type=Path,required=True);ap.add_argument('--pipeline',type=Path,required=True)
    ap.add_argument('--report',type=Path,required=True);args=ap.parse_args()
    result=validate(args.package,args.pipeline);args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
