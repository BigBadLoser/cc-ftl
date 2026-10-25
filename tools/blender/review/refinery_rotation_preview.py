"""Four low-sample orientations of the approved refinery; no production build.

All views must be rigid rotations of the approved geometry and material data.
The approved r1 camera view is also compared pixel-for-pixel when composing.
"""
import argparse,json,math,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'tools/blender'))


def colours(mesh):
    return {name:np.array([c.color[:] for c in mesh.color_attributes[name].data])
            for name in ('Col','Self','Glow')}


def render(out,reference):
    import bpy
    from sprites import core,post
    from sprites.refinery_blockout import GREY
    from sprites.refinery_revision_b import CONTROL_GREYS,FINISH_PALETTE,VesselRefinery,refinery_revision_b
    p=VesselRefinery(**json.loads((reference/'b.parameters.json').read_text()))
    (out/'parameters.json').write_text(json.dumps(p.spec(),indent=2)+'\n')
    with bpy.data.libraries.load(str((reference/'b.blend').resolve()),link=False) as (source,target):
        target.objects=[n for n in source.objects if n=='refinery_b_vertical_vessel']
    assert len(target.objects)==1
    mesh=target.objects[0].data;base=np.array([v.co[:] for v in mesh.vertices])
    topology=[tuple(f.vertices) for f in mesh.polygons];palette=colours(mesh)
    for rotation in range(4):
        core.setup_scene();core._state['scene'].cycles.samples=4;core._state['sun'].data.use_shadow=True
        for data in (GREY,CONTROL_GREYS,FINISH_PALETTE): post._BASE_PAL.update(data)
        post._STATES.clear();post.select(False)
        obs=refinery_revision_b(p,rotation=rotation);mesh=obs[0].data
        q=np.array([v.co[:] for v in mesh.vertices])
        angle=(1-rotation)*math.pi/2;c,s=math.cos(angle),math.sin(angle)
        expected=base.copy();expected[:,0]=c*base[:,0]-s*base[:,1];expected[:,1]=s*base[:,0]+c*base[:,1]
        assert np.allclose(q,expected,rtol=0,atol=1e-6),'Parts changed position within the rotated assembly'
        assert [tuple(f.vertices) for f in mesh.polygons]==topology
        current_colours=colours(mesh)
        assert all(np.array_equal(current_colours[key],value) for key,value in palette.items())
        limits=(1.5,2) if rotation%2==0 else (2,1.5)
        assert np.abs(q[:,0]).max()<=limits[0] and np.abs(q[:,1]).max()<=limits[1]
        assert q[:,2].min()>=0 and q[:,2].max()<1.85
        x0,x1,y0,y1=core.extent_px(obs)
        w=2*(math.ceil(max(abs(x0),abs(x1)))+12);h=2*(math.ceil(max(abs(y0),abs(y1)))+12)
        rgb,a=core.render(w,h,'color');rgb,op=post.downsample(rgb,a>.5,core.SS,8,True)
        rgb,op=post.outline(rgb,op,True)
        assert not(op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
        x0,y0,x1,y1=post.crop_box(op);post.write_png(out/f'r{rotation}.png',post.to_rgba(rgb,op)[y0:y1,x0:x1])
        meta={'rotation':rotation,'localFootprint':[3,4],'gridFootprint':[3,4] if rotation%2==0 else [4,3],
              'bounds':[float(x) for x in np.ptp(q,axis=0)],'anchor':[w//2+1-int(x0),h//2+1-int(y0)],
              'tile':[core.TILE_W,core.TILE_H],'camera':{'yaw':45,'elevation':30},'samples':4,'SS':core.SS,
              'approvedGeometryTopologyAndMaterialsMatch':True,'maximumVertexError':float(np.abs(q-expected).max())}
        (out/f'r{rotation}.json').write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps(meta),flush=True)


def compose(out,reference):
    from PIL import Image,ImageDraw,ImageFont
    from sprites import compose as C
    bg=(27,34,43,255);board=Image.new('RGB',(1560,1340),bg[:3]);draw=ImageDraw.Draw(board)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    for rotation in range(4):
        im=Image.open(out/f'r{rotation}.png').convert('RGBA');meta=json.loads((out/f'r{rotation}.json').read_text())
        canvas=np.full((300,380,4),bg,np.uint8);xy=np.array([190,205])-meta['anchor']
        assert xy.min()>=0 and xy[0]+im.width<=380 and xy[1]+im.height<=300
        C.over(canvas,np.array(im),int(xy[0]),int(xy[1]))
        x=10+(rotation%2)*780;y=10+(rotation//2)*650
        label=f'r{rotation}' + (' / APPROVED ANGLE' if rotation==1 else '')
        draw.text((x+10,y),label,font=font,fill=(220,229,236))
        board.paste(Image.fromarray(canvas).convert('RGB').resize((760,600),Image.Resampling.NEAREST),(x,y+35))
        im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(out/f'r{rotation}-3x.png')
    identical=np.array_equal(np.array(Image.open(reference/'b.png')),np.array(Image.open(out/'r1.png')))
    assert identical,'Approved view changed; inspect before handing off'
    (out/'review.json').write_text(json.dumps({'approvedR1PixelIdentical':identical,'samples':4,'scale':[128,64],
      'notes':'Physical orientations; terminal visibility depends on occlusion. No per-view repositioning.'},indent=2)+'\n')
    draw.text((20,1307),'3 x 4 / same camera and world scale / four samples / preview only',font=font,fill=(170,185,199))
    board.save(out/'rotations.png')


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--reference',type=Path,default=ROOT/'artifacts/refinery-ab');ap.add_argument('--compose',action='store_true')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]);args.out.mkdir(parents=True,exist_ok=True)
    compose(args.out,args.reference) if args.compose else render(args.out,args.reference)
