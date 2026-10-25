"""Grey 3x4 refinery geometry study: raised retort, canted hopper, low die.

One material, no lights, panels or decorative detailing. The machine rests on
open cradles/skids rather than a full rectangular shell or deck slab.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame
from .refinery_compact import bridge,case,outline

GREY={'refinery.blockout.grey':{'hex':'#90979d'}}
COL='refinery.blockout.grey'


@dataclass(frozen=True)
class RefineryBlockout:
    chamber_z:float=.87
    chamber_radius_v:float=.90
    chamber_radius_z:float=.60
    chamber_back:float=-.82
    chamber_front:float=.90
    hopper_u:float=-1.23
    hopper_v:float=-.44
    hopper_top:float=1.62
    hopper_width:float=1.10
    hopper_depth:float=1.08
    hopper_cant:float=.18
    outlet_u:float=1.78
    skid_length:float=2.80
    straps:tuple=(-.40,.43)

    def spec(self): return asdict(self)


def cap(f,points): f.poly(points,COL,flip=True)


def retort_ring(f,p,u,factor=1):
    return [f.pt(u,p.chamber_radius_v*factor*math.cos(a),
                 p.chamber_z+p.chamber_radius_z*factor*math.sin(a))
            for a in ((i+.5)*math.tau/12 for i in range(12))]


def retort(f,p):
    sections=((p.chamber_back,.66),(-.53,1),(.40,1),(p.chamber_front,.70))
    rings=[retort_ring(f,p,u,scale) for u,scale in sections]
    cap(f,rings[0][::-1]);cap(f,rings[-1])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)
    def skin(u):
        for (x0,r0),(x1,r1) in zip(sections,sections[1:]):
            if x0<=u<=x1: return r0+(r1-r0)*(u-x0)/(x1-x0)
        raise ValueError('Pressure band lies outside the chamber')
    for u in p.straps:
        r0,r1=skin(u-.065),skin(u+.065)
        a,b=retort_ring(f,p,u-.065,r0+.065),retort_ring(f,p,u+.065,r1+.065)
        bridge(f,a,b,COL)
        bridge(f,retort_ring(f,p,u-.065,r0),a,COL)
        bridge(f,b,retort_ring(f,p,u+.065,r1),COL)


def loading_hopper(f,p):
    def ring(u,v,w,d,z,tilt=False):
        return [f.pt(x,y,z+(p.hopper_cant*(x-p.hopper_u) if tilt else 0))
                for x,y in outline(u,v,w,d,.14)]
    rim=ring(p.hopper_u,p.hopper_v,p.hopper_width,p.hopper_depth,p.hopper_top,True)
    low=ring(p.hopper_u+.22,p.hopper_v+.12,.55,.58,.86)
    inner=ring(p.hopper_u,p.hopper_v,p.hopper_width-.16,p.hopper_depth-.16,p.hopper_top,True)
    bottom=ring(p.hopper_u+.14,p.hopper_v+.08,.52,.54,p.hopper_top-.38)
    bridge(f,low,rim,COL);bridge(f,rim,inner,COL);bridge(f,inner,bottom,COL);cap(f,bottom[::-1])
    bridge(f,rim,ring(p.hopper_u,p.hopper_v,p.hopper_width,p.hopper_depth,p.hopper_top-.11,True),COL)
    # Tapered feed throat enters the rear of the same processing vessel.
    rings=[]
    for u,v,z,w,h in ((-1.39,-.34,.69,.62,.34),(-.72,-.16,.79,.67,.43)):
        rings.append([f.pt(u,v+vv,z+zz) for vv,zz in ((-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2))])
    bridge(f,*rings,COL);cap(f,rings[0][::-1]);cap(f,rings[1])


def extrusion(f,p):
    rings=[]
    for u,vw,z,h in ((.78,.98,.62,.68),(1.36,.94,.55,.55)):
        rings.append([f.pt(u,vv,zz) for vv,zz in
                      ((-vw/2,z-h/2),(-vw/2,z+h*.24),(-vw*.32,z+h/2),
                       (vw*.32,z+h/2),(vw/2,z+h*.24),(vw/2,z-h/2))])
    bridge(f,*rings,COL);cap(f,rings[0][::-1]);cap(f,rings[-1])
    front=p.outlet_u
    # A short low receiver, with sloped sides and a genuine recessed die face.
    for sign in (-1,1):
        a=[f.pt(1.16,sign*.49,.20),f.pt(1.16,sign*.49,.73),
           f.pt(front+.10,sign*.57,.41),f.pt(front+.10,sign*.57,.18)]
        outer=[f.pt(u,v+sign*.10,z) for u,v,z in
               ((1.16,sign*.49,.20),(1.16,sign*.49,.73),(front+.10,sign*.57,.41),(front+.10,sign*.57,.18))]
        cap(f,a);cap(f,outer[::-1]);bridge(f,a,outer,COL)
    case(f,front-.12,0,.17,.43,1.14,.10,COL,.025,.09)
    f.box(front-.16,0,.30,.025,.87,.25,COL)
    for v in (-.49,.49): f.box(front-.035,v,.27,.10,.10,.33,COL)
    for z in (.27,.55): f.box(front-.035,0,z,.10,1.06,.055,COL)


def return_loop(f):
    # A large attached return manifold leaves a visible opening around the pump.
    path=[(-.64,.72,.94),(-.72,1.11,.91),(-.52,1.27,.77),
          (.27,1.27,.77),(.57,1.06,.91),(.61,.74,.95)]
    from mathutils import Vector
    rings=[]
    for i,point in enumerate(path):
        tangent=(Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])).normalized()
        a=tangent.cross(Vector((0,0,1))).normalized();b=tangent.cross(a).normalized()
        centre=Vector(point)
        rings.append([f.pt(*(centre+.085*(a*math.cos(t)+b*math.sin(t))))
                      for t in (j*math.tau/10 for j in range(10))])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)


def refinery_blockout(p=RefineryBlockout()):
    core.palette._data.update(GREY)
    m=core.Mesh('refinery_open_cradle_blockout');f=Frame(m,rot=1,centre=(0,0))
    for v in (-1.03,1.03): case(f,0,v,0,p.skid_length,.18,.13,COL,.035,.07)
    retort(f,p);loading_hopper(f,p);extrusion(f,p)
    # Saddles join the pressure bands to separated feet, leaving real gaps.
    for u in p.straps:
        for side in (-1,1):
            case(f,u,side*1.04,.06,.34,.38,.19,COL,.04,.07)
            a=[f.pt(u-.13,side*v,z) for v,z in ((.48,.48),(.62,.58),(1.13,.23),(.99,.15))]
            b=[f.pt(u+.13,side*v,z) for v,z in ((.48,.48),(.62,.58),(1.13,.23),(.99,.15))]
            cap(f,a);cap(f,b[::-1]);bridge(f,a,b,COL)
    for v in (-.76,-.07): case(f,-1.38,v,0,.26,.24,.67,COL,.04,.05)
    # Small service pump joins the near-side saddle; it does not enclose the frame.
    case(f,-.13,1.08,.24,.91,.42,.39,COL,.10,.14)
    return_loop(f)
    return [m.build()]
