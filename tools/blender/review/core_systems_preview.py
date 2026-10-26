"""Two quick standard-pipeline blockouts; never writes the live game asset set.

blender -b -t 2 --factory-startup --python-exit-code 1 --python \
 tools/blender/review/core_systems_preview.py -- --out artifacts/core-systems-v1
python3 tools/blender/review/core_systems_preview.py --out artifacts/core-systems-v1 --compose
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/blender'))


def render(out, detailed=False, finished=False, touchups=False):
    import hashlib
    import bpy
    import numpy as np
    from lib import palette
    from sprites import core, env_build, post
    from sprites.core_systems_blockout import PALETTE, Reactor, LifeSupport, reactor, life_support
    original_builders = {'reactor': reactor, 'life_support': life_support}
    if detailed or finished:
        from sprites.core_systems_detail import reactor, life_support
    from sprites.core_systems_finish import PALETTE as FINISH_PALETTE

    def original_digest(obs):
        from sprites.geom_digest import _mesh
        digest = hashlib.sha256()
        for ob in obs: _mesh(ob, digest)
        return digest.hexdigest()

    def geometry_digest(obs):
        digest = hashlib.sha256()
        for ob in obs:
            me = getattr(ob, 'data', ob)
            digest.update(np.asarray([v.co[:] for v in me.vertices], dtype=np.float32).tobytes())
            for face in me.polygons:
                digest.update(np.asarray(face.vertices[:], dtype=np.int32).tobytes())
        return digest.hexdigest()
    assert bpy.app.version[:3] == (4, 2, 9)
    assert (core.TILE_W, core.TILE_H) == (64, 32)
    assert core.SS == 4 and core.SAMPLES == 4 and not core.PREVIEW
    palette._data.update(PALETTE)
    palette._data.update(FINISH_PALETTE)
    core.setup_scene()
    post.select(False)
    settings = {'blender': bpy.app.version_string, 'nativeTile': [64, 32],
                'gameDisplayScale': 2, 'SS': core.SS, 'samples': core.SAMPLES,
                'cameraEuler': list(core.CAM_ROT), 'sunEnergy': core._state['sun'].data.energy,
                'sunShadows': core._state['sun'].data.use_shadow,
                'stage': 'material and lighting preview' if finished else ('mechanical geometry, neutral grey' if detailed else 'primary geometry, neutral grey'),
                'floorSlab': False, 'strutVentTouchups': touchups}
    (out / 'settings.json').write_text(json.dumps(settings, indent=2) + '\n')
    for name, cls, builder in (('reactor', Reactor, reactor), ('life_support', LifeSupport, life_support)):
        if touchups:
            from sprites.core_systems_touchups import parameters
            p = parameters(name)
        else:
            p = cls()
        targeted_audit = None
        audit = []
        # Audit all physical rotations; render only the first view for review.
        for rotation in range(4):
            core.clear_scene_meshes()
            original = original_builders[name](p, rotation)
            digest = original_digest(original)
            base_geometry = geometry_digest(original)
            original_count = len(original)
            core.clear_scene_meshes()
            obs = builder(p, rotation)
            assert original_digest(obs[:original_count]) == digest
            full_geometry = geometry_digest(obs)
            if finished:
                core.clear_scene_meshes()
                obs = builder(p, rotation, finished=True)
                assert geometry_digest(obs) == full_geometry
            assert geometry_digest(obs[:original_count]) == base_geometry
            q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
            q[:, 1] *= -1  # Blender back to grid axes
            w, h = p.footprint if rotation % 2 == 0 else p.footprint[::-1]
            lo, hi = q.min(0), q.max(0)
            assert lo[0] >= -w + .5 and hi[0] <= .5
            assert lo[1] >= -h + .5 and hi[1] <= .5
            assert lo[2] >= 0 and hi[2] < 1.85
            audit.append({'rotation': rotation, 'footprint': [w, h], 'min': lo.tolist(),
                          'max': hi.tolist(), 'size': (hi - lo).tolist(),
                          'approvedBaseUnchanged': True, 'approvedBaseDigest': digest})
            audit[-1].update({'approvedGeometryUnchanged': True, 'geometryDigest': full_geometry})
        core.clear_scene_meshes()
        if finished:
            builder(p, 0, finished=True, powered=False)
            assert not core._glows(), 'Unpowered machine must emit no glow'
            core.clear_scene_meshes()
        obs = builder(p, 0, finished=finished)
        if finished:
            # Independently compare against the saved, approved mechanical model.
            approved = ROOT / 'artifacts/core-systems-v2' / f'{name}.blend'
            names = [ob.data.name for ob in obs]
            with bpy.data.libraries.load(str(approved), link=False) as (source, target):
                assert all(n in source.meshes for n in names)
                target.meshes = names
            if touchups:
                from sprites.core_systems_touchups import audit as touchup_audit
                targeted_audit = touchup_audit(name, target.meshes, obs)
            else:
                assert geometry_digest(target.meshes) == geometry_digest(obs)
            for me in target.meshes: bpy.data.meshes.remove(me)
        it = env_build.crop_item(name, list(p.footprint), *env_build.render_sprite(name, 'prop', obs))
        assert it is not None
        assert bool(it['g'].any()) == finished
        post.write_png(out / f'{name}.png', it['rgba'])
        if finished: post.write_png(out / f'{name}.glow.png', it['g'])
        meta = {'parameters': p.spec(), 'frameSize': list(it['rgba'].shape[1::-1]),
                'anchor': [int(it['ax']), int(it['ay'])], 'rotationAudit': audit,
                'geometryPreserved': not touchups, 'targetedGeometryAudit': targeted_audit,
                'approvedMechanicalFileVerified': finished,
                'glowPixels': int(np.count_nonzero(it['g'][..., 3])),
                'unpoweredGlowZero': True if finished else None}
        (out / f'{name}.json').write_text(json.dumps(meta, indent=2) + '\n')
        core._set_pass('color')
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'))
        print('BLOCKOUT COMPLETE', name, meta['frameSize'], flush=True)


def compose(out, baseline=None):
    from PIL import Image, ImageDraw, ImageFont
    root = ROOT / 'public/assets/1x'
    manifest = json.loads((root / 'manifest.json').read_text())
    settings = json.loads((out / 'settings.json').read_text())
    finished = settings['stage'] == 'material and lighting preview'
    touchups = settings.get('strutVentTouchups', False)
    bg = (27, 34, 43, 255)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
        small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    except OSError:
        font = small = ImageFont.load_default()

    def grid(img, origin, footprint, scale):
        d = ImageDraw.Draw(img)
        def pt(x, y):
            return (round(origin[0] + (x - y) * 32 * scale),
                    round(origin[1] + (x + y) * 16 * scale))
        w, h = footprint
        for x in range(w + 1):
            d.line([pt(x - w + .5, -h + .5), pt(x - w + .5, .5)], fill='#53616a', width=1)
        for y in range(h + 1):
            d.line([pt(-w + .5, y - h + .5), pt(.5, y - h + .5)], fill='#53616a', width=1)

    def paste(img, sprite, anchor, origin, scale):
        sprite = sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST)
        img.alpha_composite(sprite, (round(origin[0] - anchor[0] * scale),
                                     round(origin[1] - anchor[1] * scale)))

    comparison = Image.new('RGBA', (700, 650), bg)
    d = ImageDraw.Draw(comparison)
    title = 'DROP-IN MODULES / MECHANICAL PASS' if baseline else 'DROP-IN MODULES / GEOMETRY PASS 1'
    if finished: title = 'DROP-IN MODULES / MATERIAL PASS'
    if touchups: title = 'DROP-IN MODULES / STRUT AND VENT CLEANUP'
    d.text((22, 14), title, font=font, fill='#dfe5e8')
    subtitle = 'Approved blockout vs mechanical pass / same game scale' if baseline else 'Current shipped art vs grey proposal / same game scale'
    if finished: subtitle = 'Approved mechanical model vs material preview / same game scale'
    if touchups: subtitle = 'Previous material preview vs corrections / same game scale'
    d.text((22, 41), subtitle, font=small, fill='#a7b6c0')
    d.text((42, 75), 'PREVIOUS PREVIEW' if touchups else ('APPROVED GREY' if finished else ('APPROVED BLOCKOUT' if baseline else 'CURRENT')), font=small, fill='#a7b6c0')
    d.text((390, 75), 'STRUTS / VENTS' if touchups else ('MATERIAL PREVIEW' if finished else ('MECHANICAL PASS' if baseline else 'NEW BLOCKOUT')), font=small, fill='#a7b6c0')
    lineup = Image.new('RGBA', (1050, 620), bg)
    dl = ImageDraw.Draw(lineup)
    dl.text((24, 16), 'REACTOR 2 x 2', font=font, fill='#dfe5e8')
    dl.text((540, 16), 'LIFE SUPPORT 1 x 2', font=font, fill='#dfe5e8')
    dl.text((24, 46), ('Material preview' if finished else 'Grey geometry') + ' / 2x game zoom / current module camera and lighting', font=small, fill='#a7b6c0')
    for index, name in enumerate(('reactor', 'life_support')):
        meta = json.loads((out / f'{name}.json').read_text())
        proposed = Image.open(out / f'{name}.png').convert('RGBA')
        asset = manifest['assets']['module.' + name]
        sheet = Image.open(root / manifest['sheets'][asset['sheet']]['image']).convert('RGBA')
        f = asset['frame']
        current = sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        old_anchor = (asset['anchor']['x'], asset['anchor']['y'])
        if baseline:
            current = Image.open(baseline / f'{name}.png').convert('RGBA')
            old_anchor = json.loads((baseline / f'{name}.json').read_text())['anchor']
        cy = 310 + index * 290
        for cx in (190, 540): grid(comparison, (cx, cy), meta['parameters']['footprint'], 2)
        paste(comparison, current, old_anchor, (190, cy), 2)
        paste(comparison, proposed, meta['anchor'], (540, cy), 2)
        label = 'REACTOR / 2 x 2' if index == 0 else 'LIFE SUPPORT / 1 x 2'
        d.text((24, cy + 37), label, font=small, fill='#a7b6c0')
        lx = 300 if index == 0 else 765
        grid(lineup, (lx, 475), meta['parameters']['footprint'], 4)
        paste(lineup, proposed, meta['anchor'], (lx, 475), 4)
        dimensions = meta['rotationAudit'][0]['size']
        dl.text((index * 515 + 24, 570),
                f"Body {dimensions[0]:.2f} x {dimensions[1]:.2f}, height {dimensions[2]:.2f}",
                font=small, fill='#a7b6c0')
    comparison.save(out / ('before-vs-touchups.png' if touchups else ('grey-vs-materials.png' if finished else ('blockout-vs-detail.png' if baseline else 'current-vs-blockout.png'))))
    lineup.save(out / ('touchups-zoom.png' if touchups else ('materials-zoom.png' if finished else 'blockouts-zoom.png')))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--compose', action='store_true')
    ap.add_argument('--detailed', action='store_true')
    ap.add_argument('--finished', action='store_true')
    ap.add_argument('--touchups', action='store_true')
    ap.add_argument('--baseline', type=Path)
    args = ap.parse_args(argv)
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    compose(out, args.baseline) if args.compose else render(out, args.detailed, args.finished or args.touchups, args.touchups)


if __name__ == '__main__': main()
