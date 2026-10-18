"""Mirror audit of actual shuttle faces; only the hatch and its paint gap differ."""
from collections import Counter
from unittest.mock import patch


def audit(craft,core,strict=True):
    from lib import transport_details
    results={}
    # Capture the builder's raw meshes before Blender triangulates any quads.
    with patch.object(core.Mesh,"build",lambda mesh:mesh), \
         patch.object(transport_details,"pressure_hatch",lambda frame:None):
        for state,ramp in (("parked",0),("fly",0),("docked",0),("parked",1)):
            meshes=craft.transport_shuttle(0,state,ramp_open=ramp)
            for name,mesh in zip(("body","livery"),meshes):
                faces=[]
                for indices,*colors in mesh.f:
                    pts=[mesh.v[i] for i in indices]
                    # The forebody stripe stops around the one-sided airlock.
                    if name=="livery" and min(p[0] for p in pts)>=.49 and max(p[0] for p in pts)<=2.26:
                        continue
                    faces.append((pts,tuple(round(v,6) for col in colors for v in col)))
                def signatures(mirror):
                    return Counter((tuple(sorted((round(x,5),round(-y if mirror else y,5),round(z,5))
                                                  for x,y,z in pts)),colors) for pts,colors in faces)
                a,b=signatures(False),signatures(True)
                missing=sum((a-b).values())
                key=f"{state}{'-ramp-lowered' if ramp else ''}.{name}"
                results[key]={"facesChecked":len(faces),"unmatchedMirrorFaces":missing}
                if strict:
                    assert missing==0,f"{key}: {missing} faces lack matching mirrored geometry/paint"
    return {"tolerance":.00001,"exceptions":["airlock hatch","forebody paint gap around hatch"],
            "poses":results,"passed":all(v["unmatchedMirrorFaces"]==0 for v in results.values())}


if __name__=="__main__":
    import json,sys
    from pathlib import Path
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from sprites import shuttle_craft,core
    print(json.dumps(audit(shuttle_craft,core,strict=False),indent=2))
