"""Check actual geometry for all rotations and the rendered review assets in Blender."""
import argparse
import json
import sys
from pathlib import Path
import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parents[1]),str(HERE)]
from sprites import core,post,walls  # noqa: E402
import model  # noqa: E402


def local_coords(objects,rot):
    points=np.array([tuple(ob.matrix_world@v.co) for ob in objects for v in ob.data.vertices])
    cx,cy=model.CENTRE[rot]
    x,y=points[:,0]-cx,-points[:,1]-cy
    u,v=[(-y,x),(x,y),(y,-x),(-x,-y)][rot]
    return np.c_[u,v,points[:,2]]


def png(path):
    im=bpy.data.images.load(str(path))
    im.colorspace_settings.name="Non-Color"
    im.alpha_mode="STRAIGHT"
    w,h=im.size
    px=np.empty(w*h*4,np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return np.round(px.reshape(h,w,4)[::-1]*255).astype(np.uint8)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("out",type=Path)
    parser.add_argument("--require-complete",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    out=args.out
    stage=json.loads((out/"design.json").read_text())["stage"]
    report={"stage":stage,"geometry":{},"sprites":{}}
    for r in range(4):
        core.setup_scene()
        hull=model.hull(r,stage)
        objects=model.machine(r,False,stage,holdout=False)
        bpy.context.view_layer.update()
        local=local_coords(objects,r)
        assert local[:,0].min()>=-2.5-1e-5
        assert np.abs(local[:,1]).max()<=2.0+1e-5
        assert abs(local[:,0].max()-4.0)<1e-5
        assert local[:,2].min()>=-1e-5
        for end in hull[:2]:
            coords=local_coords([end],r)
            assert abs(coords[:,2].max()-walls.HF)<1e-5
        bell=next(o for o in objects if o.name=="KESTREL_bell")
        coords=local_coords([bell],r)
        rim=coords[np.abs(coords[:,0]-4)<1e-5]
        assert abs(rim[:,1].max()-rim[:,1].min()-2.6)<1e-5
        assert abs(coords[:,0].max()-2.5-1.5)<1e-5
        if stage>=7:
            bed=next(o for o in objects if o.name=="KESTREL_bed")
            assert abs(local_coords([bed],r)[:,2].min())<1e-6
            from sprites.cmbkit import Frame
            frame=Frame(core.Mesh("deck_probe"),r,centre=model.CENTRE[r])
            for v in (-1,0,1):
                # The former full-footprint plate covered this strip behind
                # the injector. It must now be open to the real ship deck.
                assert not bed.ray_cast(frame.pt(-2.4,v,0.35),(0,0,-1),distance=0.6)[0]
        report["geometry"][f"r{r}"]={"bellDiameter":2.6,"protrusion":1.5,
            "footprint":[5,4] if r%2 else [4,5],"endWallHeight":walls.HF,
            "bulkheadHeight":round(float(local_coords(hull,r)[:,2].max()),3),
            "directDeckMounts":stage>=7,"separateFloorPlate":stage<7}
    man=json.loads((out/"manifest.fragment.json").read_text())
    if args.require_complete:
        expected={f"module.engine.{part}.r{r}{suffix}" for r in range(4)
                  for part,suffix in (("hull",""),("machine",""),("machine",".active"))}
        assert set(man["assets"])==expected,"Expected all 12 hull / idle / active assets"
    report["completeSetRequired"]=args.require_complete
    allowed=set(map(tuple,post.PALETTE.astype(np.uint8)))
    for sid,a in man["assets"].items():
        sh=man["sheets"][a["sheet"]]
        col,glow=png(out/sh["image"]),png(out/sh["glow"])
        assert col.shape==glow.shape
        assert col.shape[:2]==(a["frame"]["h"],a["frame"]["w"])
        assert set(np.unique(col[...,3])).issubset({0,255})
        assert set(np.unique(glow[...,3])).issubset({0,255})
        colors=set(map(tuple,col[col[...,3]>0,:3]))
        assert colors<=allowed
        outside=int(((glow[...,3]>0)&(col[...,3]==0)).sum())
        if sid.endswith(".active"):
            assert outside>0,"Exhaust should be additive in space"
        report["sprites"][sid]={"size":[col.shape[1],col.shape[0]],"paletteColors":len(colors),
            "additivePixelsOutsideColor":outside,"binaryAlpha":True}
    report["result"]="PASS"
    (out/"validation.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2),flush=True)


if __name__=="__main__":
    main()
