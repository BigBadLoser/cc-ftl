"""Build final review images from the atlases and a portable, checked handoff ZIP."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from validate_core_systems import validate

ROOT = Path(__file__).resolve().parents[2]
NAMES = ('reactor', 'life_support')
BG = (27, 34, 43, 255)


def dump(path, value): path.write_text(json.dumps(value, indent=2) + '\n')


def reviews(package):
    data = package / '1x'; out = package / 'review'; out.mkdir(exist_ok=True)
    m = json.loads((data / 'manifest.fragment.json').read_text())
    atlases = {k: Image.open(data / v['image']).convert('RGBA') for k, v in m['sheets'].items()}
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)

    def draw(image, name, rotation, state, cx, cy, scale=2):
        key = f'module.{name}.r{rotation}' + ('' if state == 'powered' else '.' + state)
        asset = m['assets'][key]; f = asset['frame']; w, h = asset['footprint']
        ox, oy = cx + 16 * (w - h) * scale, cy + 8 * (w + h - 2) * scale
        d = ImageDraw.Draw(image)
        def pt(x, y): return (round(ox + (x - y) * 32 * scale), round(oy + (x + y) * 16 * scale))
        for x in range(w + 1): d.line([pt(x - w + .5, -h + .5), pt(x - w + .5, .5)], fill='#53616a')
        for y in range(h + 1): d.line([pt(-w + .5, y - h + .5), pt(.5, y - h + .5)], fill='#53616a')
        sprite = atlases[asset['sheet']].crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        sprite = sprite.resize((f['w'] * scale, f['h'] * scale), Image.Resampling.NEAREST)
        image.alpha_composite(sprite, (round(ox - asset['anchor']['x'] * scale), round(oy - asset['anchor']['y'] * scale)))

    for state in ('powered', 'unpowered'):
        image = Image.new('RGBA', (1080, 680), BG); d = ImageDraw.Draw(image)
        d.text((20, 12), f'FINAL ATLAS / FOUR ORIENTATIONS / {state.upper()}', font=font, fill='#dfe5e8')
        d.text((20, 39), 'Normal game display / exact atlas pixels / fixed state anchors', font=small, fill='#a7b6c0')
        for row, name in enumerate(NAMES):
            top = 67 + row * 300
            d.text((20, top), 'REACTOR 2 x 2' if row == 0 else 'LIFE SUPPORT 1 x 2', font=small, fill='#a7b6c0')
            for r in range(4):
                d.text((r * 270 + 124, top + 25), f'r{r}', font=small, fill='#a7b6c0')
                draw(image, name, r, state, r * 270 + 135, top + 210)
        image.save(out / f'orientations-{state}.png')
    for r in range(4):
        image = Image.new('RGBA', (1080, 665), BG); d = ImageDraw.Draw(image)
        d.text((20, 12), f'FINAL ATLAS / DAMAGE STATES / r{r}', font=font, fill='#dfe5e8')
        d.text((20, 39), 'Normal game display / exact atlas pixels / same tile origins', font=small, fill='#a7b6c0')
        for col, (state, label) in enumerate(zip(('powered', 'damaged', 'damaged.flicker', 'destroyed'),
                                                ('HEALTHY', 'DAMAGED', 'FLICKER: LIGHTS OFF', 'DESTROYED'))):
            d.text((col * 270 + 20, 77), label, font=small, fill='#a7b6c0')
            for row, name in enumerate(NAMES): draw(image, name, r, state, col * 270 + 135, 287 + row * 295)
        image.save(out / f'damage-r{r}.png')
    zoom = Image.new('RGBA', (1050, 620), BG); d = ImageDraw.Draw(zoom)
    d.text((24, 16), 'REACTOR 2 x 2', font=font, fill='#dfe5e8')
    d.text((540, 16), 'LIFE SUPPORT 1 x 2', font=font, fill='#dfe5e8')
    d.text((24, 46), 'Final atlas / 2x game zoom / approved models and materials', font=small, fill='#a7b6c0')
    draw(zoom, 'reactor', 0, 'powered', 300, 411, 4)
    draw(zoom, 'life_support', 0, 'powered', 765, 443, 4)
    zoom.save(out / 'final-r0.png')
    flicker = []
    for state in ('damaged', 'damaged.flicker'):
        image = Image.new('RGBA', (540, 350), BG); d = ImageDraw.Draw(image)
        d.text((20, 12), 'DAMAGED / FLICKER ALIGNMENT', font=font, fill='#dfe5e8')
        for col, name in enumerate(NAMES): draw(image, name, 0, state, col * 270 + 135, 260)
        flicker.append(image.convert('P', palette=Image.Palette.ADAPTIVE))
    flicker[0].save(out / 'flicker.gif', save_all=True, append_images=flicker[1:],
                    duration=[340, 170], loop=0, optimize=False)


README = """# Reactor and life-support production handoff

Approved drop-in modules: reactor **2x2**, life support **1x2**. No content
footprint changes. Geometry is grounded, below the 1.85-unit walls, with no
floor slab. Healthy reactor top: 1.781; life-support top: 1.480 tile units.

## Files

- `1x/sprites/`: native colour/glow atlas twins, reactor 2048x98 and life
  support 2048x96. Both use the established 4096 maximum-side packer.
- `1x/manifest.fragment.json`: 40 unique frames, 60 entries including aliases.
- `1x/frames/`: final aligned colour/glow PNGs and metadata for each frame.
- `1x/reactor.blend`, `1x/life_support.blend`: editable approved healthy r0.
- `1x/integration.json`: asset IDs, state precedence, aliases and runtime notes.
- `1x/settings.json`, `parameters.json`, `build.json`: provenance and dimensions.
- `review/`: images drawn from the actual atlas pixels, all damage rotations,
  a flicker GIF and the validation report.
- `source/`: minimal standalone pipeline/model snapshot and locked approved
  reference frames. `CHECKSUMS.sha256` covers the entire package.

## Rendering contract

Blender **4.2.9 LTS**, two CPU threads, Cycles four samples, SS4, fixed project
orthographic camera (yaw45/elevation30), Standard/None colour management,
sun3.9 with shadows off, ambient.15, no bounces, exact standard environment
palette quantization and one-native-pixel prop outline. The core rendering
files were checked unchanged on main at 71d83c23953eda87b5f7cb0a77a45c8b63d73156.

Native tiles are **64x32**, displayed at **2x on the 128x64 game grid**.
Do not upscale the atlas or change its anchors during integration. One fixed
frame size and anchor covers every state in each asset/rotation; rotations may
have different anchors. Padding adds no floor geometry or visible marks.

The 22 approved colour/glow pairs are reproduced exactly inside the final
aligned frames. Only the 18 missing damage rotations were newly rendered.
Damaged and flicker geometry/alpha are exact matches. Unpowered, flicker-off
and destroyed frames contain no glow. Damage is made in r0 and rotated rigidly.

## Asset IDs and integration

| State | ID (`N` = 0..3) |
|---|---|
| Healthy, powered | `module.reactor.rN`, `module.life_support.rN` |
| Unpowered | append `.unpowered` |
| Damaged | append `.damaged` |
| Damage lights off | append `.damaged.flicker` |
| Destroyed | append `.destroyed` |

The bare legacy IDs (including old damaged/destroyed/flicker IDs) alias r0;
`.active` aliases powered healthy art without allocating more texture regions.
The content definition is `module.lifeSupport`, whose asset is `module.life_support`.

Copy the four atlas PNGs into `public/assets/1x/sprites/` and **merge** the
manifest fragment with the current manifest through the asset tooling. Keep
the existing footprints. Current main's `moduleAssets/stateArt` already supports
rotation and healthy `.unpowered` selection. Derelict ruin art supports damage
suffixes; live HP/flicker selection remains an integration concern. Use the
dark flicker variant for damaged machines while unpowered. Destroyed takes
precedence. A matching flicker schedule is 340ms lit / 170ms off, on render time.

No `src/`, live atlas or global manifest was changed by this handoff.

## Rebuild and validate

From `source/`, use the pinned Blender installed by `tools/blender/setup.sh`:

```sh
SPRITE_PREVIEW=0 SPRITE_SS=4 SPRITE_SAMPLES=4 blender -b -t 2 \\
  --factory-startup --python-exit-code 1 \\
  --python tools/blender/export_core_systems.py -- --out ../1x
python3 tools/blender/validate_core_systems.py --package ../1x \\
  --report ../review/validation.json
```

Only one Blender process at a time on a shared machine. Rebuilds verify the
approval lock first and reuse approved frames; other frames have source-keyed
cache checkpoints. Geometry, materials and reference changes require a new
approval lock instead of silently reusing stale artwork.
"""


def package_handoff(package):
    package = package.resolve(); review = package / 'review'
    reviews(package)
    report = validate(package / '1x', ROOT); dump(review / 'validation.json', report)
    source = package / 'source'
    lock_path = ROOT / 'tools/blender/core_systems_approved.json'
    lock = json.loads(lock_path.read_text())
    paths = set(lock['files']) | {'tools/blender/core_systems_approved.json',
        'tools/blender/export_core_systems.py', 'tools/blender/validate_core_systems.py',
        'tools/blender/pack_core_systems_handoff.py'}
    for name in sorted(paths):
        dest = source / name; dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, dest)
    assert validate(package / '1x', source) == report
    (package / 'README.md').write_text(README)
    files = sorted(p for p in package.rglob('*') if p.is_file() and p.name != 'CHECKSUMS.sha256')
    checksum = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(package).as_posix()}\n' for p in files)
    (package / 'CHECKSUMS.sha256').write_text(checksum)
    archive = package.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(q for q in package.rglob('*') if q.is_file()):
            info = zipfile.ZipInfo(f'{package.name}/{p.relative_to(package).as_posix()}', (2026, 10, 26, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED; info.external_attr = 0o100644 << 16
            z.writestr(info, p.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name in z.namelist():
            local = package / Path(name).relative_to(package.name)
            assert z.read(name) == local.read_bytes()
    shutil.copy2(review / 'final-r0.png', package.parent / 'core-systems-production-review.png')
    summary = {'complete': True, 'zip': archive.name, 'bytes': archive.stat().st_size,
               'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
               'uniqueFrames': 40, 'manifestEntries': 60, 'sheetSizes': report['sheetSizes'],
               'approvedFramePairsPixelExact': 22, 'sourceSnapshotValidated': True,
               'allChecksumsAndZipEntriesVerified': True}
    dump(package.parent / 'core-systems-production-summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--package', type=Path, required=True)
    package_handoff(ap.parse_args().package)
