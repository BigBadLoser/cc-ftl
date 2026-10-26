"""Production refinery adapter: dimensions, interaction point, states and anchoring.

No registration in the live families or manifest. The old review model remains
centred on its footprint; this adapter anchors it at the front-most tile.
"""
import math
import bpy
from . import core
from .refinery_revision_b import VesselRefinery,refinery_revision_b
from .refinery_operating import operating_pose

FOOTPRINT=(3,4)
ACCESS=(3,3)
FPS=4


def parameters():
    # A small outward shift puts the controls in reach while retaining the
    # approved height. The terminal's outer edge remains inside the 3x4 box.
    return VesselRefinery(terminal_v=1.24)


def rotated_point(x,y,rotation):
    w,h=FOOTPRINT
    for _ in range(rotation): x,y=h-1-y,x;w,h=h,w
    return x,y


def layout(rotation):
    p=parameters();w,h=FOOTPRINT if rotation%2==0 else FOOTPRINT[::-1]
    access=rotated_point(*ACCESS,rotation)
    # Local u points north at r0, v east. Tile (0,0) is the back-left tile centre.
    controls=[rotated_point(p.terminal_v+.17+1,-(p.terminal_u+du)+1.5,rotation) for du in (-.20,.20)]
    reach=min(math.dist(access,c) for c in controls)
    assert not (0<=access[0]<w and 0<=access[1]<h)
    assert reach<.70
    return {'rotation':rotation,'footprint':[w,h],'centreFromFront':[-(w-1)/2,-(h-1)/2],
            'accessTile':list(access),'accessFromFront':[access[0]-(w-1),access[1]-(h-1)],
            'controlsXY':[list(c) for c in controls],'nearestControlDistance':reach,
            'controlHeight':.874,'terminalEdgeClearance':1.5-(p.terminal_v+.24)}


def build(rotation=0,state='idle',frame=0):
    pose=operating_pose(parameters(),state,frame)
    obs=refinery_revision_b(pose,rotation=rotation)
    x,y=layout(rotation)['centreFromFront']
    for ob in obs: ob.location+=core.G(x,y,0)
    bpy.context.view_layer.update()
    return obs


def asset_id(rotation,state='idle',frame=0):
    base=f'module.refinery.r{rotation}'
    if state=='unpowered': return base+'.unpowered'
    if state=='working': return base+'.active'+(f'.f{frame}' if frame else '')
    assert state=='idle'
    return base


def poses():
    for rotation in (1,0,2,3):
        for state,frame in [('idle',0)]+[('working',i) for i in range(4)]+[('unpowered',0)]:
            yield rotation,state,frame
