"""One-angle grey reactor family study; standard render, no live asset edits."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/blender'))


def render(out):
    import bpy
    import numpy as np
    from lib import palette
    from sprites import core, env_build, post
    from sprites import core_systems_blockout as base
    from sprites.core_systems_detail import reactor as small
    from sprites.core_systems_touchups import parameters
    from sprites.reactor_upgrade import TandemReactor, reactor
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
                'stage': 'grey primary geometry / reactor family'}
    (out / 'settings.json').write_text(json.dumps(settings, indent=2) + '\n')
    for name, p, builder in [('reactor-2x2', parameters('reactor'), small),
                              ('reactor-2x3', TandemReactor(), reactor)]:
        audit = []
        for r in range(4):
            core.clear_scene_meshes()
            obs = builder(p, r)
            q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
            q[:, 1] *= -1
            w, h = p.footprint if r % 2 == 0 else p.footprint[::-1]
            lo, hi = q.min(0), q.max(0)
            assert lo[0] >= -w + .5 and hi[0] <= .5, (name, r, lo, hi)
            assert lo[1] >= -h + .5 and hi[1] <= .5, (name, r, lo, hi)
            assert abs(lo[2]) < 1e-6 and hi[2] < 1.85
            audit.append({'rotation': r, 'footprint': [w, h], 'min': lo.tolist(),
                          'max': hi.tolist(), 'size': (hi - lo).tolist()})
        core.clear_scene_meshes()
        obs = builder(p, 0)
        it = env_build.crop_item(name, list(p.footprint), *env_build.render_sprite(name, 'prop', obs))
        assert it is not None and not it['g'].any()
        post.write_png(out / f'{name}.png', it['rgba'])
        meta = {'parameters': p.spec(), 'frameSize': list(it['rgba'].shape[1::-1]),
                'anchor': [int(it['ax']), int(it['ay'])], 'rotationAudit': audit}
        (out / f'{name}.json').write_text(json.dumps(meta, indent=2) + '\n')
        core._set_pass('color')
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'), compress=True)
        print('FAMILY BLOCKOUT COMPLETE', name, meta['frameSize'], flush=True)


def compose(out):
    from PIL import Image, ImageDraw, ImageFont
    bg = (27, 34, 43, 255)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 18)
    small = ImageFont.truetype(font_path, 14)
    for scale, filename in [(2, 'reactor-family.png'), (4, 'reactor-family-zoom.png')]:
        width, height = (780, 450) if scale == 2 else (1190, 700)
        img = Image.new('RGBA', (width, height), bg)
        d = ImageDraw.Draw(img)
        d.text((24, 16), 'REACTOR FAMILY / GREY BLOCKOUT', fill='#dfe5e8', font=font)
        d.text((24, 45), 'Same crown, core diameter and height / shared long casting and coolant housings', fill='#a7b6c0', font=small)
        for i, name in enumerate(('reactor-2x2', 'reactor-2x3')):
            meta = json.loads((out / f'{name}.json').read_text())
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
            sprite = Image.open(out / f'{name}.png').convert('RGBA')
            a = meta['anchor']
            img.alpha_composite(sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST),
                                (round(origin[0] - a[0] * scale), round(origin[1] - a[1] * scale)))
            d.text((int(width * i / 2) + 24, height - 56),
                   'APPROVED 2 x 2 / GREY' if i == 0 else 'NEW 2 x 3 / TANDEM', fill='#dfe5e8', font=font)
            d.text((int(width * i / 2) + 24, height - 29),
                   f"Height {meta['rotationAudit'][0]['max'][2]:.3f} / no floor slab", fill='#a7b6c0', font=small)
        img.save(out / filename)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--compose', action='store_true')
    args = ap.parse_args(argv)
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    compose(out) if args.compose else render(out)


if __name__ == '__main__': main()
