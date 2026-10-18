from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
base=Path('artifacts/wall-1.85-roof-2.05');out=base/'ward-lowbody'
cv=Image.new('RGB',(1600,790),(12,17,25));d=ImageDraw.Draw(cv)
for i,(folder,title) in enumerate(((base/'shields','PREVIOUS / SHORTER SPINE'),(out,'REVISED / LOWER CASING, LONGER SPINE'))):
 im=Image.open(folder/'blender-small.png').convert('RGB')
 cv.paste(im.resize((800,727),Image.Resampling.LANCZOS),(i*800,63))
 d.text((i*800+20,18),title,font=ImageFont.load_default(size=21),fill=(219,230,243))
 d.text((i*800+20,45),'WALL 1.85 / ROOF 2.05',font=ImageFont.load_default(size=12),fill=(135,156,181))
cv.save(out/'ward-comparison.png')
cv=Image.new('RGBA',(800,370),(12,17,25,255));d=ImageDraw.Draw(cv)
for i,(folder,title) in enumerate(((base/'shields','PREVIOUS'),(out,'REVISED'))):
 im=Image.open(folder/'small-review-1x.png').convert('RGBA').crop((400,0,800,330))
 cv.paste(im,(i*400,40))
 d.text((i*400+14,13),title,font=ImageFont.load_default(size=14),fill=(219,230,243))
cv.save(out/'ward-pixel-comparison-1x.png')
cv.resize((2400,1110),Image.Resampling.NEAREST).save(out/'ward-pixel-comparison-3x.png')
# Binary alpha, exact 3x, manifest dimensions and preservation of the rest.
import json
man=json.loads((out/'manifest.fragment.json').read_text())
for sid in ('module.shield_gen_small.r0','module.shield_gen_small.r0.active'):
 im=np.array(Image.open(out/man['sheets'][sid]['image']))
 assert set(np.unique(im[...,3]))<={0,255}
 assert im.shape[:2]==(man['assets'][sid]['frame']['h'],man['assets'][sid]['frame']['w'])
for p in (base/'shields/sprites').iterdir():
 if not p.name.startswith('module.shield_gen_small.r0'):
  assert p.read_bytes()==(out/'sprites'/p.name).read_bytes()
small=np.array(Image.open(out/'small-review-1x.png'))
assert np.array_equal(np.array(Image.open(out/'small-review-3x.png')),small.repeat(3,0).repeat(3,1))
print('PASS: WARD pixels, unchanged BASTION/roof/context sprites, exact 3x')
