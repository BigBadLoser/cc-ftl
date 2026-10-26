"""Verify approved geometry survives the production pipeline and access fit."""
import argparse,hashlib,json,sys
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from refinery_pipeline import configure


def audit(args):
    configure(args.pipeline)
    from sprites import core
    from sprites.refinery_revision_b import VesselRefinery,refinery_revision_b
    from sprites.refinery_asset import parameters
    core.setup_scene()
    approved=VesselRefinery(**json.loads((args.approved/'b.parameters.json').read_text()))
    ob=refinery_revision_b(approved)[0]
    before=np.array([v.co[:] for v in ob.data.vertices],dtype='<f4')
    digest=hashlib.sha256(before.tobytes()).hexdigest()
    assert digest==json.loads((args.approved/'b.json').read_text())['vertexDigest']
    colours={key:np.array([v.color[:] for v in ob.data.color_attributes[key].data]) for key in ('Col','Self','Glow')}
    core.clear_scene_meshes();ob=refinery_revision_b(parameters())[0]
    after=np.array([v.co[:] for v in ob.data.vertices],dtype='<f4')
    delta=after-before;changed=np.abs(delta).max(axis=1)>1e-6
    assert changed.any() and np.abs(delta[:,[0,2]]).max()<1e-6
    assert np.allclose(delta[changed,1],-.12,atol=1e-6,rtol=0)
    q=before[changed]
    assert q[:,0].min()>=-1.351 and q[:,0].max()<=-.649
    assert q[:,1].min()>=-1.361 and q[:,1].max()<=-.479
    for key,value in colours.items():
        assert np.array_equal(value,np.array([v.color[:] for v in ob.data.color_attributes[key].data]))
    report={'approvedVertexDigestMatches':True,'approvedVertexDigest':digest,
            'productionGeometryChange':'Only terminal upper arm/pod/controls move 0.12 along local +v for access reach.',
            'changedVertices':int(changed.sum()),'vertexCount':len(after),'heightChange':0,
            'materialAttributesUnchanged':True,'bounds':np.ptp(after,axis=0).tolist()}
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--pipeline',type=Path,required=True)
    ap.add_argument('--approved',type=Path,required=True);ap.add_argument('--report',type=Path,required=True)
    audit(ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]))
