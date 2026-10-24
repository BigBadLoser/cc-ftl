"""Fresh B: upright refining vessel, low feed jaw and gravity discharge.

Grey geometry only. The feed, vessel and condenser share one cast lower body;
openings and large plumbing describe the process without a covering shell.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame
from .refinery_compact import bridge,case,outline
from .refinery_blockout import COL,GREY


@dataclass(frozen=True)
class VesselRefinery:
    vessel_u:float=.05
    vessel_v:float=-.19
    vessel_radius:float=.91
    vessel_floor:float=.32
    vessel_shoulder:float=1.29
    head_top:float=1.78
    feed_u:float=-1.30
    feed_top:float=1.12
    feed_width:float=1.02
    feed_depth:float=1.42
    outlet_end:float=1.86
    condenser_v:float=1.04

    def spec(self): return asdict(self)


def cap(f,points): f.poly(points,COL,flip=True)


def vertical_ring(f,u,v,z,r,sides=16):
    return [f.pt(u+r*math.cos(a),v+r*math.sin(a),z)
            for a in ((i+.5)*math.tau/sides for i in range(sides))]


def vessel(f,p):
    # A squat pressure chamber with a dished shoulder and distinct raised head.
    profile=((p.vessel_floor,.73),(p.vessel_floor+.15,p.vessel_radius),
             (p.vessel_shoulder-.11,p.vessel_radius),
             (p.vessel_shoulder,.74),(p.vessel_shoulder+.10,.59))
    rings=[vertical_ring(f,p.vessel_u,p.vessel_v,z,r) for z,r in profile]
    cap(f,rings[0][::-1])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)
    cap(f,rings[-1])
    for z in (.51,1.13):
        f.vcyl(p.vessel_u,p.vessel_v,z,p.vessel_radius+.055,.10,COL,sides=16)
    f.vcyl(p.vessel_u,p.vessel_v,p.vessel_shoulder+.10,.30,.16,COL,sides=12)
    f.vcyl(p.vessel_u,p.vessel_v,p.vessel_shoulder+.23,.42,.085,COL,sides=12)
    # A horizontal agitator motor distinguishes the head from a simple lid knob.
    motor_z=p.head_top-.16
    f.hcyl(p.vessel_u-.30,p.vessel_u+.29,p.vessel_v,motor_z,.16,COL,sides=12,cap=COL,capstart=COL)
    for u in (p.vessel_u-.19,p.vessel_u+.05):
        f.hcyl(u,u+.055,p.vessel_v,motor_z,.18,COL,sides=12)
    case(f,p.vessel_u+.36,p.vessel_v,p.vessel_shoulder+.23,.26,.37,.26,COL,.04,.06)
    # The lower sump bears on the common chassis rather than hovering above it.
    f.vcyl(p.vessel_u,p.vessel_v,.20,.64,.17,COL,rtop=.74,sides=16)
    for a in (math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4):
        u=p.vessel_u+.71*math.cos(a);v=p.vessel_v+.71*math.sin(a)
        case(f,u,v,1.11,.18,.18,.27,COL,.025,.04)


def feed(f,p):
    def ring(u,w,d,z): return [f.pt(x,y,z) for x,y in outline(u,p.vessel_v,w,d,.10)]
    top=ring(p.feed_u,p.feed_width,p.feed_depth,p.feed_top)
    low=ring(p.feed_u+.21,.52,.77,.44)
    inner=ring(p.feed_u,p.feed_width-.14,p.feed_depth-.14,p.feed_top)
    well=ring(p.feed_u+.10,.56,.91,p.feed_top-.31)
    bridge(f,low,top,COL);bridge(f,top,inner,COL);bridge(f,inner,well,COL)
    cap(f,well[::-1]);bridge(f,top,ring(p.feed_u,p.feed_width,p.feed_depth,p.feed_top-.10),COL)
    case(f,-.88,p.vessel_v,.35,.92,.78,.40,COL,.07,.12)
    cross=Frame(f.m,rot=2,centre=(0,0))
    for u in (p.feed_u-.16,p.feed_u+.16):
        cross.hcyl(p.vessel_v-.49,p.vessel_v+.49,-u,p.feed_top-.22,.11,COL,sides=16,cap=COL,capstart=COL)
        for v in (-.40,-.20,0,.20,.40):
            cross.hcyl(p.vessel_v+v-.027,p.vessel_v+v+.027,-u,p.feed_top-.22,.13,COL,sides=10)


def discharge(f,p):
    # The tapered discharge neck leaves the vessel above an open casting trough.
    f.hcyl(.61,1.15,p.vessel_v,.51,.29,COL,r1=.24,sides=12)
    f.hcyl(1.08,1.17,p.vessel_v,.51,.31,COL,sides=12)
    def ring(u,r):
        return [f.pt(u,p.vessel_v+r*math.cos(a),.51+r*math.sin(a))
                for a in ((i+.5)*math.tau/12 for i in range(12))]
    # Annular die flange and real bore, with its back recessed into the vessel.
    bridge(f,ring(1.17,.31),ring(1.17,.18),COL)
    bridge(f,ring(1.17,.18),ring(.85,.18),COL)
    cap(f,ring(.85,.18)[::-1])
    u0,u1=1.10,p.outlet_end
    inside=[];outside=[]
    for u,z,w in ((u0,.35,.38),(u1,.17,.51)):
        inside.append([f.pt(u,p.vessel_v+v,zz) for v,zz in
                       ((-w,z+.22),(-w,z),(w,z),(w,z+.22))])
        outside.append([f.pt(u,p.vessel_v+v,zz) for v,zz in
                        ((-w-.07,z+.22),(-w-.07,z-.08),(w+.07,z-.08),(w+.07,z+.22))])
    for j in range(3):
        cap(f,[inside[0][j],inside[1][j],inside[1][j+1],inside[0][j+1]])
        cap(f,[outside[0][j+1],outside[1][j+1],outside[1][j],outside[0][j]])
    for j in (0,3): cap(f,[inside[0][j],outside[0][j],outside[1][j],inside[1][j]])
    for i in (0,1):
        for j in range(3): cap(f,[inside[i][j],outside[i][j],outside[i][j+1],inside[i][j+1]])
    case(f,1.59,p.vessel_v,.235,.31,.51,.085,COL,.02,.04)


def pipe(f,path,r=.11):
    from mathutils import Vector
    rings=[]
    for i,xyz in enumerate(path):
        tangent=(Vector(path[min(i+1,len(path)-1)])-Vector(path[max(i-1,0)])).normalized()
        axis=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
        a=tangent.cross(axis).normalized();b=tangent.cross(a).normalized();c=Vector(xyz)
        rings.append([f.pt(*(c+r*(a*math.cos(t)+b*math.sin(t))))
                      for t in (j*math.tau/12 for j in range(12))])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)


def condenser(f,p):
    for u in (-.35,.57):
        case(f,u,p.condenser_v,0,.23,.40,.24,COL,.025,.04)
    case(f,.12,.67,.17,1.16,.76,.15,COL,.035,.10)
    case(f,.12,p.condenser_v,.18,1.16,.43,.61,COL,.06,.10)
    for u in (-.35,-.12,.11,.34,.57):
        case(f,u,p.condenser_v+.04,.26,.085,.43,.45,COL,.015,.02)
    pipe(f,[(-.42,.43,1.15),(-.45,.81,1.25),(-.34,p.condenser_v,1.25),
            (.43,p.condenser_v,1.25),(.65,p.condenser_v,1.08),(.65,p.condenser_v,.72)])
    pipe(f,[(.60,p.condenser_v,.28),(.90,.92,.28),(.90,.46,.39),(.66,.35,.50)],.085)


def refinery_revision_b(p=VesselRefinery()):
    core.palette._data.update(GREY)
    m=core.Mesh('refinery_b_vertical_vessel');f=Frame(m,rot=1,centre=(0,0))
    # One low cast chassis joins the feed, pressure vessel and discharge roots.
    case(f,-.02,p.vessel_v,0,3.00,1.56,.26,COL,.065,.26)
    for u in (-1.28,.75):
        for v in (p.vessel_v-.68,p.vessel_v+.68):
            case(f,u,v,0,.35,.36,.20,COL,.035,.06)
    vessel(f,p);feed(f,p);discharge(f,p);condenser(f,p)
    return [m.build()]
