"""Geometry checks for the isolated 1.85 wall / 2.05 roof art variant.

Run in Blender. Checks every rotation without doing final-quality renders.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EXPERIMENTS = HERE.parent
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sprites import core


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def shields(suffix):
    folder = EXPERIMENTS / ('shield_bastion' + suffix)
    load('geometry', folder / 'geometry.py')
    return (load('shield_model' + suffix, folder / 'model.py'),
            load('shield_roof' + suffix, folder / 'roof.py'))


def vertices(build):
    core.setup_scene()
    objects = build()
    return np.array([tuple(ob.matrix_world @ v.co)
                     for ob in objects for v in ob.data.vertices])


def bounds(v, footprint):
    w, d = footprint
    assert v[:, 0].min() >= -w + .5 - 1e-5
    assert v[:, 0].max() <= .5 + 1e-5
    assert v[:, 1].min() >= -.5 - 1e-5
    assert v[:, 1].max() <= d - .5 + 1e-5


def main():
    ai_old = load('ai_original', EXPERIMENTS / 'ai_core_oracle/model.py')
    ai = load('ai_variant', EXPERIMENTS / 'ai_core_oracle_h185/model.py')
    shield_old, roof_old = shields('')
    shield, roof = shields('_h185')
    report = {'wallZ': 1.85, 'roofZ': 2.05, 'rotationsChecked': [0, 1, 2, 3]}
    assert ai.WALL_Z == 1.85 and ai.ROOF_Z == 2.05
    assert roof.WALL_Z == 1.85 and roof.ZR == 2.05
    for r in range(4):
        for hot in (False, True):
            for name, build, footprint in (
                ('ORACLE', lambda: ai.core_module(r, hot), [2, 2]),
                ('BASTION', lambda: shield.large(r, hot), [2, 3] if r % 2 == 0 else [3, 2]),
                ('WARD', lambda: shield.small(r, hot), [2, 2]),
            ):
                v = vertices(build)
                bounds(v, footprint)
                assert .0 <= v[:, 2].min() <= .03, name
                assert abs(v[:, 2].max() - 2.05) < 1e-5, name
        for pose in ai.POSES:
            for old, new, footprint in (
                (lambda: ai_old.roof_sensor(pose, r), lambda: ai.roof_sensor(pose, r), [2, 2]),
                (lambda: roof_old.large(pose, r), lambda: roof.large(pose, r), [2, 3] if r % 2 == 0 else [3, 2]),
                (lambda: roof_old.small(pose, r), lambda: roof.small(pose, r), [2, 2]),
            ):
                a, b = vertices(old), vertices(new)
                bounds(b, footprint)
                assert a.shape == b.shape
                # Entire roof mechanism moves down 0.35; no scaling or changed
                # hinge timing, target coverage, thickness or mast proportions.
                assert np.allclose(b, a - (0, 0, .35), atol=1e-5)
                if pose == 'stowed':
                    assert abs(b[:, 2].max() - 2.051) < .0001
    for build in (lambda: ai.context('wall'), lambda: roof.context(wall=True)):
        v = vertices(build)
        assert abs(v[:, 2].min()) < 1e-5
        assert abs(v[:, 2].max() - 1.85) < 1e-5
    # The corrected WARD front lens is retained exactly, including its socket.
    captured = []
    original_hex = shield.hex_plate
    def capture(f, c, a, b, radius, *args, **kwargs):
        if radius == .485:
            import math
            from mathutils import Vector
            captured.append(min((Vector(c) + Vector(a)*radius*math.cos(i*math.tau/6)
                                 + Vector(b)*radius*math.sin(i*math.tau/6)).z for i in range(6)))
        return original_hex(f, c, a, b, radius, *args, **kwargs)
    shield.hex_plate = capture
    vertices(lambda: shield.small(0, True))
    assert min(captured) > 1.16 + .04
    report['wardLensClearance'] = min(captured) - 1.16
    # The display is fitted uniformly in its own plane; render checks also
    # verify that the unpowered AI sprite has no glow at all.
    assert ai.BODY_FIT == (2.05-.4)/2.0
    preserved = ROOT / 'artifacts/wall-1.85-roof-2.05/preserved-originals.sha256.json'
    # The local history includes large .blend files deliberately omitted from
    # the source handoff. Verify whatever originals are available in a checkout.
    checksums = json.loads(preserved.read_text()) if preserved.exists() else {}
    checked = 0
    for relative, expected in checksums.items():
        if not (ROOT / relative).is_file():
            continue
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected, relative
        checked += 1
    report['originalFilesUnchanged'] = checked
    report['originalFilesNotIncludedInCheckout'] = len(checksums) - checked
    report['roofMechanisms'] = 'all poses and rotations rigidly translated -0.35'
    report['status'] = 'PASS'
    preserved.parent.mkdir(parents=True, exist_ok=True)
    (preserved.parent / 'geometry-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
