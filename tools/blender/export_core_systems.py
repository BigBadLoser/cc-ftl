"""Export only the approved reactor and life support; never modify live assets."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
STATES = ('powered', 'unpowered', 'damaged', 'damaged.flicker', 'destroyed')
NAMES = ('reactor', 'life_support')


def dump(path, value): path.write_text(json.dumps(value, indent=2) + '\n')


def sid(name, rotation, state):
    return f'module.{name}.r{rotation}' + ('' if state == 'powered' else '.' + state)


def digest(objects):
    h = hashlib.sha256()
    for ob in objects:
        h.update(np.asarray([v.co[:] for v in ob.data.vertices], dtype=np.float32).tobytes())
        for p in ob.data.polygons: h.update(np.asarray(p.vertices[:], dtype=np.int32).tobytes())
    return h.hexdigest()


def normalize(items):
    """Pad states to one size/anchor per asset and rotation. Never rescale pixels."""
    sets = {}
    for name in NAMES:
        for rotation in range(4):
            group = [it for it in items if it['name'] == name and it['rotation'] == rotation]
            lx = min(-it['ax'] for it in group); ly = min(-it['ay'] for it in group)
            hx = max(it['rgba'].shape[1] - it['ax'] for it in group)
            hy = max(it['rgba'].shape[0] - it['ay'] for it in group)
            w, h, ax, ay = map(int, (hx - lx, hy - ly, -lx, -ly))
            for it in group:
                x, y = ax - it['ax'], ay - it['ay']; ih, iw = it['rgba'].shape[:2]
                color = np.zeros((h, w, 4), np.uint8); glow = np.zeros_like(color)
                color[y:y+ih, x:x+iw] = it['rgba']; glow[y:y+ih, x:x+iw] = it['g']
                it.update(rgba=color, g=glow, ax=ax, ay=ay)
            sets[f'{name}.r{rotation}'] = {'size': [w, h], 'anchor': {'x': ax, 'y': ay}}
    return sets


def export(out):
    import bpy
    from lib import palette
    from sprites import core, post, pack, env_build
    from sprites import core_systems_detail as model, core_systems_damage as damage
    from sprites.core_systems_blockout import PALETTE
    from sprites.core_systems_finish import PALETTE as FINISH
    from sprites.core_systems_touchups import parameters
    out.mkdir(parents=True, exist_ok=True); (out / 'frames').mkdir(exist_ok=True)
    lock_path = ROOT / 'tools/blender/core_systems_approved.json'
    lock = json.loads(lock_path.read_text())
    for path, sha in lock['files'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha, f'Approval changed: {path}'
    pinned = re.search(r'^VERSION=([\d.]+)', (ROOT / 'tools/blender/setup.sh').read_text(), re.M).group(1)
    assert tuple(bpy.app.version) == tuple(map(int, pinned.split('.'))) == (4, 2, 9)
    assert not core.PREVIEW and (core.SS, core.SAMPLES, core.TILE_W, core.TILE_H) == (4, 4, 64, 32)
    palette._data.update(PALETTE); palette._data.update(FINISH)
    core.setup_scene(); post.select(False)  # exact approved environment quantisation palette
    assert not core._state['sun'].data.use_shadow
    assert abs(core._state['sun'].data.energy - 3.9) < 1e-6
    build_hash = hashlib.sha256((lock_path.read_text() + bpy.app.version_string + 'SS4/S4/env').encode()).hexdigest()
    cache = ROOT / '.cache/core-systems-final' / build_hash
    cache.mkdir(parents=True, exist_ok=True)
    settings = {'blenderVersion': bpy.app.version_string, 'pinnedBlender': pinned,
                'nativeTile': [64, 32], 'displayGrid': [128, 64], 'displayScale': 2,
                'SS': 4, 'samples': 4, 'preview': False, 'threads': 2,
                'cameraYaw': 45, 'cameraElevation': 30, 'sunEnergy': 3.9,
                'sunShadows': False, 'ambient': .15, 'viewTransform': 'Standard',
                'look': 'None', 'filterWidth': .01, 'maxBounces': 0,
                'palette': 'standard env / extra=False, unchanged from approved previews',
                'outline': 'standard prop, 1 native pixel', 'maxSheetSide': pack.PAGE,
                'approvalLockSha256': hashlib.sha256(lock_path.read_bytes()).hexdigest(),
                'exporterSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'pipelineBaseCommit': lock['pipelineBaseCommit'],
                'currentMainVerified': lock['currentMainVerified'],
                'renderCoreUnchangedOnMain': lock['renderCoreUnchangedOnMain'], 'buildHash': build_hash}
    dump(out / 'settings.json', settings)
    dump(out / 'parameters.json', {n: parameters(n).spec() for n in NAMES})
    items, records, canonical, damaged_shapes = [], [], {}, {}
    reused, rendered = 0, 0
    for name in NAMES:
        p = parameters(name)
        for rotation in range(4):
            w, h = p.footprint if rotation % 2 == 0 else p.footprint[::-1]
            for state in STATES:
                key = sid(name, rotation, state)
                core.clear_scene_meshes()
                objects = (getattr(model, name)(p, rotation, finished=True, powered=state == 'powered')
                           if state in ('powered', 'unpowered') else damage.build(name, state, rotation))
                q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in objects])
                grid = q.copy(); grid[:, 1] *= -1
                lo, hi = grid.min(0), grid.max(0)
                assert lo[0] >= -w + .5 and hi[0] <= .5 and lo[1] >= -h + .5 and hi[1] <= .5
                assert lo[2] == 0 and hi[2] < 1.85
                dg = digest(objects)
                if state in ('unpowered', 'damaged.flicker', 'destroyed'): assert not core._glows()
                if state == 'damaged': damaged_shapes[(name, rotation)] = dg
                if state == 'damaged.flicker': assert dg == damaged_shapes[(name, rotation)]
                if state not in ('powered', 'unpowered'):
                    if rotation == 0: canonical[(name, state)] = grid.copy()
                    else:
                        cx, cy = -(w - 1) / 2, -(h - 1) / 2
                        x, y = grid[:, 0] - cx, grid[:, 1] - cy
                        u, v = ((-y, x), (x, y), (y, -x), (-x, -y))[rotation]
                        fw, fh = p.footprint
                        back = np.column_stack((v - (fw - 1) / 2, -u - (fh - 1) / 2, grid[:, 2]))
                        assert np.allclose(back, canonical[(name, state)], rtol=0, atol=1e-6)
                ref_key = f'{name}.r{rotation}.{state}'
                ref = lock['approvedFrames'].get(ref_key)
                if ref:
                    meta = ref['metadata']
                    if 'geometryDigest' in meta: assert dg == meta['geometryDigest']
                    it = {'id': key, 'fp': [w, h], 'rgba': pack.read_png(ROOT / ref['image']),
                          'g': pack.read_png(ROOT / ref['glow']), 'ax': meta['anchor'][0], 'ay': meta['anchor'][1]}
                    origin = 'approved'; reused += 1
                elif (cache / f'{key}.json').exists():
                    meta = json.loads((cache / f'{key}.json').read_text())
                    assert meta['geometryDigest'] == dg
                    it = {'id': key, 'fp': [w, h], 'rgba': pack.read_png(cache / f'{key}.png'),
                          'g': pack.read_png(cache / f'{key}.glow.png'), 'ax': meta['ax'], 'ay': meta['ay']}
                    origin = 'render-cache'
                else:
                    it = env_build.crop_item(key, [w, h], *env_build.render_sprite(key, 'prop', objects))
                    assert it is not None
                    post.write_png(cache / f'{key}.png', it['rgba']); post.write_png(cache / f'{key}.glow.png', it['g'])
                    dump(cache / f'{key}.json', {'geometryDigest': dg, 'ax': int(it['ax']), 'ay': int(it['ay'])})
                    origin = 'rendered'; rendered += 1
                if state in ('unpowered', 'damaged.flicker', 'destroyed'): assert not it['g'].any()
                if rotation == 0 and state == 'powered':
                    core._set_pass('color'); bpy.context.preferences.filepaths.save_version = 0
                    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'), compress=True)
                it.update(name=name, rotation=rotation, state=state)
                items.append(it)
                records.append({'id': key, 'name': name, 'rotation': rotation, 'state': state,
                                'footprint': [w, h], 'geometryDigest': dg,
                                'gridBounds': [lo.tolist(), hi.tolist()], 'source': origin,
                                'approvedReference': ref_key if ref else None,
                                'rigidDamageRotationVerified': state not in ('powered', 'unpowered'),
                                'glowPixels': int(np.count_nonzero(it['g'][..., 3]))})
                print(f'CORE SYSTEMS {len(items)}/40 {key} {origin}', flush=True)
    sets = normalize(items)
    for it, rec in zip(items, records):
        rec.update(anchor={'x': int(it['ax']), 'y': int(it['ay'])}, size=list(it['rgba'].shape[1::-1]))
        post.write_png(out / 'frames' / f"{it['id']}.png", it['rgba'])
        post.write_png(out / 'frames' / f"{it['id']}.glow.png", it['g'])
        dump(out / 'frames' / f"{it['id']}.json", rec)
    sheets, assets, aliases = {}, {}, {}
    for name in NAMES:
        sh, ass = pack.pack(name, [it for it in items if it['name'] == name], out)
        sheets.update(sh); assets.update(ass)
        for state in STATES:
            aliases[f'module.{name}' + ('' if state == 'powered' else '.' + state)] = sid(name, 0, state)
        aliases[f'module.{name}.active'] = sid(name, 0, 'powered')
        for rotation in range(4): aliases[f'module.{name}.r{rotation}.active'] = sid(name, rotation, 'powered')
    for alias, target in aliases.items(): assets[alias] = dict(assets[target])
    pack.save_manifest(out / 'manifest.fragment.json', {**lock['manifestHeader'], 'sheets': sheets, 'assets': assets})
    dump(out / 'integration.json', {'modules': {
        'module.reactor': {'asset': 'module.reactor', 'footprint': [2, 2]},
        'module.lifeSupport': {'asset': 'module.life_support', 'footprint': [1, 2]}},
        'nativeAssetDirectory': 'public/assets/1x', 'aliases': aliases,
        'statePriority': ['destroyed', 'damaged (use flicker frame while off)', 'unpowered', 'powered'],
        'currentMain': {'checkedCommit': lock['currentMainVerified'],
            'healthyRotationsAndUnpoweredSelection': 'Already supported by moduleAssets/stateArt',
            'damage': 'Derelict ruin selection supports state suffixes; explicit live HP/flicker selection remains integration work'},
        'flicker': {'litMs': 340, 'offMs': 170, 'offSuffix': '.damaged.flicker'},
        'contentFootprintChangesRequired': False, 'runtimeEditsMade': False,
        'mergeNote': 'Copy the atlas twins into 1x/sprites and merge the fragment; do not replace the global manifest'})
    dump(out / 'build.json', {'complete': True, 'uniqueFrames': 40, 'manifestEntries': len(assets),
                             'approvedFramesReused': reused, 'newFramesRendered': rendered,
                             'frameSets': sets, 'buildHash': build_hash})
    print('CORE SYSTEMS EXPORT COMPLETE', flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    export(args.out.resolve())
