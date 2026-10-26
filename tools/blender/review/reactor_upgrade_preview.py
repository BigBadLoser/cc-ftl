"""One-angle grey reactor family study; standard render, no live asset edits."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/blender'))


def render(out, detailed=False):
    import bpy
    import numpy as np
    from lib import palette
    from sprites import core, env_build, post
    from sprites import core_systems_blockout as base
    from sprites.core_systems_detail import reactor as small
    from sprites.core_systems_touchups import parameters
    from sprites.reactor_upgrade import TandemReactor, reactor
    original = reactor
    if detailed:
        from sprites.reactor_upgrade_detail import reactor

    def digest(obs):
        h = hashlib.sha256()
        for ob in obs:
            h.update(np.asarray([v.co[:] for v in ob.data.vertices], dtype=np.float32).tobytes())
            for face in ob.data.polygons:
                h.update(np.asarray(face.vertices[:], dtype=np.int32).tobytes())
        return h.hexdigest()
    assert bpy.app.version[:3] == (4, 2, 9)
    assert (core.TILE_W, core.TILE_H, core.SS, core.SAMPLES) == (64, 32, 4, 4)
    assert not core.PREVIEW
    lock = json.loads((ROOT / 'tools/blender/core_systems_approved.json').read_text())
    for path, sha in lock['files'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha, path
    palette._data.update(base.PALETTE)
    core.setup_scene()
    post.select(False)
    settings = {'blender': bpy.app.version_string, 'nativeTile': [64, 32],
                'gameDisplayScale': 2, 'SS': core.SS, 'samples': core.SAMPLES,
                'cameraEuler': list(core.CAM_ROT), 'floorSlab': False,
                'sunShadows': core._state['sun'].data.use_shadow,
                'approvedSourcesAndReferencesUnchanged': True,
                'stage': 'grey shared mechanical detail' if detailed else 'grey primary geometry / reactor family'}
    (out / 'settings.json').write_text(json.dumps(settings, indent=2) + '\n')
    for name, p, builder in [('reactor-2x2', parameters('reactor'), small),
                              ('reactor-2x3', TandemReactor(), reactor)]:
        if detailed and name == 'reactor-2x2':
            import shutil
            for suffix in ('.png', '.json', '.blend'):
                shutil.copy2(ROOT / 'artifacts/reactor-upgrade-v1' / (name + suffix), out / (name + suffix))
            continue
        audit = []
        for r in range(4):
            core.clear_scene_meshes()
            if detailed:
                approved_digest = digest(original(p, r))
                core.clear_scene_meshes()
            obs = builder(p, r)
            if detailed: assert digest(obs[:1]) == approved_digest
            q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
            q[:, 1] *= -1
            w, h = p.footprint if r % 2 == 0 else p.footprint[::-1]
            lo, hi = q.min(0), q.max(0)
            assert lo[0] >= -w + .5 and hi[0] <= .5, (name, r, lo, hi)
            assert lo[1] >= -h + .5 and hi[1] <= .5, (name, r, lo, hi)
            assert abs(lo[2]) < 1e-6 and hi[2] < 1.85
            audit.append({'rotation': r, 'footprint': [w, h], 'min': lo.tolist(),
                          'max': hi.tolist(), 'size': (hi - lo).tolist(),
                          'blockoutPreserved': True if detailed else None})
        core.clear_scene_meshes()
        obs = builder(p, 0)
        if detailed:
            # Check the actual saved v1 mesh as well as the current builder.
            approved = ROOT / 'artifacts/reactor-upgrade-v1/reactor-2x3.blend'
            with bpy.data.libraries.load(str(approved), link=False) as (src, dst):
                dst.objects = ['reactor_tandem_blockout']
            assert digest(dst.objects) == digest(obs[:1])
            for ob in dst.objects:
                me = ob.data
                bpy.data.objects.remove(ob)
                bpy.data.meshes.remove(me)
        it = env_build.crop_item(name, list(p.footprint), *env_build.render_sprite(name, 'prop', obs))
        assert it is not None and not it['g'].any()
        post.write_png(out / f'{name}.png', it['rgba'])
        meta = {'parameters': p.spec(), 'frameSize': list(it['rgba'].shape[1::-1]),
                'anchor': [int(it['ax']), int(it['ay'])], 'rotationAudit': audit}
        (out / f'{name}.json').write_text(json.dumps(meta, indent=2) + '\n')
        core._set_pass('color')
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'), compress=True)
        print('FAMILY BLOCKOUT COMPLETE', name, meta['frameSize'], flush=True)


def compose(out, baseline=None):
    from PIL import Image, ImageDraw, ImageFont
    bg = (27, 34, 43, 255)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 18)
    small = ImageFont.truetype(font_path, 14)
    detail = json.loads((out / 'settings.json').read_text())['stage'] == 'grey shared mechanical detail'
    for scale, filename in [(2, 'reactor-family.png'), (4, 'reactor-family-zoom.png')]:
        width, height = (780, 450) if scale == 2 else (1190, 700)
        img = Image.new('RGBA', (width, height), bg)
        d = ImageDraw.Draw(img)
        d.text((24, 16), 'REACTOR / SHARED MECHANICAL DETAIL' if detail else 'REACTOR FAMILY / GREY BLOCKOUT', fill='#dfe5e8', font=font)
        d.text((24, 45), 'Common pressure coupling, shoulder yoke, coolant header and controls' if detail else 'Same crown, core diameter and height / shared long casting and coolant housings', fill='#a7b6c0', font=small)
        for i, name in enumerate(('reactor-2x2', 'reactor-2x3')):
            source = baseline if baseline and i == 0 else out
            if baseline: name = 'reactor-2x3'
            meta = json.loads((source / f'{name}.json').read_text())
            w, h = meta['parameters']['footprint']
            # Place footprint centres side by side, aligned in screen/deck space.
            centre = (width * (.25 if i == 0 else .75), height * .70)
            origin = (centre[0] + (w - h) * 16 * scale,
                      centre[1] + (w + h - 2) * 8 * scale)
            def pt(x, y):
                return (round(origin[0] + (x - y) * 32 * scale),
                        round(origin[1] + (x + y) * 16 * scale))
            for x in range(w + 1):
                d.line([pt(x - w + .5, -h + .5), pt(x - w + .5, .5)], fill='#45545f')
            for y in range(h + 1):
                d.line([pt(-w + .5, y - h + .5), pt(.5, y - h + .5)], fill='#45545f')
            sprite = Image.open(source / f'{name}.png').convert('RGBA')
            a = meta['anchor']
            img.alpha_composite(sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST),
                                (round(origin[0] - a[0] * scale), round(origin[1] - a[1] * scale)))
            d.text((int(width * i / 2) + 24, height - 56),
                   ('PREVIOUS BLOCKOUT' if baseline else 'APPROVED 2 x 2 / GREY') if i == 0 else ('SHARED MECHANICAL PASS' if detail else 'NEW 2 x 3 / TANDEM'), fill='#dfe5e8', font=font)
            d.text((int(width * i / 2) + 24, height - 29),
                   f"Height {meta['rotationAudit'][0]['max'][2]:.3f} / no floor slab", fill='#a7b6c0', font=small)
        img.save(out / (filename.replace('reactor-family', 'blockout-vs-detail') if baseline else filename))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--compose', action='store_true')
    ap.add_argument('--detailed', action='store_true')
    ap.add_argument('--baseline', type=Path)
    args = ap.parse_args(argv)
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    compose(out, args.baseline) if args.compose else render(out, args.detailed)


if __name__ == '__main__': main()
