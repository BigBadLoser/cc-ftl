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


def render(out):
    import bpy
    import numpy as np
    from lib import palette
    from sprites import core, env_build, post
    from sprites.core_systems_blockout import PALETTE, Reactor, LifeSupport, reactor, life_support
    assert bpy.app.version[:3] == (4, 2, 9)
    assert (core.TILE_W, core.TILE_H) == (64, 32)
    assert core.SS == 4 and core.SAMPLES == 4 and not core.PREVIEW
    palette._data.update(PALETTE)
    core.setup_scene()
    post.select(False)
    settings = {'blender': bpy.app.version_string, 'nativeTile': [64, 32],
                'gameDisplayScale': 2, 'SS': core.SS, 'samples': core.SAMPLES,
                'cameraEuler': list(core.CAM_ROT), 'sunEnergy': core._state['sun'].data.energy,
                'sunShadows': core._state['sun'].data.use_shadow,
                'stage': 'primary geometry, neutral grey', 'floorSlab': False}
    (out / 'settings.json').write_text(json.dumps(settings, indent=2) + '\n')
    for name, cls, builder in (('reactor', Reactor, reactor), ('life_support', LifeSupport, life_support)):
        p = cls()
        audit = []
        # Audit all physical rotations; render only the first view for review.
        for rotation in range(4):
            core.clear_scene_meshes()
            obs = builder(p, rotation)
            q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
            q[:, 1] *= -1  # Blender back to grid axes
            w, h = p.footprint if rotation % 2 == 0 else p.footprint[::-1]
            lo, hi = q.min(0), q.max(0)
            assert lo[0] >= -w + .5 and hi[0] <= .5
            assert lo[1] >= -h + .5 and hi[1] <= .5
            assert lo[2] >= 0 and hi[2] < 1.85
            audit.append({'rotation': rotation, 'footprint': [w, h], 'min': lo.tolist(),
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
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'))
        print('BLOCKOUT COMPLETE', name, meta['frameSize'], flush=True)


def compose(out):
    from PIL import Image, ImageDraw, ImageFont
    root = ROOT / 'public/assets/1x'
    manifest = json.loads((root / 'manifest.json').read_text())
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
    d.text((22, 14), 'DROP-IN MODULES / GEOMETRY PASS 1', font=font, fill='#dfe5e8')
    d.text((22, 41), 'Current shipped art vs grey proposal / same game scale', font=small, fill='#a7b6c0')
    d.text((42, 75), 'CURRENT', font=small, fill='#a7b6c0')
    d.text((390, 75), 'NEW BLOCKOUT', font=small, fill='#a7b6c0')
    lineup = Image.new('RGBA', (1050, 620), bg)
    dl = ImageDraw.Draw(lineup)
    dl.text((24, 16), 'REACTOR 2 x 2', font=font, fill='#dfe5e8')
    dl.text((540, 16), 'LIFE SUPPORT 1 x 2', font=font, fill='#dfe5e8')
    dl.text((24, 46), 'Grey geometry / 2x game zoom / current module camera and lighting', font=small, fill='#a7b6c0')
    for index, name in enumerate(('reactor', 'life_support')):
        meta = json.loads((out / f'{name}.json').read_text())
        proposed = Image.open(out / f'{name}.png').convert('RGBA')
        asset = manifest['assets']['module.' + name]
        sheet = Image.open(root / manifest['sheets'][asset['sheet']]['image']).convert('RGBA')
        f = asset['frame']
        current = sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        cy = 310 + index * 290
        for cx in (190, 540): grid(comparison, (cx, cy), meta['parameters']['footprint'], 2)
        paste(comparison, current, (asset['anchor']['x'], asset['anchor']['y']), (190, cy), 2)
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
    comparison.save(out / 'current-vs-blockout.png')
    lineup.save(out / 'blockouts-zoom.png')


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
