"""Load the current game's pipeline from an explicit checkout, and this asset's model.

The art worktree predates the switch to native 64x32 art. Keep its historical
previews reproducible; production runs import the target checkout's pipeline.
"""
import hashlib,subprocess,sys
from pathlib import Path

MODEL_ROOT=Path(__file__).resolve().parents[2]


def configure(pipeline):
    pipeline=pipeline.resolve()
    assert (pipeline/'tools/blender/sprites/scale.py').is_file()
    sys.path.insert(0,str(pipeline/'tools/blender'))
    import sprites
    sprites.__path__.append(str(MODEL_ROOT/'tools/blender/sprites'))
    from sprites import core,scale
    from sprites import refinery_asset
    assert Path(core.__file__).resolve()==pipeline/'tools/blender/sprites/core.py'
    assert Path(refinery_asset.__file__).resolve()==MODEL_ROOT/'tools/blender/sprites/refinery_asset.py'
    return pipeline


def provenance(pipeline):
    files=['sprites/core.py','sprites/post.py','sprites/env_build.py','sprites/pack.py',
           'sprites/scale.py','sprites/cmbkit.py','lib/palette.py','palette_extra.json','setup.sh']
    hashes={str(Path('tools/blender')/p):hashlib.sha256((pipeline/'tools/blender'/p).read_bytes()).hexdigest() for p in files}
    hashes['palette.json']=hashlib.sha256((pipeline/'palette.json').read_bytes()).hexdigest()
    models=['refinery_asset.py','refinery_revision_b.py','refinery_finish.py','refinery_operating.py',
            'refinery_compact.py','refinery_blockout.py']
    own={p:hashlib.sha256((MODEL_ROOT/'tools/blender/sprites'/p).read_bytes()).hexdigest() for p in models}
    return {'pipelineCommit':subprocess.check_output(['git','-C',str(pipeline),'rev-parse','HEAD'],text=True).strip(),
            'pipelineFiles':hashes,'modelFiles':own}
