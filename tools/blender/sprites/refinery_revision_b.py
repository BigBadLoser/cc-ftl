"""Revision B: an integrated wedge refinery with a recessed loading crown.

One folded case joins the roller inlet, exposed side auger and forming outlet.
Functional openings retain the integrated shell rather than adding towers.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame
from .refinery_compact import bridge,case
from .refinery_blockout import COL,GREY


@dataclass(frozen=True)
class IntegratedRefinery:
    rear_u:float=-1.80
    front_u:float=1.76
    rear_roof:float=1.56
    inlet_back:float=-1.50
    inlet_front:float=-.62
    inlet_half_width:float=.49
    inlet_depth:float=.45
    lip_height:float=.075
    waist_depth:float=.18
    feed_rollers:bool=True
    process_screw:bool=True
    casting_bays:bool=True
    forming_collar:bool=True

    def spec(self): return asdict(self)


def section(p,u):
    """Continuous tapered body; w is the half-width, h the roof height."""
    stations=((p.rear_u,.70,.91),(p.inlet_back,1.04,p.rear_roof),
              (p.inlet_front,1.31,1.42),(.42,1.25,1.11),(1.17,.91,.75),(p.front_u,.68,.63))
    for a,b in zip(stations,stations[1:]):
        if a[0]<=u<=b[0]:
            t=(u-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t
    raise ValueError('Section outside body')


def outline(f,u,w,h):
    return [f.pt(u,v,z) for v,z in ((-w,.29),(-w*.73,.08),(w*.73,.08),(w,.29),
                                   (w,h-.30),(w*.62,h),(-w*.62,h),(-w,h-.30))]


def face(f,points): f.poly(points,COL,flip=True)


def inlet(f,p):
    # The actual roof opening sits within the same shell; no solid face below it.
    left,right=p.inlet_back,p.inlet_front
    x0,x1=left+.10,right-.10;v=p.inlet_half_width
    def roof(u): return section(p,u)[1]
    def pt(u,vv,dz=0): return f.pt(u,vv,roof(u)+dz)
    def half(u): return section(p,u)[0]*.62
    # Four surrounding roof strips, following the roof's slope and changing width.
    face(f,[pt(left,-half(left)),pt(x0,-half(x0)),pt(x0,half(x0)),pt(left,half(left))])
    face(f,[pt(x1,-half(x1)),pt(right,-half(right)),pt(right,half(right)),pt(x1,half(x1))])
    face(f,[pt(x0,-half(x0)),pt(x1,-half(x1)),pt(x1,-v),pt(x0,-v)])
    face(f,[pt(x0,v),pt(x1,v),pt(x1,half(x1)),pt(x0,half(x0))])
    opening=[pt(x0,-v),pt(x1,-v),pt(x1,v),pt(x0,v)]
    well_z=min(roof(x0),roof(x1))-p.inlet_depth
    well=[f.pt(u,vv,well_z) for u,vv in ((x0+.08,-v*.77),(x1-.08,-v*.77),(x1-.08,v*.77),(x0+.08,v*.77))]
    bridge(f,opening,well,COL);face(f,well[::-1])
    # An integral canted collar reinforces the opening instead of adding a hopper.
    outer=[pt(u,vv,p.lip_height) for u,vv in ((x0-.075,-v-.075),(x1+.075,-v-.075),(x1+.075,v+.075),(x0-.075,v+.075))]
    inner=[pt(u,vv,p.lip_height) for u,vv in ((x0,-v),(x1,-v),(x1,v),(x0,v))]
    bottom=[pt(u,vv) for u,vv in ((x0-.075,-v-.075),(x1+.075,-v-.075),(x1+.075,v+.075),(x0-.075,v+.075))]
    bridge(f,bottom,outer,COL);bridge(f,outer,inner,COL);bridge(f,inner,opening,COL)


def service_waist(f,p,u0,u1):
    # Broad recessed side geometry between the upper shoulder and lower frame.
    # Four boundary returns and the inset back form a genuine pocket.
    w0,h0=section(p,u0);w1,h1=section(p,u1)
    outer=[f.pt(u0,w0,.29),f.pt(u1,w1,.29),f.pt(u1,w1,h1-.30),f.pt(u0,w0,h0-.30)]
    inner=[f.pt(u0+.10,w0-p.waist_depth,.39),f.pt(u1-.10,w1-p.waist_depth,.39),
           f.pt(u1-.10,w1-p.waist_depth,h1-.40),f.pt(u0+.10,w0-p.waist_depth,h0-.40)]
    bridge(f,outer,inner,COL);face(f,inner)


def output(f,p,last):
    # The tapered case itself forms the die housing; the aperture is recessed.
    u=p.front_u
    inner=[f.pt(u,v,z) for v,z in ((-.50,.28),(-.36,.22),(.36,.22),(.50,.28),
                                  (.50,.47),(.36,.53),(-.36,.53),(-.50,.47))]
    bridge(f,last,inner,COL)
    back=[f.pt(u-.16,v,z) for v,z in ((-.50,.28),(-.36,.22),(.36,.22),(.50,.28),
                                      (.50,.47),(.36,.53),(-.36,.53),(-.50,.47))]
    bridge(f,inner,back,COL);face(f,back[::-1])
    case(f,u+.045,0,.115,.27,1.04,.09,COL,.025,.08)


def crushing_rollers(f,p):
    # Crosswise paired rollers sit inside the integral loading well.
    cross=Frame(f.m,rot=2,centre=(0,0))
    x0=p.inlet_back+.10;x1=p.inlet_front-.10
    for u in (x0+.17,x1-.17):
        z=section(p,u)[1]-.22
        cross.hcyl(-.40,.40,-u,z,.138,COL,sides=20,cap=COL,capstart=COL)
        for v in (-.34,-.17,0,.17,.34):
            cross.hcyl(v-.034,v+.034,-u,z,.158,COL,sides=10)


def processing_screw(f):
    # Coarse helical flight, not a decorative ring pattern. Visible in the side
    # service opening, its axis descends toward the forming die.
    from mathutils import Vector
    start=Vector((-.48,1.19,.73));end=Vector((.28,1.19,.54))
    direction=(end-start).normalized();a=Vector((0,1,0));b=direction.cross(a).normalized()
    def point(t,r,angle,offset=0):
        return f.pt(*(start+(end-start)*t+direction*offset+r*(a*math.cos(angle)+b*math.sin(angle))))
    rings=[[point(t,.10,i*math.tau/16) for i in range(16)] for t in (0,1)]
    bridge(f,*rings,COL);face(f,rings[0][::-1]);face(f,rings[1])
    flight=[]
    for i in range(73):
        t=i/72;angle=t*math.tau*3.5
        flight.append([point(t,r,angle,offset) for r,offset in
                       ((.10,-.012),(.17,-.012),(.17,.012),(.10,.012))])
    for r0,r1 in zip(flight,flight[1:]): bridge(f,r0,r1,COL)
    face(f,flight[0][::-1]);face(f,flight[-1])
    for t in (0,1):
        outer=[[point(t,.185,i*math.tau/16,offset) for i in range(16)] for offset in (-.035,.035)]
        bridge(f,*outer,COL)
        face(f,outer[0][::-1]);face(f,outer[1])


def casting_receiver(f,p):
    # Three aligned forming channels end in raised moulds. One cast billet in
    # the centre makes the material output legible even without paint or glow.
    u=p.front_u+.045
    for v in (-.33,0,.33):
        f.box(u,v,.205,.29,.29,.025,COL)
        for edge in (-1,1):
            f.box(u+edge*.145,v,.225,.025,.29,.065,COL)
            f.box(u,v+edge*.145,.225,.29,.025,.065,COL)
    for v in (-.165,.165): f.box(p.front_u-.025,v,.24,.075,.035,.27,COL)
    case(f,u,0,.235,.22,.21,.085,COL,.025,.03)


def die_collar(f,p):
    u=.79;half=.065
    inner=[outline(f,x,*section(p,x)) for x in (u-half,u+half)]
    outer=[]
    for x in (u-half,u+half):
        w,h=section(p,x);outer.append(outline(f,x,w+.045,h+.045))
    bridge(f,*outer,COL);bridge(f,inner[0],outer[0],COL);bridge(f,outer[1],inner[1],COL)


def refinery_revision_b(p=IntegratedRefinery()):
    core.palette._data.update(GREY)
    m=core.Mesh('refinery_revision_b_integrated');f=Frame(m,rot=1,centre=(0,0))
    xs=(p.rear_u,p.inlet_back,p.inlet_front,.42,1.17,p.front_u)
    rings=[outline(f,u,*section(p,u)) for u in xs]
    face(f,rings[0][::-1])
    for i,(a,b) in enumerate(zip(rings,rings[1:])):
        for j in range(8):
            if i==1 and j==5: continue  # Recessed inlet replaces this roof panel.
            if i==2 and j==3: continue  # Service pocket replaces this side panel.
            k=(j+1)%8;face(f,[a[j],a[k],b[k],b[j]])
    inlet(f,p);service_waist(f,p,xs[2],xs[3]);output(f,p,rings[-1])
    if p.feed_rollers: crushing_rollers(f,p)
    if p.process_screw: processing_screw(f)
    if p.casting_bays: casting_receiver(f,p)
    if p.forming_collar: die_collar(f,p)
    # Low, continuous mounting lip follows the tapered body in plan.
    for side in (-1,1):
        outer=[];inner=[]
        for u in xs:
            w,h=section(p,u)
            outer.append(f.pt(u,side*(w*.73+.045),0))
            inner.append(f.pt(u,side*w*.73,.11))
        for a,b,c,d in zip(outer,outer[1:],inner,inner[1:]):
            face(f,[a,b,d,c])
    return [m.build()]
