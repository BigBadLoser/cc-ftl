"""One cheap game-camera render of the refinery and the existing idle crew.

Plain source outfit, no recolouring or crew finishing. Run after the refinery's
standalone preview, one Blender process at a time.
"""
import argparse,json,math,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'tools/blender'))


def render(out):
    import bpy
    from sprites import core,post,human_items,human_render,crew_clips
    from sprites.refinery_blockout import GREY
    from sprites.refinery_revision_b import CONTROL_GREYS,VesselRefinery,refinery_revision_b
    arm,items=human_items.build_items()
    outfit={'body','eyes.organic','legs.cargo_pants','torso.work_shirt',
            'arm.L.flesh','arm.R.flesh','hair.short'}
    selected=[it for it in items if it.id.removeprefix('crew.human.') in outfit]
    assert len(selected)==len(outfit),[it.id for it in selected]
    human_render.set_state(items,selected,[])
    name,frame=next((name,f) for clip,i,name,f in crew_clips.clip_frames() if clip=='idle' and i==0)
    human_render.pose_frame(arm,'idle',0,name,frame)
    arm.rotation_euler=(0,0,math.radians(180))
    p=VesselRefinery(**json.loads((out/'b.parameters.json').read_text()))
    arm.location=core.G(p.terminal_u,1.90,0)
    bpy.context.view_layer.update()
    crew=[ob for it in selected for ob in it.objs]
    def vertices():
        graph=bpy.context.evaluated_depsgraph_get();points=[]
        for ob in crew:
            evaluated=ob.evaluated_get(graph);mesh=evaluated.to_mesh()
            points.extend(tuple(evaluated.matrix_world@v.co) for v in mesh.vertices)
            evaluated.to_mesh_clear()
        return np.array(points)
    q=vertices();arm.location.z-=float(q[:,2].min());bpy.context.view_layer.update()
    q=vertices();height=float(np.ptp(q[:,2]));assert 1.4<height<1.65,height
    core._state['scene'].cycles.samples=4;core._state['sun'].data.use_shadow=True
    core.palette._data.update(GREY);post._BASE_PAL.update(GREY);post._BASE_PAL.update(CONTROL_GREYS)
    post._STATES.clear();post.select(False)
    machine=refinery_revision_b(p)
    x0,x1,y0,y1=core.extent_px(machine+crew)
    # Crew are skinned, so also include their evaluated geometry in the canvas.
    projected=np.array([core.screen_xy(point) for point in q])
    x0=min(x0,projected[:,0].min());x1=max(x1,projected[:,0].max())
    y0=min(y0,projected[:,1].min());y1=max(y1,projected[:,1].max())
    w=2*(math.ceil(max(abs(x0),abs(x1)))+16);h=2*(math.ceil(max(abs(y0),abs(y1)))+16)
    rgb,a=core.render(w,h,'color');c,op=post.downsample(rgb,a>.5,core.SS,8,True)
    c,op=post.outline(c,op,True)
    assert not(op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
    x0,y0,x1,y1=post.crop_box(op);post.write_png(out/'crew-scale.png',post.to_rgba(c,op)[y0:y1,x0:x1])
    meta={'crewNominalHeight':1.5,'crewMeasuredHeight':height,'crewGridPosition':[p.terminal_u,1.90],
          'crewFeetZ':float(q[:,2].min()),'consoleDrop':p.terminal_drop,
          'controlTop':1.15-p.terminal_drop-.90*.17+.027,
          'screenHeightRange':[1.15-p.terminal_drop-.90*.11-.045,
                               1.15-p.terminal_drop+.90*.18-.045],
          'anchor':[w//2+1-int(x0),h//2+1-int(y0)],'tile':[core.TILE_W,core.TILE_H],
          'camera':{'yaw':45,'elevation':30},'samples':4,'crewFinishing':'none; source outfit colours'}
    (out/'crew-scale.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta),flush=True)


def compose(out):
    from PIL import Image,ImageDraw,ImageFont
    im=Image.open(out/'crew-scale.png').convert('RGBA')
    bg=(27,34,43);big=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST)
    board=Image.new('RGB',(big.width+40,big.height+90),bg);board.paste(big,(20,55),big)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    ImageDraw.Draw(board).text((20,15),'REFINERY / LOWERED CONSOLE / CREW SCALE',font=font,fill=(220,229,236))
    board.save(out/'crew-scale-preview.png')


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);ap.add_argument('--compose',action='store_true')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    compose(args.out) if args.compose else render(args.out)
