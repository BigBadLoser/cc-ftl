"""Final refinery-only export through the current game's renderer and sheet packer.

Run in Blender with --pipeline <current main checkout> --out <scratch package>.
No live manifest, src files, or other sprite families are modified.
"""
import argparse,hashlib,json,os,re,sys
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from refinery_pipeline import configure,provenance


def dump(path,value): path.write_text(json.dumps(value,indent=2)+'\n')


def normalize_frames(items):
    # One fixed size/anchor per rotation across all states, with no scaling.
    sizes={}
    for rotation in range(4):
        group=[it for it in items if it['rotation']==rotation]
        lo_x=min(-it['ax'] for it in group);lo_y=min(-it['ay'] for it in group)
        hi_x=max(it['rgba'].shape[1]-it['ax'] for it in group)
        hi_y=max(it['rgba'].shape[0]-it['ay'] for it in group)
        w,h,ax,ay=map(int,(hi_x-lo_x,hi_y-lo_y,-lo_x,-lo_y))
        for it in group:
            x,y=ax-it['ax'],ay-it['ay'];ih,iw=it['rgba'].shape[:2]
            col=np.zeros((h,w,4),np.uint8);glow=np.zeros_like(col)
            col[y:y+ih,x:x+iw]=it['rgba'];glow[y:y+ih,x:x+iw]=it['g']
            it.update(rgba=col,g=glow,ax=ax,ay=ay)
        sizes[f'r{rotation}']={'w':w,'h':h,'anchor':{'x':ax,'y':ay}}
    return sizes


def export(args):
    pipeline=configure(args.pipeline)
    import bpy
    from sprites import core,post,env_build,pack,walls,refinery_asset as asset
    from sprites.crew_pack import KEY_COLORS
    from sprites.refinery_revision_b import CONTROL_GREYS,FINISH_PALETTE
    from sprites.refinery_blockout import GREY
    pinned=re.search(r'^VERSION=([\d.]+)',(pipeline/'tools/blender/setup.sh').read_text(),re.M).group(1)
    assert tuple(bpy.app.version)==tuple(int(v) for v in pinned.split('.')),'Use the project-pinned Blender build'
    assert not core.PREVIEW and core.SS==4 and core.SAMPLES==4
    assert (core.TILE_W,core.TILE_H)==(64,32),'Use the current 1x production pipeline'
    out=args.out.resolve();frames=out/'frames';frames.mkdir(parents=True,exist_ok=True)
    source=provenance(pipeline)
    source['exporter']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    # Metadata/packing edits do not invalidate pixels rendered by env_build.
    render_source={k:v for k,v in source.items() if k!='exporter'}
    render_source['renderContract']={'kind':'prop','extraPalette':False,'native':[64,32],'SS':4,'samples':4}
    render_source['blenderVersion']=bpy.app.version_string
    build_hash=hashlib.sha256(json.dumps(render_source,sort_keys=True).encode()).hexdigest()
    previous=json.loads((out/'settings.json').read_text()) if (out/'settings.json').exists() else {}
    previous_source={k:v for k,v in previous.get('pipeline',{}).items() if k!='exporter'}
    adopt=(previous_source=={k:v for k,v in source.items() if k!='exporter'} and
           previous.get('nativeTile')==[64,32] and previous.get('supersample')==4 and
           previous.get('cyclesSamples')==4 and previous.get('sunShadows') is False and
           previous.get('preview') is False and previous.get('blenderVersion')==bpy.app.version_string)
    accepted_hashes={build_hash}|({previous['buildHash']} if adopt else set())
    core.setup_scene()
    assert core._state['sun'].data.use_shadow is False
    assert abs(core._state['sun'].data.energy-3.9)<1e-6
    for data in (GREY,CONTROL_GREYS,FINISH_PALETTE): post._BASE_PAL.update(data)
    post._STATES.clear();post.select(False)  # economy modules: env family palette
    settings={'nativeTile':[core.TILE_W,core.TILE_H],'displayGrid':[128,64],'displayScale':2,
      'supersample':core.SS,'cyclesSamples':core.SAMPLES,'preview':core.PREVIEW,
      'cameraEulerDegrees':[60,0,45],'cameraYaw':45,'cameraElevation':30,'sunEnergy':3.9,
      'sunShadows':False,'ambient':.15,'viewTransform':'Standard','look':'None',
      'filterWidth':core._state['scene'].cycles.filter_width,'maxBounces':0,
      'outline':'standard prop, 1 native pixel','palette':'env / extra=False + refinery material entries',
      'maxSheet':pack.PAGE,'blenderVersion':bpy.app.version_string,'pinnedBlender':pinned,
      'threadsFlag':sys.argv[sys.argv.index('-t')+1] if '-t' in sys.argv else None,
      'pipeline':source,'buildHash':build_hash}
    dump(out/'settings.json',settings);dump(out/'parameters.json',asset.parameters().spec())
    furniture=(pipeline/'src/content/furniture.ts').read_text()
    block=furniture.split("'module.refinery':",1)[1].split('}',1)[0]
    current_access=[int(v) for v in re.search(r'access:\s*\[(\d+),\s*(\d+)\]',block).groups()]
    assert re.search(r'footprint:\s*\[3,\s*4\]',block)
    items=[];records=[]
    for index,(rotation,state,frame) in enumerate(asset.poses(),1):
        sid=asset.asset_id(rotation,state,frame);meta_path=frames/f'{sid}.json';layout=asset.layout(rotation)
        cached=json.loads(meta_path.read_text()) if meta_path.exists() else {}
        if cached.get('buildHash') in accepted_hashes and (frames/f'{sid}.png').exists() and (frames/f'{sid}.glow.png').exists():
            it={'id':sid,'fp':layout['footprint'],'rgba':pack.read_png(frames/f'{sid}.png'),
                'g':pack.read_png(frames/f'{sid}.glow.png'),'ax':cached['anchor']['x'],'ay':cached['anchor']['y']}
            record={**cached,'buildHash':build_hash}
        else:
            core.clear_scene_meshes();objects=asset.build(rotation,state,frame)
            q=np.concatenate([np.array([tuple(ob.matrix_world@v.co) for v in ob.data.vertices]) for ob in objects])
            w,h=layout['footprint'];grid=q.copy();grid[:,1]*=-1
            assert grid[:,0].min()>=-w+.5 and grid[:,0].max()<=.5
            assert grid[:,1].min()>=-h+.5 and grid[:,1].max()<=.5
            assert q[:,2].min()>=0 and q[:,2].max()<1.85
            c,op,g,ox,oy,al=env_build.render_sprite(sid,'prop',objects)
            assert not (op[0].any() or op[-1].any() or op[:,0].any() or op[:,-1].any())
            assert not (g[0,:,3].any() or g[-1,:,3].any() or g[:,0,3].any() or g[:,-1,3].any())
            it=env_build.crop_item(sid,layout['footprint'],c,op,g,ox,oy,al)
            if rotation==0 and state=='idle':
                core._set_pass('color');bpy.context.preferences.filepaths.save_version=0
                bpy.ops.wm.save_as_mainfile(filepath=str(out/'refinery.blend'),compress=True)
            if state=='unpowered': assert not it['g'][...,3].any()
            record={'id':sid,'rotation':rotation,'state':state,'frame':frame,'footprint':layout['footprint'],
                    'gridBounds':[grid.min(axis=0).tolist(),grid.max(axis=0).tolist()],
                    'glowPixels':int((it['g'][...,3]>0).sum()),'buildHash':build_hash}
        it['rotation']=rotation;items.append(it);records.append(record)
        # Checkpoints allow an interrupted shared-machine render to resume.
        post.write_png(frames/f'{sid}.png',it['rgba']);post.write_png(frames/f'{sid}.glow.png',it['g'])
        dump(meta_path,{**record,'anchor':{'x':int(it['ax']),'y':int(it['ay'])}})
        print(f'REFINERY {index}/24 {sid}',flush=True)
    sizes=normalize_frames(items)
    for it,record in zip(items,records):
        post.write_png(frames/f"{it['id']}.png",it['rgba']);post.write_png(frames/f"{it['id']}.glow.png",it['g'])
        record.update(anchor={'x':int(it['ax']),'y':int(it['ay'])},size=list(it['rgba'].shape[1::-1]))
        dump(frames/f"{it['id']}.json",record)
    sheets,assets=pack.pack('refinery',items,out)
    animations={};aliases={}
    for rotation in range(4):
        active=asset.asset_id(rotation,'working',0)
        aliases[active+'.f0']=active
        animations[active]={'frames':[asset.asset_id(rotation,'working',f) for f in range(4)],'fps':asset.FPS,'loop':True}
    aliases.update({'module.refinery':asset.asset_id(0),'module.refinery.active':asset.asset_id(0,'working'),
                    'module.refinery.unpowered':asset.asset_id(0,'unpowered')})
    for alias,target in aliases.items(): assets[alias]=dict(assets[target])
    manifest={'version':1,'tile':{'w':core.TILE_W,'h':core.TILE_H},'keyColors':KEY_COLORS,
              'heights':{'wall':walls.HF,'roof':round(walls.hull_top(),4),'zPx':round(core.ZPX,4)},
              'sheets':sheets,'assets':dict(sorted(assets.items()))}
    pack.save_manifest(out/'manifest.fragment.json',manifest);dump(out/'animations.json',animations)
    dump(out/'layout.json',{f'r{r}':asset.layout(r) for r in range(4)})
    dump(out/'integration.json',{'asset':'module.refinery','footprint':list(asset.FOOTPRINT),
       'currentAccess':current_access,'requiredAccess':list(asset.ACCESS),
       'requiredContentChange':'module.refinery.access = [3, 3] when integrating; src is untouched in this pack',
       'terminalOutwardAdjustment':.12,'terminalHeightUnchanged':True,
       'stateSelection':{'poweredIdle':'module.refinery.rN','unpowered':'module.refinery.rN.unpowered',
         'working':'module.refinery.rN.active, plus animations.json frames'},
       'runtimeNote':'The current module chain needs explicit unpowered and animated-frame selection; the active base already resolves as a static asset.',
       'renderScale':'Native 64x32 1x art, drawn at 2x on the 128x64 grid; merge into the 1x manifest.',
       'uniqueFrames':len(items),'manifestEntriesIncludingAliases':len(assets),'aliases':aliases,'frameSets':sizes,
       'nativeSheetSizes':{key:[int(v) for v in pack.read_png(out/value['image']).shape[1::-1]] for key,value in sheets.items()}})
    dump(out/'build.json',{'complete':True,'buildHash':build_hash,'settings':'settings.json','uniqueFrames':24,
                           'manifestEntries':len(assets),'frameSets':sizes})
    print('REFINERY EXPORT COMPLETE',flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--pipeline',type=Path,required=True);ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]);export(args)
