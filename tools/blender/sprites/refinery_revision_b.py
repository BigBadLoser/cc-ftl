"""Refined B: upright refining vessel, low feed jaw and gravity discharge.

The feed, vessel and condenser share one cast lower body;
openings and large plumbing describe the process without a covering shell.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame
from .refinery_compact import bridge,case,outline
from .refinery_blockout import COL,GREY
from .refinery_finish import FinishMesh,PALETTE as FINISH_PALETTE

SCREEN='refinery.terminal.screen'
UI='refinery.terminal.ui'
CONTROL_GREYS={SCREEN:{'hex':'#29323a'},UI:{'hex':'#c1cbd2'}}


class RefineryFrame(Frame):
    def vcyl(self,u,v,z,r,h,color,top=None,rtop=None,sides=8):
        # Rotate the faceted cylinder's section as well as its centre. r1 keeps
        # the approved vertex order and appearance; other views are rigid turns.
        x,y=self.xy(u,v)
        self.m.cyl((x,y,z),r,h,color,sides=sides,top=top,rtop=rtop,
                   rz=(self.rot-1)*math.pi/2)


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
    lid_gap:float=.025
    clamp_width:float=.14
    feed_well:float=.40
    condenser_fins:int=7
    terminal:bool=True
    powered_feed:bool=True
    powered_output:bool=True
    terminal_u:float=-1.00
    terminal_v:float=1.12
    terminal_drop:float=.15
    materials:bool=True

    def spec(self): return asdict(self)


def cap(f,points): f.poly(points,COL,flip=True)


def vertical_ring(f,u,v,z,r,sides=16):
    return [f.pt(u+r*math.cos(a),v+r*math.sin(a),z)
            for a in ((i+.5)*math.tau/sides for i in range(sides))]


def vessel(f,p):
    f.m.paint('vessel')
    # Keep the chosen chamber silhouette; split the pressure joint into two
    # physical flanges with an actual clearance seam and shaped clamp castings.
    profile=((p.vessel_floor,.73),(p.vessel_floor+.15,p.vessel_radius),
             (1.14,p.vessel_radius))
    rings=[vertical_ring(f,p.vessel_u,p.vessel_v,z,r) for z,r in profile]
    cap(f,rings[0][::-1])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)
    cap(f,rings[-1])
    f.m.paint('lid')
    lid=[vertical_ring(f,p.vessel_u,p.vessel_v,z,r) for z,r in
         ((1.16+p.lid_gap,p.vessel_radius),(p.vessel_shoulder,.74),
          (p.vessel_shoulder+.10,.59))]
    cap(f,lid[0][::-1])
    for a,b in zip(lid,lid[1:]): bridge(f,a,b,COL)
    cap(f,lid[-1])
    f.m.paint('frame')
    for z,h in ((.51,.10),(1.105,.055),(1.16+p.lid_gap,.045)):
        f.vcyl(p.vessel_u,p.vessel_v,z,p.vessel_radius+.055,h,COL,sides=16)
    f.m.paint('steel')
    f.vcyl(p.vessel_u,p.vessel_v,p.vessel_shoulder+.10,.30,.16,COL,sides=12)
    f.m.paint('frame')
    f.vcyl(p.vessel_u,p.vessel_v,p.vessel_shoulder+.23,.42,.085,COL,sides=12)
    # A horizontal agitator motor distinguishes the head from a simple lid knob.
    motor_z=p.head_top-.16
    f.hcyl(p.vessel_u-.30,p.vessel_u+.29,p.vessel_v,motor_z,.16,COL,sides=12,cap=COL,capstart=COL)
    f.m.paint('steel')
    for du in (-.24,-.12,0,.12):
        f.hcyl(p.vessel_u+du,p.vessel_u+du+.04,p.vessel_v,motor_z,.18,COL,sides=12)
    f.m.paint('yellow')
    case(f,p.vessel_u+.36,p.vessel_v,p.vessel_shoulder+.23,.26,.37,.26,COL,.04,.06)
    # The lower sump bears on the common chassis rather than hovering above it.
    f.m.paint('frame')
    f.vcyl(p.vessel_u,p.vessel_v,.20,.64,.17,COL,rtop=.74,sides=16)
    f.m.paint('yellow')
    for a in (math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4):
        profile=((.88,1.08),(1.01,1.08),(1.04,1.14),(1.04,1.27),
                 (.86,1.41),(.77,1.38),(.92,1.23),(.92,1.16),(.88,1.16))
        loops=[]
        for t in (-p.clamp_width/2,p.clamp_width/2):
            loops.append([f.pt(p.vessel_u+r*math.cos(a)-t*math.sin(a),
                               p.vessel_v+r*math.sin(a)+t*math.cos(a),z)
                          for r,z in profile])
        bridge(f,*loops,COL);cap(f,loops[0][::-1]);cap(f,loops[1])


def feed(f,p):
    f.m.paint('yellow')
    def ring(u,w,d,z): return [f.pt(x,y,z) for x,y in outline(u,p.vessel_v,w,d,.10)]
    top=ring(p.feed_u,p.feed_width,p.feed_depth,p.feed_top)
    low=ring(p.feed_u+.21,.52,.77,.44)
    inner=ring(p.feed_u,p.feed_width-.14,p.feed_depth-.14,p.feed_top)
    well=ring(p.feed_u+.06,.68,1.06,p.feed_top-p.feed_well)
    bridge(f,low,top,COL);bridge(f,top,inner,COL);bridge(f,inner,well,COL)
    cap(f,well[::-1]);bridge(f,top,ring(p.feed_u,p.feed_width,p.feed_depth,p.feed_top-.10),COL)
    f.m.paint('frame')
    case(f,-.88,p.vessel_v,.35,.92,.78,.40,COL,.07,.12)
    f.m.paint('steel')
    cross=Frame(f.m,rot=(f.rot+1)%4,centre=(f.cx,f.cy))
    for u in (p.feed_u-.16,p.feed_u+.16):
        cross.hcyl(p.vessel_v-.64,p.vessel_v+.64,-u,p.feed_top-.22,.075,COL,sides=16,cap=COL,capstart=COL)
        cross.hcyl(p.vessel_v-.49,p.vessel_v+.49,-u,p.feed_top-.22,.11,COL,sides=16)
        for v in (-.40,-.20,0,.20,.40):
            cross.hcyl(p.vessel_v+v-.027,p.vessel_v+v+.027,-u,p.feed_top-.22,.13,COL,sides=10)
        f.m.paint('frame')
        for sign in (-1,1):
            v=p.vessel_v+sign*.60
            cross.hcyl(v-.055,v+.055,-u,p.feed_top-.22,.16,COL,sides=12,cap=COL,capstart=COL)
        f.m.paint('steel')
    # A common enclosed roller drive bridges both shafts on the near cheek.
    f.m.paint('yellow')
    case(f,p.feed_u,p.vessel_v+.71,p.feed_top-.39,.57,.25,.28,COL,.04,.06)
    if p.powered_feed: feed_gate(f,p)


def feed_gate(f,p):
    f.m.paint('frame')
    # Part-open sliding shutter, visibly carried by its two raised guide rails.
    # Two broad leaves and one actuator survive the native sprite reduction.
    for side in (-1,1):
        case(f,p.feed_u,p.vessel_v+side*.64,p.feed_top-.02,.96,.11,.10,COL,.02,.025)
    f.m.paint('yellow')
    for du in (-.32,-.10):
        case(f,p.feed_u+du,p.vessel_v,p.feed_top+.025,.20,1.27,.065,COL,.012,.025)
    v=p.vessel_v+.76;z=p.feed_top+.10
    f.m.paint('frame')
    f.hcyl(p.feed_u+.08,p.feed_u+.40,v,z,.075,COL,sides=12,cap=COL,capstart=COL)
    f.m.paint('steel')
    f.hcyl(p.feed_u-.10,p.feed_u+.08,v,z,.035,COL,sides=12,cap=COL)
    f.m.paint('yellow')
    case(f,p.feed_u-.10,p.vessel_v+.60,p.feed_top+.02,.12,.39,.12,COL,.02,.025)
    for du in (.12,.35):
        case(f,p.feed_u+du,v,p.feed_top-.04,.12,.17,.12,COL,.02,.025)


def discharge(f,p):
    f.m.paint('vessel')
    # The tapered discharge neck leaves the vessel above an open casting trough.
    f.hcyl(.61,1.15,p.vessel_v,.51,.29,COL,r1=.24,sides=12)
    f.m.paint('steel')
    f.hcyl(1.08,1.17,p.vessel_v,.51,.31,COL,sides=12)
    def ring(u,r):
        return [f.pt(u,p.vessel_v+r*math.cos(a),.51+r*math.sin(a))
                for a in ((i+.5)*math.tau/12 for i in range(12))]
    # Annular die flange and real bore, with its back recessed into the vessel.
    bridge(f,ring(1.17,.31),ring(1.17,.18),COL)
    f.m.paint('dark')
    bridge(f,ring(1.17,.18),ring(.85,.18),COL)
    cap(f,ring(.85,.18)[::-1])
    f.m.paint('steel')
    for a in ((i+.5)*math.tau/6 for i in range(6)):
        f.hcyl(1.17,1.22,p.vessel_v+.25*math.cos(a),.51+.25*math.sin(a),
               .037,COL,sides=6,cap=COL)
    u0,u1=1.10,p.outlet_end
    inside=[];outside=[]
    for u,z,w in ((u0,.35,.38),(u1,.17,.51)):
        inside.append([f.pt(u,p.vessel_v+v,zz) for v,zz in
                       ((-w,z+.22),(-w,z),(w,z),(w,z+.22))])
        outside.append([f.pt(u,p.vessel_v+v,zz) for v,zz in
                        ((-w-.07,z+.22),(-w-.07,z-.08),(w+.07,z-.08),(w+.07,z+.22))])
    f.m.paint('frame')
    for j in range(3):
        cap(f,[inside[0][j],inside[1][j],inside[1][j+1],inside[0][j+1]])
        cap(f,[outside[0][j+1],outside[1][j+1],outside[1][j],outside[0][j]])
    for j in (0,3): cap(f,[inside[0][j],outside[0][j],outside[1][j],inside[1][j]])
    for i in (0,1):
        for j in range(3): cap(f,[inside[i][j],outside[i][j],outside[i][j+1],inside[i][j+1]])
    slope=(.35-.17)/(u1-u0)
    def inclined(u,v,w,d,h,lift=0):
        z=.35-slope*(u-u0)+lift
        loops=[[f.pt(x,y,z+dz-slope*(x-u)) for x,y in outline(u,v,w,d,.025)]
               for dz in (0,h)]
        bridge(f,*loops,COL);cap(f,loops[0][::-1]);cap(f,loops[1])
    if p.powered_output:
        cross=Frame(f.m,rot=(f.rot+1)%4,centre=(f.cx,f.cy));radius=.075;axle_lift=.070
        f.m.paint('steel')
        for u in (1.24,1.42,1.60,1.78):
            z=.35-slope*(u-u0)+axle_lift
            half=.38+.13*(u-u0)/(u1-u0)
            cross.hcyl(p.vessel_v-half,p.vessel_v+half,-u,z,radius,COL,sides=16,cap=COL,capstart=COL)
        # Near-side drive case and end stops belong to the same inclined frame.
        f.m.paint('yellow')
        inclined(1.48,p.vessel_v+.51,.64,.18,.18,.035)
        for v in (-.43,.43): inclined(1.80,p.vessel_v+v,.105,.12,.17,.04)
        # Offset the billet to the inclined tangent plane of the powered rollers.
        lift=axle_lift+radius*math.sqrt(1+slope*slope)
        f.m.paint('billet')
        inclined(1.60,p.vessel_v,.23,.44,.095,lift)
    else:
        for v in (-.34,.34): inclined(1.53,p.vessel_v+v,.60,.055,.045)
        inclined(1.59,p.vessel_v,.31,.51,.085)


def operator_terminal(f,p):
    f.m.paint('frame')
    # Braced arm originates inside the chassis; a broad inclined screen sits
    # outside the vessel silhouette, facing the near-side crew access position.
    u,v=p.terminal_u,p.terminal_v;panel_z=1.15-p.terminal_drop
    case(f,u,.49,.17,.34,.28,.15,COL,.03,.05)
    profile=((.48,.20),(.62,.20),(v+.10,.99-p.terminal_drop),
             (v,1.09-p.terminal_drop),(.54,.35))
    loops=[[f.pt(u+du,y,z) for y,z in profile] for du in (-.075,.075)]
    bridge(f,*loops,COL);cap(f,loops[0][::-1]);cap(f,loops[1])
    def ring(width,depth,dz=0,offset=0):
        return [f.pt(x,y,panel_z-.90*(y-v)+dz)
                for x,y in outline(u,v+offset,width,depth,.04)]
    outer=ring(.70,.48);back=ring(.70,.48,-.11)
    inner=ring(.53,.29,0,-.035);screen=ring(.53,.29,-.045,-.035)
    bridge(f,back,outer,COL);cap(f,back[::-1]);f.m.paint('vessel');bridge(f,outer,inner,COL)
    bridge(f,inner,screen,COL);f.poly(screen,SCREEN,flip=True)
    # Three broad gauges, large enough to survive the native render.
    # Flat neutral screen colours, without text, tiny icons or emission.
    def graphic(x0,y0,width,depth):
        f.poly([f.pt(x,y,panel_z-.90*(y-v)-.043) for x,y in
                ((x0,y0),(x0+width,y0),(x0+width,y0+depth),(x0,y0+depth))],UI,flip=True)
    graphic(u-.20,v-.13,.065,.19)
    graphic(u-.065,v-.04,.065,.10)
    graphic(u+.07,v-.09,.065,.15)
    # Two large tactile controls; no tiny labels or fabricated UI lettering.
    for du in (-.20,.20):
        f.m.paint('yellow' if du<0 else 'steel')
        points=outline(u+du,v+.17,.10,.085,.015)
        loops=[[f.pt(x,y,panel_z-.90*(y-v)+dz) for x,y in points] for dz in (-.008,.027)]
        bridge(f,*loops,COL);cap(f,loops[0][::-1]);cap(f,loops[1])


def pipe(f,path,r=.11):
    f.m.paint('pipe')
    from mathutils import Vector
    rings=[];previous=None
    for i,xyz in enumerate(path):
        tangent=(Vector(path[min(i+1,len(path)-1)])-Vector(path[max(i-1,0)])).normalized()
        # Transport the section frame through each bend instead of switching its
        # reference axis near vertical and twisting the faces between rings.
        a=previous-tangent*previous.dot(tangent) if previous is not None else Vector((0,0,0))
        if a.length<1e-5:
            axis=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
            a=tangent.cross(axis)
        a.normalize();previous=a.copy();b=tangent.cross(a).normalized();c=Vector(xyz)
        rings.append([f.pt(*(c+r*(a*math.cos(t)+b*math.sin(t))))
                      for t in (j*math.tau/12 for j in range(12))])
    for a,b in zip(rings,rings[1:]): bridge(f,a,b,COL)


def pipe_socket(f,centre,axis,r=.15,length=.12,bore=.105):
    f.m.paint('steel')
    from mathutils import Vector
    c=Vector(centre);d=Vector(axis).normalized()
    a=d.cross(Vector((0,0,1)) if abs(d.z)<.9 else Vector((1,0,0))).normalized()
    b=d.cross(a).normalized()
    def ring(offset,radius):
        return [f.pt(*(c+d*offset+radius*(a*math.cos(t)+b*math.sin(t))))
                for t in (i*math.tau/12 for i in range(12))]
    outer=[ring(x,r) for x in (-length/2,length/2)]
    inner=[ring(x,bore) for x in (-length/2,length/2)]
    bridge(f,*outer,COL)
    for i in (0,1): bridge(f,outer[i],inner[i],COL)


def vessel_port(f,p,angle,z,r):
    """Radial neck starts inside the shell; its flange seats on that neck.

    Return embedded, straight-seat and bend points, so the attached pipe's
    final straight segment stays coaxial with the complete fitting.
    """
    d=(math.cos(angle),math.sin(angle),0)
    def at(radius): return (p.vessel_u+d[0]*radius,p.vessel_v+d[1]*radius,z)
    pipe(f,[at(.76),at(1.05)],r=r+.025)
    pipe_socket(f,at(1.02),d,r=r+.045,length=.12,bore=r-.005)
    return at(.76),at(1.08),at(1.14)


def condenser(f,p):
    f.m.paint('frame')
    for u in (-.35,.57):
        case(f,u,p.condenser_v,0,.23,.40,.24,COL,.025,.04)
    case(f,.12,.67,.17,1.16,.76,.15,COL,.035,.10)
    # True spaces between cooling fins expose a narrower connected core.
    f.m.paint('dark')
    case(f,.12,p.condenser_v,.22,1.06,.20,.51,COL,.035,.06)
    f.m.paint('vessel')
    for z in (.20,.70): case(f,.12,p.condenser_v,z,1.16,.38,.09,COL,.025,.06)
    f.m.paint('steel')
    for i in range(p.condenser_fins):
        u=-.35+i*.92/(p.condenser_fins-1)
        case(f,u,p.condenser_v,.28,.065,.50,.42,COL,.012,.025)
    # Seat the upper return in the vessel wall below the pressure joint. Its
    # condenser end is inset from the header's end, with a supported top pad.
    inlet,straight,exposed=vessel_port(f,p,math.radians(120),.96,.11)
    port_u=.46
    f.m.paint('frame')
    case(f,port_u,p.condenser_v,.70,.36,.36,.14,COL,.025,.045)
    pipe(f,[inlet,straight,exposed,(-.47,p.condenser_v,1.08),(-.30,p.condenser_v,1.25),
            (.29,p.condenser_v,1.25),(port_u,p.condenser_v,1.08),
            (port_u,p.condenser_v,.94),(port_u,p.condenser_v,.72)])
    pipe_socket(f,(.02,p.condenser_v,1.25),(1,0,0))
    pipe_socket(f,(port_u,p.condenser_v,.86),(0,0,1))
    # A proper end collector supports the lower return's whole circular seat.
    # The connection exits the end face, above the foot and chassis, rather than
    # clipping across the thin header edge and radiator fins.
    f.m.paint('vessel')
    case(f,.62,p.condenser_v,.20,.24,.38,.36,COL,.025,.045)
    pipe_socket(f,(.76,p.condenser_v,.38),(1,0,0),r=.13,bore=.08)
    inlet,straight,exposed=vessel_port(f,p,math.radians(42),.49,.085)
    pipe(f,[(.63,p.condenser_v,.38),(.83,p.condenser_v,.38),(.90,p.condenser_v,.38),
            (1.02,.87,.38),(1.02,.69,.45),exposed,straight,inlet],.085)


def refinery_revision_b(p=VesselRefinery(),rotation=1):
    core.palette._data.update(GREY);core.palette._data.update(CONTROL_GREYS)
    core.palette._data.update(FINISH_PALETTE)
    assert rotation in (0,1,2,3)
    m=FinishMesh('refinery_b_vertical_vessel',finished=p.materials);f=RefineryFrame(m,rot=rotation,centre=(0,0))
    # One low cast chassis joins the feed, pressure vessel and discharge roots.
    case(f,-.02,p.vessel_v,0,3.00,1.56,.26,COL,.065,.26)
    for u in (-1.28,.75):
        for v in (p.vessel_v-.68,p.vessel_v+.68):
            case(f,u,v,0,.35,.36,.20,COL,.035,.06)
    vessel(f,p);feed(f,p);discharge(f,p);condenser(f,p)
    if p.terminal: operator_terminal(f,p)
    return [m.build()]
