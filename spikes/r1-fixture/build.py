"""TEMPORARY fixture: maps the pixel-lab spike sprites into the manifest.ts shape (not for production).
Run: python3 spikes/r1-fixture/build.py  -> spikes/r1-fixture/assets/{manifest.json,*.png}
"""
import json, os, shutil
from PIL import Image

SRC = '/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/pixel-test/sprites/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
os.makedirs(OUT, exist_ok=True)
shutil.copy(SRC + 'env.qo.png', OUT + '/env.png')
shutil.copy(SRC + 'env.glow.png', OUT + '/env.glow.png')

# Spike rows are S,SW,W,NW,N,NE,E,SE. Manifest rows are sim facing (0 = grid +x = screen SE, ccw in grid space).
# Facing f is spike row (f + 7) % 8.
def reorder(name, out):
    im = Image.open(SRC + name).convert('RGBA')
    ch = im.height // 8
    res = Image.new('RGBA', im.size)
    for f in range(8):
        r = (f + 7) % 8
        res.paste(im.crop((0, r * ch, im.width, (r + 1) * ch)), (0, f * ch))
    res.save(OUT + '/' + out)

reorder('engineer.qo.png', 'crew.png')
reorder('engineer.glow.png', 'crew.glow.png')

env = json.load(open(SRC + 'env.json'))
eng = json.load(open(SRC + 'engineer.json'))
names = {
    'floor_a': 'tile.floor.a', 'floor_b': 'tile.floor.b', 'floor_c': 'tile.floor.c',
    'wall_x': 'tile.wall.x', 'wall_y': 'tile.wall.y', 'wall_low_x': 'tile.wall.low.x', 'wall_low_y': 'tile.wall.low.y',
    'hull_x': 'tile.hull.x', 'hull_y': 'tile.hull.y', 'door_x': 'tile.door.x', 'door_y': 'tile.door.y',
    'console': 'prop.console', 'reactor': 'prop.reactor', 'crates': 'prop.crates',
}
assets = {}
for s in env['sprites']:
    if s['id'] in names:
        assets[names[s['id']]] = {
            'kind': 'static', 'sheet': 'env',
            'frame': {'x': s['x'], 'y': s['y'], 'w': s['w'], 'h': s['h']},
            'anchor': {'x': s['ax'], 'y': s['ay']}, 'footprint': s['footprint'], 'glow': s['glow'],
        }
clips = {k: {'start': v['start'], 'frames': v['count'], 'fps': v['fps'], 'loop': True} for k, v in eng['clips'].items()}
assets['crew.human.body'] = {
    'kind': 'crew.layer', 'species': 'human', 'slot': 'body', 'order': 0, 'sheet': 'crew',
    'frameW': eng['cell'][0], 'frameH': eng['cell'][1], 'anchor': {'x': eng['anchor'][0], 'y': eng['anchor'][1]},
    'clips': clips, 'glow': True,
}
manifest = {
    'version': 1, 'tile': {'w': 64, 'h': 32},
    # Colours present in the spike engineer sprite, so the palette swap is visible with this fixture.
    'keyColors': {'team.skin': '#d49c74', 'team.cloth': '#72845f'},
    'sheets': {'env': {'image': 'env.png', 'glow': 'env.glow.png'}, 'crew': {'image': 'crew.png', 'glow': 'crew.glow.png'}},
    'assets': assets,
}
json.dump(manifest, open(OUT + '/manifest.json', 'w'), indent=1)
print('wrote', OUT, len(assets), 'assets')
