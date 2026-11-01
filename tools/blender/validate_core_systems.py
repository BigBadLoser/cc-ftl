"""Validate actual final atlas pixels and the approved-source handoff contract."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def load(path): return json.loads(path.read_text())


def png(path):
    image = Image.open(path)
    assert image.mode == 'RGBA', path
    return np.array(image)


def validate(package, source=ROOT):
    lock_path = source / 'tools/blender/core_systems_approved.json'
    lock = load(lock_path); settings = load(package / 'settings.json')
    manifest = load(package / 'manifest.fragment.json'); build = load(package / 'build.json')
    integration = load(package / 'integration.json'); aliases = integration['aliases']
    assert build['complete'] and build['uniqueFrames'] == 40
    assert build['manifestEntries'] == len(manifest['assets']) == 60 and len(aliases) == 20
    assert build['approvedFramesReused'] == 22
    assert settings['pinnedBlender'] == '4.2.9' and settings['blenderVersion'].startswith('4.2.9')
    assert settings['SS'] == settings['samples'] == 4 and settings['threads'] == 2
    assert not settings['preview'] and not settings['sunShadows']
    assert settings['cameraYaw'] == 45 and settings['cameraElevation'] == 30
    assert settings['nativeTile'] == [64, 32] and settings['displayScale'] == 2
    assert settings['maxSheetSide'] == 4096
    assert settings['approvalLockSha256'] == hashlib.sha256(lock_path.read_bytes()).hexdigest()
    assert settings['exporterSha256'] == hashlib.sha256((source / 'tools/blender/export_core_systems.py').read_bytes()).hexdigest()
    for path, sha in lock['files'].items():
        assert hashlib.sha256((source / path).read_bytes()).hexdigest() == sha, path
    assert all(manifest[k] == v for k, v in lock['manifestHeader'].items())
    assert integration['contentFootprintChangesRequired'] is False and integration['runtimeEditsMade'] is False
    atlases, coverage, dimensions = {}, {}, {}
    for key, rec in manifest['sheets'].items():
        c, g = png(package / rec['image']), png(package / rec['glow'])
        assert c.shape == g.shape
        h, w = c.shape[:2]
        assert w <= 4096 and h <= 4096 and w & (w - 1) == 0
        atlases[key] = (c, g); coverage[key] = np.zeros((h, w), bool)
        dimensions[key] = [w, h]
    assert set(atlases) == {'reactor', 'life_support'}
    count, approved, records, frame_pixels = 0, 0, {}, {}
    for key, asset in manifest['assets'].items():
        assert asset['kind'] == 'static'
        if key in aliases:
            assert asset == manifest['assets'][aliases[key]]
            continue
        count += 1
        meta = load(package / 'frames' / f'{key}.json')
        records[key] = meta
        c, g = atlases[asset['sheet']]
        f = asset['frame']; x, y, w, h = (f[k] for k in ('x', 'y', 'w', 'h'))
        assert x >= 1 and y >= 1 and x + w < c.shape[1] and y + h < c.shape[0]
        used = coverage[asset['sheet']]
        assert not used[y:y+h, x:x+w].any(); used[y:y+h, x:x+w] = True
        raw, rg = png(package / 'frames' / f'{key}.png'), png(package / 'frames' / f'{key}.glow.png')
        assert np.array_equal(raw, c[y:y+h, x:x+w]) and np.array_equal(rg, g[y:y+h, x:x+w])
        assert bool(asset.get('glow')) == bool(rg[..., 3].any())
        assert not ((rg[..., 3] > 0) & (raw[..., 3] == 0)).any()
        for atlas in (c, g):
            assert not (atlas[y-1, x-1:x+w+1, 3].any() or atlas[y+h, x-1:x+w+1, 3].any() or
                        atlas[y:y+h, x-1, 3].any() or atlas[y:y+h, x+w, 3].any())
        r, name, state = meta['rotation'], meta['name'], meta['state']
        expected_fp = [2, 2] if name == 'reactor' else ([1, 2] if r % 2 == 0 else [2, 1])
        assert asset['footprint'] == meta['footprint'] == expected_fp
        frame_set = build['frameSets'][f'{name}.r{r}']
        assert [w, h] == meta['size'] == frame_set['size']
        assert asset['anchor'] == meta['anchor'] == frame_set['anchor']
        assert all(isinstance(asset['anchor'][k], int) for k in ('x', 'y'))
        lo, hi = meta['gridBounds']; fw, fh = expected_fp
        assert lo[0] >= -fw + .5 and hi[0] <= .5 and lo[1] >= -fh + .5 and hi[1] <= .5
        assert lo[2] == 0 and hi[2] < 1.85
        if state in ('unpowered', 'damaged.flicker', 'destroyed'): assert not rg.any()
        if state not in ('powered', 'unpowered'): assert meta['rigidDamageRotationVerified']
        ref_key = meta['approvedReference']
        if ref_key:
            ref = lock['approvedFrames'][ref_key]; old = ref['metadata']
            oc, og = png(source / ref['image']), png(source / ref['glow'])
            xx, yy = asset['anchor']['x'] - old['anchor'][0], asset['anchor']['y'] - old['anchor'][1]
            hh, ww = oc.shape[:2]
            assert xx >= 0 and yy >= 0
            assert np.array_equal(raw[yy:yy+hh, xx:xx+ww], oc), key
            assert np.array_equal(rg[yy:yy+hh, xx:xx+ww], og), key
            if 'geometryDigest' in old: assert meta['geometryDigest'] == old['geometryDigest']
            approved += 1
        frame_pixels[key] = raw
    assert count == 40 and approved == 22
    for sheet, (c, g) in atlases.items():
        assert not c[..., 3][~coverage[sheet]].any() and not g[..., 3][~coverage[sheet]].any()
    for name in ('reactor', 'life_support'):
        for r in range(4):
            base = f'module.{name}.r{r}'
            assert np.array_equal(frame_pixels[base][..., 3], frame_pixels[base + '.unpowered'][..., 3])
            assert np.array_equal(frame_pixels[base + '.damaged'][..., 3], frame_pixels[base + '.damaged.flicker'][..., 3])
            assert records[base + '.damaged']['geometryDigest'] == records[base + '.damaged.flicker']['geometryDigest']
    return {'complete': True, 'uniqueFrames': 40, 'manifestEntries': 60,
            'sheetSizes': dimensions, 'nativeTile': [64, 32], 'displayScale': 2,
            'approvedFramePairsPixelExact': approved, 'atlasRoundTripExact': True,
            'gutterAndOverlapChecks': True, 'fixedFrameSets': build['frameSets'],
            'allFootprintsAndHeightsValid': True, 'offFlickerDestroyedGlowZero': True,
            'damageFlickerGeometryAndAlphaExact': True, 'sourceAndPipelineHashesVerified': True}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--package', type=Path, required=True)
    ap.add_argument('--source', type=Path, default=ROOT); ap.add_argument('--report', type=Path, required=True)
    args = ap.parse_args(); result = validate(args.package, args.source)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
