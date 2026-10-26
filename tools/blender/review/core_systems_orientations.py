"""Review approved core-system models in four orientations and two power states.

One Blender process, standard settings, isolated frames only; no live atlas build.
Run with --out artifacts/core-systems-orientations, then host Python --compose.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/blender'))
NAMES = ('reactor', 'life_support')


def render(out):
    import bpy
    import numpy as np
    from lib import palette
    from sprites import core, env_build, post
    from sprites import core_systems_blockout as base, core_systems_detail as model
    from sprites.core_systems_finish import PALETTE
    from sprites.core_systems_touchups import parameters
    assert bpy.app.version[:3] == (4, 2, 9)
    assert (core.TILE_W, core.TILE_H, core.SS, core.SAMPLES) == (64, 32, 4, 4)
    assert not core.PREVIEW
    palette._data.update(base.PALETTE)
    palette._data.update(PALETTE)
    core.setup_scene()
    post.select(False)

    def digest(obs):
        h = hashlib.sha256()
        for ob in obs:
            h.update(np.asarray([v.co[:] for v in ob.data.vertices], dtype=np.float32).tobytes())
            for face in ob.data.polygons:
                h.update(np.asarray(face.vertices[:], dtype=np.int32).tobytes())
        return h.hexdigest()

    report = {'nativeTile': [64, 32], 'displayScale': 2, 'SS': core.SS,
              'samples': core.SAMPLES, 'blender': bpy.app.version_string,
              'sunEnergy': core._state['sun'].data.energy,
              'sunShadows': core._state['sun'].data.use_shadow,
              'cameraEuler': list(core.CAM_ROT), 'frames': {}, 'approvedR0PixelIdentical': {}}
    frames = out / 'frames'
    frames.mkdir(exist_ok=True)
    for name in NAMES:
        p = parameters(name)
        approved = ROOT / 'artifacts/core-systems-v5'
        meta = json.loads((approved / f'{name}.json').read_text())
        for rotation in range(4):
            w, h = p.footprint if rotation % 2 == 0 else p.footprint[::-1]
            pair = []
            for powered in (True, False):
                core.clear_scene_meshes()
                obs = getattr(model, name)(p, rotation, finished=True, powered=powered)
                dg = digest(obs)
                assert dg == meta['rotationAudit'][rotation]['geometryDigest']
                q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
                q[:, 1] *= -1
                lo, hi = q.min(0), q.max(0)
                assert lo[0] >= -w + .5 and hi[0] <= .5
                assert lo[1] >= -h + .5 and hi[1] <= .5
                assert lo[2] == 0 and hi[2] < 1.85
                if not powered: assert not core._glows()
                state = 'powered' if powered else 'unpowered'
                sid = f'{name}.r{rotation}.{state}'
                it = env_build.crop_item(sid, [w, h], *env_build.render_sprite(sid, 'prop', obs))
                assert it is not None
                if not powered: assert not it['g'].any()
                post.write_png(frames / f'{sid}.png', it['rgba'])
                post.write_png(frames / f'{sid}.glow.png', it['g'])
                record = {'name': name, 'rotation': rotation, 'state': state,
                          'frameSize': list(it['rgba'].shape[1::-1]),
                          'anchor': [int(it['ax']), int(it['ay'])], 'footprint': [w, h],
                          'geometryDigest': dg, 'approvedGeometryExact': True,
                          'glowPixels': int(np.count_nonzero(it['g'][..., 3]))}
                report['frames'][sid] = record
                pair.append((record, it['rgba']))
                if rotation == 0 and powered:
                    # Same renderer and quality must reproduce the signed-off view.
                    from sprites.pack import read_png
                    assert np.array_equal(it['rgba'], read_png(approved / f'{name}.png'))
                    assert np.array_equal(it['g'], read_png(approved / f'{name}.glow.png'))
                    assert record['anchor'] == meta['anchor']
                    report['approvedR0PixelIdentical'][name] = True
                print('REVIEW FRAME', sid, record['frameSize'], record['glowPixels'], flush=True)
            assert pair[0][0]['anchor'] == pair[1][0]['anchor']
            assert pair[0][0]['frameSize'] == pair[1][0]['frameSize']
            assert np.array_equal(pair[0][1][..., 3], pair[1][1][..., 3])
    (out / 'review.json').write_text(json.dumps(report, indent=2) + '\n')


def compose(out):
    from PIL import Image, ImageDraw, ImageFont
    info = json.loads((out / 'review.json').read_text())
    bg = (27, 34, 43, 255)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)

    def draw_frame(sheet, key, cx, cy, scale=2):
        rec = info['frames'][key]
        w, h = rec['footprint']
        origin = (cx + 16 * (w - h) * scale, cy + 8 * (w + h - 2) * scale)
        d = ImageDraw.Draw(sheet)
        def pt(x, y):
            return (round(origin[0] + (x - y) * 32 * scale),
                    round(origin[1] + (x + y) * 16 * scale))
        for x in range(w + 1):
            d.line([pt(x - w + .5, -h + .5), pt(x - w + .5, .5)], fill='#53616a')
        for y in range(h + 1):
            d.line([pt(-w + .5, y - h + .5), pt(.5, y - h + .5)], fill='#53616a')
        sprite = Image.open(out / 'frames' / f'{key}.png').convert('RGBA')
        sprite = sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST)
        ax, ay = rec['anchor']
        sheet.alpha_composite(sprite, (round(origin[0] - ax * scale), round(origin[1] - ay * scale)))

    for state in ('powered', 'unpowered'):
        sheet = Image.new('RGBA', (1080, 680), bg)
        d = ImageDraw.Draw(sheet)
        d.text((20, 12), f'CORE SYSTEMS / FOUR ORIENTATIONS / {state.upper()}', font=font, fill='#dfe5e8')
        d.text((20, 39), 'Normal game display: native 64x32 art at 2x / approved geometry and materials', font=small, fill='#a7b6c0')
        for row, name in enumerate(NAMES):
            top = 67 + row * 300
            d.text((20, top), 'REACTOR 2 x 2' if row == 0 else 'LIFE SUPPORT 1 x 2', font=small, fill='#a7b6c0')
            for r in range(4):
                d.text((r * 270 + 124, top + 25), f'r{r}', font=small, fill='#a7b6c0')
                draw_frame(sheet, f'{name}.r{r}.{state}', r * 270 + 135, top + 210)
        sheet.save(out / f'orientations-{state}.png')
    states = Image.new('RGBA', (650, 660), bg)
    d = ImageDraw.Draw(states)
    d.text((20, 14), 'POWER STATE REVIEW / r0', font=font, fill='#dfe5e8')
    d.text((20, 42), 'Same geometry, anchors and game display scale', font=small, fill='#a7b6c0')
    for col, state in enumerate(('powered', 'unpowered')):
        d.text((col * 325 + 34, 77), state.upper(), font=small, fill='#a7b6c0')
        for row, name in enumerate(NAMES):
            draw_frame(states, f'{name}.r0.{state}', col * 325 + 162, 290 + row * 290)
    states.save(out / 'power-states.png')


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
