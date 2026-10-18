"""Compare unchanged 2.4 assets with the 1.85 wall / 2.05 roof variant."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
BG = (12, 17, 25, 255)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('out', type=Path)
    a = p.parse_args()
    font = ImageFont.load_default(size=13)
    sheet = Image.new('RGBA', (800, 1030), BG)
    d = ImageDraw.Draw(sheet)
    for x, text in ((14, 'PRESERVED / WALL + ROOF 2.4'),
                    (414, 'VARIANT / WALL 1.85 / ROOF 2.05')):
        d.text((x, 12), text, font=font, fill=(223, 231, 242))
    rows = [
        (ROOT/'artifacts/ai-core-oracle/final/core-r0-review-1x.png',
         a.out/'ai-core/core-r0-review-1x.png'),
        (ROOT/'artifacts/shield-bastion/hex-clearance/large-review-1x.png',
         a.out/'shields/large-review-1x.png'),
        (ROOT/'artifacts/shield-bastion/hex-clearance/small-review-1x.png',
         a.out/'shields/small-review-1x.png'),
    ]
    for row, paths in enumerate(rows):
        for col, path in enumerate(paths):
            pair = Image.open(path).convert('RGBA')
            im = pair.crop((pair.width//2, 0, pair.width, pair.height))
            # Both scenes retain the production crew and 64x32 floor tiles.
            # Align their floor-origin pixel rather than resizing the assets.
            dx, dy = (30, 48) if row == 0 else (0, 0)
            sheet.paste(im, (col*400+dx, 40+row*330+dy))
    sheet.save(a.out/'height-comparison-1x.png')
    sheet.resize((sheet.width*3, sheet.height*3), Image.Resampling.NEAREST).save(a.out/'height-comparison-3x.png')
    beauty = Image.new('RGBA', (1800, 610), BG)
    d = ImageDraw.Draw(beauty)
    for i, (name, path) in enumerate((
        ('ORACLE / AI CORE', a.out/'ai-core/blender-active.png'),
        ('BASTION / SHIELD', a.out/'shields/blender-large.png'),
        ('WARD / SMALL SHIELD', a.out/'shields/blender-small.png'),
    )):
        im = Image.open(path).convert('RGBA')
        beauty.paste(im.resize((600, 545), Image.Resampling.LANCZOS), (i*600, 65))
        d.text((i*600+18, 14), name, font=ImageFont.load_default(size=20), fill=(223, 231, 242))
        d.text((i*600+18, 40), 'WALL 1.85 / ROOF 2.05', font=font, fill=(137, 160, 183))
    beauty.save(a.out/'blender-overview.png')
    validate_pixels(a.out)


def validate_pixels(out):
    counts = {}
    for folder, expected in (('ai-core', 10), ('shields', 20)):
        directory = out/folder
        man = json.loads((directory/'manifest.fragment.json').read_text())
        assert len(man['assets']) == expected
        counts[folder] = expected
        for sid, asset in man['assets'].items():
            assert sid.startswith(('module.', 'roof.'))
            image = np.array(Image.open(directory/man['sheets'][sid]['image']))
            assert set(np.unique(image[..., 3])) <= {0, 255}
            assert image.shape[:2] == (asset['frame']['h'], asset['frame']['w'])
            assert all(isinstance(v, int) for v in asset['anchor'].values())
        roots = ['ai_core'] if folder == 'ai-core' else ['shield_gen', 'shield_gen_small']
        for root in roots:
            for suffix in ('.png', '.glow.png'):
                assert (directory/f'sprites/roof.{root}.deploy.f4{suffix}').read_bytes() == (directory/f'sprites/roof.{root}.active{suffix}').read_bytes()
        for path in directory.glob('*-1x.png'):
            image = np.array(Image.open(path))
            zoom = np.array(Image.open(path.with_name(path.name.replace('-1x', '-3x'))))
            assert np.array_equal(zoom, image.repeat(3, 0).repeat(3, 1))
    # Inactive AI has no graph or lights; magenta casing is real paint.
    ai = np.array(Image.open(out/'ai-core/sprites/module.ai_core.r0.glow.png'))
    assert not ai[..., 3].any()
    report = {'status': 'PASS', 'productionSprites': counts,
              'alpha': 'binary', 'zoom': 'exact nearest-neighbour 3x',
              'anchors': 'integer, world-origin based',
              'idleAI': 'blank, no glow', 'fullyDeployedEqualsActive': True}
    (out/'pixel-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
