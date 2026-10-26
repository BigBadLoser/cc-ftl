"""One-angle damage-state review; no atlas build or runtime integration."""
import argparse
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
    from sprites.core_systems_blockout import PALETTE
    from sprites.core_systems_finish import PALETTE as FINISH
    from sprites.core_systems_touchups import parameters
    from sprites.core_systems_damage import build, STATES
    assert bpy.app.version[:3] == (4, 2, 9)
    assert (core.TILE_W, core.TILE_H, core.SS, core.SAMPLES) == (64, 32, 4, 4)
    assert not core.PREVIEW
    palette._data.update(PALETTE)
    palette._data.update(FINISH)
    core.setup_scene()
    post.select(False)
    report = {'stage': 'damage preview r0', 'SS': 4, 'samples': 4,
              'nativeTile': [64, 32], 'blender': bpy.app.version_string, 'frames': {}}
    frames = out / 'frames'
    frames.mkdir(exist_ok=True)
    for name in NAMES:
        p = parameters(name)
        for state in STATES:
            core.clear_scene_meshes()
            obs = build(name, state)
            q = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in obs])
            q[:, 1] *= -1
            lo, hi = q.min(0), q.max(0)
            w, h = p.footprint
            in_footprint = bool(lo[0] >= -w + .5 and hi[0] <= .5 and
                                lo[1] >= -h + .5 and hi[1] <= .5)
            assert in_footprint
            assert lo[2] >= 0 and hi[2] < 1.85
            sid = f'{name}.r0.{state}'
            if state != 'damaged': assert not core._glows()
            it = env_build.crop_item(sid, list(p.footprint), *env_build.render_sprite(sid, 'prop', obs))
            assert it is not None
            if state != 'damaged': assert not it['g'].any()
            post.write_png(frames / f'{sid}.png', it['rgba'])
            post.write_png(frames / f'{sid}.glow.png', it['g'])
            record = {'name': name, 'state': state, 'rotation': 0,
                      'frameSize': list(it['rgba'].shape[1::-1]),
                      'anchor': [int(it['ax']), int(it['ay'])],
                      'footprint': list(p.footprint), 'bounds': [lo.tolist(), hi.tolist()],
                      'withinFootprint': in_footprint,
                      'wreckInsetFactor': obs[0].get('wreckInsetFactor'),
                      'dentDepthFactor': obs[0].get('dentDepthFactor'),
                      'tuckedDamageAttachments': obs[0].get('tuckedDamageAttachments', 0),
                      'glowPixels': int(np.count_nonzero(it['g'][..., 3]))}
            report['frames'][sid] = record
            print('DAMAGE REVIEW', sid, record, flush=True)
    (out / 'review.json').write_text(json.dumps(report, indent=2) + '\n')


def compose(out):
    from PIL import Image, ImageDraw, ImageFont
    report = json.loads((out / 'review.json').read_text())
    healthy = ROOT / 'artifacts/core-systems-v5'
    bg = (27, 34, 43, 255)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    sheet = Image.new('RGBA', (1080, 665), bg)
    d = ImageDraw.Draw(sheet)
    d.text((20, 12), 'CORE SYSTEMS / DAMAGE STUDY / r0', font=font, fill='#dfe5e8')
    d.text((20, 39), 'Normal game display / standard renderer / same tile anchors', font=small, fill='#a7b6c0')
    states = ('healthy', 'damaged', 'damaged.flicker', 'destroyed')
    labels = ('APPROVED HEALTHY', 'DAMAGED', 'FLICKER: LIGHTS OFF', 'DESTROYED')
    for col, label in enumerate(labels):
        d.text((col * 270 + 20, 77), label, font=small, fill='#a7b6c0')
    for row, name in enumerate(NAMES):
        for col, state in enumerate(states):
            if state == 'healthy':
                meta = json.loads((healthy / f'{name}.json').read_text())
                fp = meta['parameters']['footprint']
                sprite = Image.open(healthy / f'{name}.png').convert('RGBA')
            else:
                sid = f'{name}.r0.{state}'
                meta = report['frames'][sid]
                fp = meta['footprint']
                sprite = Image.open(out / 'frames' / f'{sid}.png').convert('RGBA')
            w, h = fp
            cx, cy = col * 270 + 135, 287 + row * 295
            ox, oy = cx + 32 * (w - h), cy + 16 * (w + h - 2)
            def pt(x, y): return (round(ox + (x - y) * 64), round(oy + (x + y) * 32))
            for x in range(w + 1):
                d.line([pt(x - w + .5, -h + .5), pt(x - w + .5, .5)], fill='#53616a')
            for y in range(h + 1):
                d.line([pt(-w + .5, y - h + .5), pt(.5, y - h + .5)], fill='#53616a')
            ax, ay = meta['anchor']
            sprite = sprite.resize((sprite.width * 2, sprite.height * 2), Image.Resampling.NEAREST)
            sheet.alpha_composite(sprite, (round(ox - ax * 2), round(oy - ay * 2)))
    sheet.save(out / 'damage-review.png')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--compose', action='store_true')
    args = ap.parse_args(argv)
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    compose(out) if args.compose else render(out)


if __name__ == '__main__': main()
