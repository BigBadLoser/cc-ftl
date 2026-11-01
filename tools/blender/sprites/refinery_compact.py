"""Fresh 3x4 refinery mockup: hopper -> sealed processor -> output drawer.

A single integrated case with a removable process hood, one service radiator
and an attached coolant line. Footprint centre origin, long axis grid +x.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame

PAINT={'compact.refinery.paint':{'hex':'#cf8134'}}


@dataclass(frozen=True)
class CompactRefinery:
    length:float=3.78
    width:float=2.64
    case_top:float=1.00
    hood_top:float=1.43
    hood_length:float=2.10
    hood_width:float=1.70
    hopper_u:float=-1.26
    hopper_v:float=-.16
    hopper_top:float=1.60
    hopper_width:float=.96
    hopper_depth:float=1.10
    hopper_well:float=.44
    output_u:float=1.82

    def spec(self): return asdict(self)


def outline(u,v,w,d,c=.08):
    a,b=w/2,d/2;c=min(c,a*.4,b*.4)
    return [(u+x,v+y) for x,y in ((-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),
                                  (a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c))]


def bridge(f,a,b,col):
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],col,flip=True)


def case(f,u,v,z,w,d,h,col,bevel=.06,corner=.10):
    b=min(bevel,h*.28,w*.15,d*.15)
    rings=[]
    for width,depth,height in ((w-2*b,d-2*b,z),(w,d,z+b),
                               (w,d,z+h-b),(w-2*b,d-2*b,z+h)):
        rings.append([f.pt(x,y,height) for x,y in outline(u,v,width,depth,corner)])
    f.poly(rings[0][::-1],col,flip=True)
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,col)
    f.poly(rings[-1],col,flip=True)


def hopper(f,p):
    def ring(w,d,z):
        return [f.pt(x,y,z) for x,y in outline(p.hopper_u,p.hopper_v,w,d,.10)]
    top=ring(p.hopper_width,p.hopper_depth,p.hopper_top)
    lower=ring(.66,.72,.88)
    inner=ring(p.hopper_width-.16,p.hopper_depth-.16,p.hopper_top)
    floor=ring(.58,.68,p.hopper_top-p.hopper_well)
    bridge(f,lower,top,'steelL');bridge(f,top,inner,'plate')
    bridge(f,inner,floor,'steelD');f.poly(floor[::-1],'steelD',flip=True)
    bridge(f,top,ring(p.hopper_width,p.hopper_depth,p.hopper_top-.12),'plate')


def coolant(f):
    # Thick attached line joining intake-side hardware to the process case.
    path=[(-1.02,.97),(-.83,1.14),(.54,1.14),(.79,.97),(.79,.71)]
    rings=[];v=1.02
    for i,(u,z) in enumerate(path):
        a,b=path[max(0,i-1)],path[min(len(path)-1,i+1)]
        du,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(du,dz)
        rings.append([f.pt(u-.065*math.sin(t)*dz/length,v+.065*math.cos(t),
                           z+.065*math.sin(t)*du/length) for t in (j*math.tau/10 for j in range(10))])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,'steelL')
    for u,z in (path[0],path[-1]):
        case(f,u,v,z-.06,.18,.20,.13,'steelD',.02,.03)


def refinery_compact(p=CompactRefinery()):
    core.palette._data.update(PAINT)
    m=core.Mesh('refinery_compact');f=Frame(m,rot=1,centre=(0,0))
    # One continuous machine case; raised elements all enter this common body.
    case(f,0,0,0,p.length,p.width,.22,'steelD',.055,.22)
    case(f,0,0,.17,p.length-.20,p.width-.18,p.case_top-.17,'plate',.10,.18)
    case(f,.20,-.08,.79,p.hood_length,p.hood_width,p.hood_top-.79,'compact.refinery.paint',.11,.15)
    # A broad single process cover with two structural seams, not separate tanks.
    for u in (-.19,.74):
        f.box(u,-.08,p.hood_top-.01,.055,1.35,.045,'steelD')
    hopper(f,p)
    # Radiator and plumbing are inset/attached to the case's service face.
    case(f,.02,1.20,.31,1.46,.08,.53,'steelD',.025,.04)
    for i in range(10):
        f.box(-.60+i*.135,1.253,.36,.042,.045,.42,'steelL')
    coolant(f)
    # Integrated far-side cooling pod shares the same lower case.
    case(f,.32,-1.01,.66,1.38,.42,.35,'blueGrey',.065,.08)
    for u in (-.15,.10,.35,.60,.85):
        f.box(u,-1.01,1.012,.08,.29,.025,'steelD')
    # Output drawer and die mouth: real recessed front opening over a metal tray.
    front=p.output_u
    f.box(front-.010,0,.37,.018,1.29,.34,'steelD')
    for v in (-.70,.70):
        case(f,front-.03,v,.31,.11,.12,.49,'compact.refinery.paint',.025,.02)
    for z in (.31,.74):
        case(f,front-.03,0,z,.11,1.48,.07,'compact.refinery.paint',.02,.03)
    f.box(front-.09,0,.38,.26,1.27,.045,'plate')
    # A single newly refined bar, kept within the drawer rather than loose props.
    case(f,front+.015,0,.425,.12,.78,.12,'plate',.025,.04)
    case(f,front-.015,0,.21,.15,1.51,.13,'steelD',.03,.04)
    # Compact control bezel on the near side, built into the process hood.
    case(f,.88,.82,1.02,.28,.075,.23,'steelD',.02,.03)
    result=[m.build()]
    lm=core.Mesh('refinery_compact_status',selflit=True);lf=Frame(lm,rot=1,centre=(0,0))
    lf.box(.18,.776,1.16,.70,.014,.045,'flameW')
    lf.box(.88,.863,1.08,.17,.014,.055,'cyan')
    lf.box(front+.029,0,.766,.012,.46,.025,'flameY')
    result.append(lm.build())
    return result
