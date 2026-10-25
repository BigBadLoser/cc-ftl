"""Preserve cradle A exactly; render new upright B at the same game-camera scale."""
import argparse,hashlib,json,math,shutil,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'tools/blender'))


def preserve_a(out):
    original=ROOT/'artifacts/refinery-compact-v2'
    for name,target in (('blockout.png','a.png'),('blockout.json','a.json'),
                        ('blockout.blend','a.blend'),('parameters.json','a.parameters.json')):
        shutil.copyfile(original/name,out/target)
    return hashlib.sha256((out/'a.png').read_bytes()).hexdigest()


def render(out):
    import bpy
    from sprites import core,post
    from sprites.refinery_blockout import GREY
    from sprites.refinery_revision_b import VesselRefinery,refinery_revision_b
    digest=preserve_a(out)
    path=out/'b.parameters.json';p=VesselRefinery(**json.loads(path.read_text())) if path.exists() else VesselRefinery()
    core.setup_scene();core._state['scene'].cycles.samples=4;core._state['sun'].data.use_shadow=True
    core.palette._data.update(GREY);post._BASE_PAL.update(GREY);post._STATES.clear();post.select(False)
    obs=refinery_revision_b(p)
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
    assert np.abs(q[:,0]).max()<=2 and np.abs(q[:,1]).max()<=1.5
    assert q[:,2].min()>=0 and q[:,2].max()<1.85
    x0,x1,y0,y1=core.extent_px(obs)
    w=2*(math.ceil(max(abs(x0),abs(x1)))+12);h=2*(math.ceil(max(abs(y0),abs(y1)))+12)
    rgb,a=core.render(w,h,'color');c,op=post.downsample(rgb,a>.5,core.SS,8,True);c,op=post.outline(c,op,True)
    assert not (op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
    x0,y0,x1,y1=post.crop_box(op);post.write_png(out/'b.png',post.to_rgba(c,op)[y0:y1,x0:x1])
    meta={'revision':'B / upright pressure vessel','footprint':[3,4],
          'bounds':[float(x) for x in np.ptp(q,axis=0)],'anchor':[w//2+1-int(x0),h//2+1-int(y0)],
          'tile':[core.TILE_W,core.TILE_H],'camera':{'yaw':45,'elevation':30},'samples':4,'SS':core.SS,
          'material':'one neutral grey, no emission','preservedAImageSha256':digest}
    (out/'b.json').write_text(json.dumps(meta,indent=2)+'\n');path.write_text(json.dumps(p.spec(),indent=2)+'\n')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str((out/'b.blend').resolve()),compress=True)
    print(json.dumps(meta),flush=True)


def compose(out):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    bg=(27,34,43,255);panes=[]
    for name in ('a','b'):
        src=Image.open(out/f'{name}.png').convert('RGBA');meta=json.loads((out/f'{name}.json').read_text())
        canvas=np.full((340,470,4),bg,np.uint8);xy=np.array([235,245])-meta['anchor']
        C.over(canvas,np.array(src),round(xy[0]),round(xy[1]));panes.append(Image.fromarray(canvas))
        src.resize((src.width*3,src.height*3),Image.Resampling.NEAREST).save(out/f'{name}-3x.png')
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    board=Image.new('RGB',(1900,770),bg[:3]);d=ImageDraw.Draw(board)
    for x,title,im in ((10,'A / OPEN CRADLE',panes[0]),(960,'B / UPRIGHT REFINING VESSEL',panes[1])):
        d.text((x+10,15),title,font=font,fill=(220,229,236))
        board.paste(im.convert('RGB').resize((940,680),Image.Resampling.NEAREST),(x,55))
    d.text((20,740),'3 x 4 / same camera, grey material and world scale / geometry concepts',font=font,fill=(170,185,199))
    board.save(out/'comparison.png')
    im=Image.open(out/'b-3x.png').convert('RGBA')
    single=Image.new('RGB',(im.width+40,im.height+90),bg[:3]);d=ImageDraw.Draw(single)
    d.text((20,12),'REFINERY / REVISION B / GREY GEOMETRY',font=font,fill=(220,229,236))
    single.paste(im,(20,55),im);single.save(out/'b-preview.png')
    # The chosen B blockout is the geometric reference for mechanical refinement.
    # Align both sprites by their stored deck anchors, without resizing either.
    comparisons=(('b-blockout','APPROVED B / GREY BLOCKOUT','B / MECHANICAL REFINEMENT','b-refinement-comparison'),
                 ('b-pipes-before','BEFORE / PIPE CONNECTIONS','AFTER / SEATED CONNECTIONS','b-pipes-comparison'))
    for source,before_label,after_label,target in comparisons:
        if not (out/f'{source}.png').exists(): continue
        before=Image.open(out/f'{source}.png').convert('RGBA')
        meta=json.loads((out/f'{source}.json').read_text())
        canvas=np.full((340,470,4),bg,np.uint8);xy=np.array([235,245])-meta['anchor']
        C.over(canvas,np.array(before),round(xy[0]),round(xy[1]))
        board=Image.new('RGB',(1900,770),bg[:3]);d=ImageDraw.Draw(board)
        pairs=((10,before_label,Image.fromarray(canvas)),(960,after_label,panes[1]))
        for x,title,pane in pairs:
            d.text((x+10,15),title,font=font,fill=(220,229,236))
            board.paste(pane.convert('RGB').resize((940,680),Image.Resampling.NEAREST),(x,55))
        d.text((20,740),'Same camera, grey material and world scale / 3 x 4 footprint',font=font,fill=(170,185,199))
        board.save(out/f'{target}.png')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--compose',action='store_true')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]);a.out.mkdir(parents=True,exist_ok=True)
    compose(a.out) if a.compose else render(a.out)
