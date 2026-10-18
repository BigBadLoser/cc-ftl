import sys,json,importlib.util
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[4]
base=root/'tools/blender/experiments'
sys.path[:0]=[str(root/'tools/blender'),str(base/'shield_bastion_h185_ward_lowbody')]
from sprites import core
import model,roof

def load(name,path):
 s=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
old=load('previous',base/'shield_bastion_h185/model.py')
original=load('original',base/'shield_bastion/model.py')
original.ZR=2.4  # Compare the original body at its own ceiling height.
# All source shapes use the same primitives; capture each swept spine and lens.
def parts(mod,r,hot):
 result={};ev,hp=mod.extrude_v,mod.hex_plate
 def spine(f,*args,**kwargs):
  start=len(f.m.v);ev(f,*args,**kwargs);result['spine']=np.array(f.m.v[start:])
 def lens(f,c,a,b,radius,*args,**kwargs):
  start=len(f.m.v);hp(f,c,a,b,radius,*args,**kwargs)
  if radius==.485: result['lens']=np.array(f.m.v[start:]); result['lensMinimum']=float(np.array(f.m.v[start:])[-6:,2].min())
 mod.extrude_v=spine;mod.hex_plate=lens
 try:
  core.setup_scene();obs=mod.small(r,hot)
  result['all']=np.array([tuple(v.co) for ob in obs for v in ob.data.vertices])
 finally:mod.extrude_v=ev;mod.hex_plate=hp
 return result
for r in range(4):
 for hot in (False,True):
  p,o,n=parts(old,r,hot),parts(original,r,hot),parts(model,r,hot)
  v=n['all']
  assert v[:,0].min()>=-1.5 and v[:,0].max()<=.5
  assert v[:,1].min()>=-.5 and v[:,1].max()<=1.5
  assert abs(v[:,2].min()-.02)<1e-5 and abs(v[:,2].max()-2.05)<1e-5
  assert np.allclose(n['spine'],o['spine']-(0,0,.35),atol=1e-5)
  assert np.allclose(n['lens'],p['lens']-(0,0,.30),atol=1e-5)
  clearance=n['lensMinimum']-.86
  assert .04<clearance<.05
# The rest of the pack is intentionally byte-identical source.
for filename in ('geometry.py','roof.py'):
 assert (base/'shield_bastion_h185'/filename).read_bytes()==(base/'shield_bastion_h185_ward_lowbody'/filename).read_bytes()
report={'status':'PASS','rotationsChecked':[0,1,2,3],'wallZ':1.85,'roofZ':2.05,'casingTopZ':.86,'hexClearance':clearance,'hexFace':'same geometry, translated down 0.30','spine':'original full length and sweep, translated down 0.35','roofAndHatch':'unchanged'}
(root/'artifacts/wall-1.85-roof-2.05/ward-lowbody/ward-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
