"""Check geometry in all rotations, then validate the actual rendered delivery."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(HERE.parents[1]),str(HERE)]


def local_vertices(ob,rot):
    import model
    p=np.array([ob.matrix_world @ v.co for v in ob.data.vertices])
    x=p[:,0]-model.CENTRE[rot][0]
    y=-p[:,1]-model.CENTRE[rot][1]
    u,v=((-y,x),(x,y),(y,-x),(-x,-y))[rot]
    return np.c_[u,v,p[:,2]]


def geometry(out):
    import bpy
    from sprites import core
    import materials
    import model
    materials.install()
    report={"rotations":[],"wallZ":1.85,"footprint":[1,4],
            "cycleSeconds":4,"simImplemented":False}
    for rot in range(4):
        core.setup_scene()
        obs=model.frame(rot)
        p=np.concatenate([local_vertices(ob,rot) for ob in obs])
        assert p[:,0].min()>=-2-1e-6 and p[:,0].max()<=2+1e-6
        assert np.abs(p[:,1]).max()<=.5+1e-6
        assert p[:,2].min()>=-1e-6 and p[:,2].max()<=1.86
        # No large horizontal surface under the module: floors belong to the grid.
        for ob in obs:
            q=local_vertices(ob,rot)
            for poly in ob.data.polygons:
                vs=q[list(poly.vertices)]
                extent=np.ptp(vs,axis=0)
                assert not (vs[:,2].max()<.12 and extent[2]<1e-5 and extent[0]>1 and extent[1]>.3)
        # The chamber shell is identical in every wall view, including its roof.
        reference_frame=np.concatenate([local_vertices(ob,rot) for ob in obs])
        for mode in ("cut","ghost"):
            check=np.concatenate([local_vertices(ob,rot) for ob in model.frame(rot,mode)])
            np.testing.assert_array_equal(reference_frame,check)
        assert any(ob.name.startswith("AIRLOCK_sealed_roof") for ob in obs)
        bpy.context.view_layer.update()
        dg=bpy.context.evaluated_depsgraph_get()
        f=model.local(core.Mesh("ray_coordinates"),rot)
        for u in (-1.1,0,1.1):
            for v in (-.2,0,.2):
                start=f.pt(u,v,3)
                direction=(f.pt(u,v,1)-start).normalized()
                hit,_,_,_,ob,_=bpy.context.scene.ray_cast(dg,start,direction)
                assert hit and ob.name.startswith("AIRLOCK_sealed_roof"),(rot,"roof leak",u,v)
            for side in (-1,1):
                start=f.pt(u,side*.9,.9)
                direction=(f.pt(u,0,.9)-start).normalized()
                hit,_,_,_,ob,_=bpy.context.scene.ray_cast(dg,start,direction)
                assert hit and ob.name.startswith("AIRLOCK_chamber_side"),(rot,"side leak",u,side)
        for which in ("inner","outer"):
            for pose,value in model.POSES.items():
                ob=model.door(rot,which,value)[0]
                q=local_vertices(ob,rot)
                assert np.abs(q[:,1]).max()<=.5+1e-6,(rot,which,pose,"width")
                assert q[:,0].min()>=-2-1e-6 and q[:,0].max()<=2+1e-6
                if value==1:
                    # At full opening every leaf clears the walk-through lane.
                    assert np.abs(q[:,1]).min()>.31
        reference={}
        for which in ("inner","outer"):
            reference[which]=local_vertices(model.door(rot,which,0)[0],rot)
        for state in ("cycling","unpowered","broken","outer-open","inner-open"):
            objects=model.assembly(rot,"cut",state)
            for which in ("inner","outer"):
                door=next(ob for ob in objects if ob.name.startswith("AIRLOCK_"+which+"_leaves"))
                if state!=which+"-open":
                    np.testing.assert_allclose(local_vertices(door,rot),reference[which],atol=1e-6)
        assert not model.lights(rot,"unpowered") and not model.lights(rot,"broken")
        report["rotations"].append({"rotation":rot,"bounds":np.round([p.min(0),p.max(0)],5).tolist(),
                                    "allDoorPosesInFootprint":True,"openLaneWidth":.62,
                                    "interlockPoses":True,"noFloorSlab":True,"opaqueTubeInAllViews":True,
                                    "roofAndSideRayChecks":True})
    (out/"geometry-validation.json").write_text(json.dumps(report,indent=2)+"\n")
    print("GEOMETRY PASS / all 4 rotations / footprint / doors / interlock poses / no floor")


def pixels(out):
    from PIL import Image
    import materials
    from sprites import post
    materials.install()
    man=json.loads((out/"review.manifest.json").read_text())
    allowed={tuple(x) for x in post.BASE.astype(np.uint8)}
    image_count=0
    for sid,a in man["assets"].items():
        sheet=man["sheets"][a["sheet"]]
        for kind in ("image","glow"):
            p=np.array(Image.open(out/sheet[kind]).convert("RGBA"))
            assert set(np.unique(p[...,3])).issubset({0,255}),(sid,"alpha")
            assert (p.shape[1],p.shape[0])==(a["frame"]["w"],a["frame"]["h"])
            if kind=="image":
                colors={tuple(x) for x in p[p[...,3]>0,:3]}
                assert colors<=allowed,(sid,"palette",colors-allowed)
            image_count+=1
    for rot in (0,1):
        sid=f"state.r{rot}.unpowered"
        path=out/man["sheets"][sid]["glow"]
        assert not np.array(Image.open(path))[...,3].any()
        # An opaque tube naturally hides the opposite-facing hatch. Check the
        # inner doorway from r0 and the outer doorway from r1.
        for door in (("inner",) if rot==0 else ("outer",)):
            names=("sealed",door+"-opening",door+"-open")
            files=[(out/man["sheets"][f"state.r{rot}.{n}"]["image"]).read_bytes() for n in names]
            assert len(set(files))==3
    enlarged=[]
    for path in sorted(out.glob("*-1x.png")):
        larger=path.with_name(path.name.replace("-1x","-3x"))
        if larger.exists():
            a=np.array(Image.open(path).convert("RGB"))
            b=np.array(Image.open(larger).convert("RGB"))
            assert b.shape==(a.shape[0]*3,a.shape[1]*3,3)
            for dy in range(3):
                for dx in range(3):
                    np.testing.assert_array_equal(b[dy::3,dx::3],a)
            enlarged.append(path.stem)
    report={"spriteImagesChecked":image_count,"binarySpriteAlpha":True,"localPalette":True,
            "unpoweredGlowIsEmpty":True,"doorStatesDistinct":True,"exact3xBoards":enlarged,
            "blenderVersion":"4.3.2","spriteSamples":4,"beautySamples":8,
            "previewRotations":[0,1],"geometryRotations":[0,1,2,3]}
    (out/"pixel-validation.json").write_text(json.dumps(report,indent=2)+"\n")
    print("PIXELS PASS /",image_count,"images / binary alpha / palette / exact 3x / dark unpowered")


def main():
    p=argparse.ArgumentParser()
    p.add_argument("out",type=Path)
    p.add_argument("--geometry",action="store_true")
    args=p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    args.out.mkdir(parents=True,exist_ok=True)
    geometry(args.out) if args.geometry else pixels(args.out)


if __name__=="__main__":
    main()
