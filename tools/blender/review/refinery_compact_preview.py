"""Single-angle, four-sample mockup of the fresh 3x4 refinery concept."""
import argparse,json,math,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/blender'))


def render(out):
    from sprites import core,post
    from sprites.refinery_compact import CompactRefinery,PAINT,refinery_compact
    spec=out/'parameters.json'
    p=CompactRefinery(**json.loads(spec.read_text())) if spec.exists() else CompactRefinery()
    core.setup_scene();core._state['scene'].cycles.samples=4
    post._BASE_PAL.update(PAINT);post._STATES.clear();post.select(False)
    obs=refinery_compact(p)
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
    assert np.abs(q[:,0]).max()<=2 and np.abs(q[:,1]).max()<=1.5
    assert q[:,2].min()>=0 and q[:,2].max()<1.85
    xmin,xmax,ymin,ymax=core.extent_px(obs)
    w=2*(math.ceil(max(abs(xmin),abs(xmax)))+12)
    h=2*(math.ceil(max(abs(ymin),abs(ymax)))+12)
    rgb,a=core.render(w,h,'color')
    c,op=post.downsample(rgb,a>.5,core.SS,8,True);c,op=post.outline(c,op,True)
    assert not (op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
    x0,y0,x1,y1=post.crop_box(op)
    post.write_png(out/'refinery.png',post.to_rgba(c,op)[y0:y1,x0:x1])
    spec.write_text(json.dumps(p.spec(),indent=2)+'\n')
    meta={'footprint':[3,4],'bounds':[float(v) for v in np.ptp(q,axis=0)],
          'tile':[core.TILE_W,core.TILE_H],'camera':{'yaw':45,'elevation':30},
          'samples':4,'SS':core.SS,'anchor':[w//2+1-int(x0),h//2+1-int(y0)],
          'stage':'fresh-concept mockup; not finalized or integrated','paint':PAINT}
    (out/'review.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta),flush=True)


def compose(out):
    from PIL import Image,ImageDraw,ImageFont
    src=Image.open(out/'refinery.png').convert('RGBA')
    src.resize((src.width*3,src.height*3),Image.Resampling.NEAREST).save(out/'refinery-3x.png')
    bg=(22,30,40);board=Image.new('RGB',(src.width*3+48,src.height*3+100),bg)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21)
    draw=ImageDraw.Draw(board)
    draw.text((24,14),'REFINERY / FRESH 3 x 4 CONCEPT / 3x nearest-neighbour',font=font,fill=(220,230,238))
    zoom=src.resize((src.width*3,src.height*3),Image.Resampling.NEAREST)
    board.paste(zoom,(24,54),zoom)
    draw.text((24,src.height*3+68),'Loading hopper -> sealed processing chamber -> output drawer',font=font,fill=(170,190,205))
    board.save(out/'preview.png')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--compose',action='store_true')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    a.out.mkdir(parents=True,exist_ok=True);compose(a.out) if a.compose else render(a.out)
