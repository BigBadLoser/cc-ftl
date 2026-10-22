"""Parametric reactor geometry study. No vents, bolts, labels, lights or finish.

Lengths are world/tile units. The detailed v1 reactor is preserved separately.
Historical passes retain their annular face; current passes use a separate
open arch and recessed circular closure.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .reactor_vessel import VesselFrame


@dataclass(frozen=True)
class ReactorShape:
    length:float=3.50
    radius_v:float=1.045
    radius_z:float=1.045
    centre_v:float=-.25
    spring_z:float=.62
    base_z:float=.16
    hoop_extra:float=.05
    hoop_width:float=.065
    end_overhang:float=.09
    port_radius:float=.62
    plate_radius:float=.58
    port_depth:float=-.12
    port_z:float=.82
    cabinet_u:tuple=(-1.02,0,1.02)
    cabinet_v:float=1.13
    cabinet_width:float=.57
    cabinet_depth:float=.54
    cabinet_bottom:float=.10
    cabinet_top:float=1.012
    controller_width:float=.38
    controller_depth:float=.50
    controller_u:float=-1.68
    controller_v:float=1.06
    controller_top:float=.73
    solid_hoops:bool=False
    frame_depth:float=0
    frame_width:float=.06
    port_lip_width:float=.04
    service_loops:bool=False
    end_frame_extra:float=0
    closed_frame_edges:bool=False
    open_end_arch:bool=False
    arch_band_width:float=.24
    connected_service_pipes:bool=False
    cabinet_outreach:float=0
    cabinet_extension_top:float=.59

    def spec(self):
        return asdict(self)


def profile(p,extra=0):
    return [(p.centre_v+(p.radius_v+extra)*math.cos(a),
             p.spring_z+(p.radius_z+extra)*math.sin(a))
            for a in (i*math.pi/24 for i in range(25))]+[
            (p.centre_v-p.radius_v-extra,p.base_z),(p.centre_v+p.radius_v+extra,p.base_z)]


def prism(f,u0,u1,points,col,close=(True,True)):
    a=[f.pt(u0,v,z) for v,z in points];b=[f.pt(u1,v,z) for v,z in points]
    if close[0]: f.poly(a,col,flip=True)
    if close[1]: f.poly(b[::-1],col,flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],col,flip=True)


def end_cap(f,p):
    if p.open_end_arch:
        return open_arch(f,p)
    u=p.length/2+p.end_overhang
    outline=profile(p,p.end_frame_extra)
    # Ray intersections produce an actual arch-to-circle annulus, without a face over the hole.
    inner=[];outer=[];back=[]
    for i in range(48):
        a=i*math.tau/48;cv,cz=math.cos(a),math.sin(a)
        hits=[]
        for (v0,z0),(v1,z1) in zip(outline,outline[1:]+outline[:1]):
            av,az=v0-p.centre_v,z0-p.port_z;dv,dz=v1-v0,z1-z0
            det=cv*dz-cz*dv
            if abs(det)<1e-8: continue
            t=(av*dz-az*dv)/det
            s=(av*cz-az*cv)/det
            if t>0 and -1e-6<=s<=1+1e-6: hits.append(t)
        radius=min(hits)
        assert radius>p.port_radius,"Port must fit inside the end-frame outline"
        outer.append(f.pt(u,p.centre_v+radius*cv,p.port_z+radius*cz))
        inner.append(f.pt(u,p.centre_v+p.port_radius*cv,p.port_z+p.port_radius*cz))
        back.append(f.pt(u-p.port_depth,p.centre_v+p.plate_radius*cv,p.port_z+p.plate_radius*cz))
    if p.frame_depth:
        # True pockets in the external cage, with a sealed bulkhead behind them.
        for i in range(48):
            j=(i+1)%48
            def at(index,radius,depth=0):
                a=index*math.tau/48
                return f.pt(u-depth,p.centre_v+radius*math.cos(a),p.port_z+radius*math.sin(a))
            def radii(index):
                a=index*math.tau/48
                # Derive the arch ray length from the existing outer-ring points.
                point=outer[index%48]
                # rot=0: Blender y is the negative of grid v.
                return math.hypot(-point[1]-p.centre_v,point[2]-p.port_z)
            ri,rj=radii(i),radii(j)
            if p.closed_frame_edges:
                f.poly([outer[i],outer[j],at(j,rj,p.frame_depth),at(i,ri,p.frame_depth)],"steel",flip=True)
            f.poly([at(i,ri,p.frame_depth),at(j,rj,p.frame_depth),
                    at(j,p.port_radius,p.frame_depth),at(i,p.port_radius,p.frame_depth)],"steel",flip=True)
            opened=i<24 and i%4!=0 and min(ri,rj)>p.port_radius+p.port_lip_width+p.frame_width+.025
            if opened:
                oi,oj=ri-p.frame_width,rj-p.frame_width
                lip=p.port_radius+p.port_lip_width
                f.poly([at(i,ri),at(j,rj),at(j,oj),at(i,oi)],"steelL",flip=True)
                f.poly([at(i,lip),at(j,lip),inner[j],inner[i]],"steelL",flip=True)
                f.poly([at(i,oi),at(j,oj),at(j,oj,p.frame_depth),at(i,oi,p.frame_depth)],"steel",flip=True)
                f.poly([at(i,lip),at(j,lip),at(j,lip,p.frame_depth),at(i,lip,p.frame_depth)],"steel",flip=True)
                for k,r in ((i,oi),(j,oj)):
                    f.poly([at(k,r),at(k,lip),at(k,lip,p.frame_depth),at(k,r,p.frame_depth)],"steel",flip=True)
            else:
                f.poly([outer[i],outer[j],inner[j],inner[i]],"steelL",flip=True)
            f.poly([inner[i],inner[j],back[j],back[i]],"steelD",flip=True)
    else:
        for i in range(48):
            j=(i+1)%48
            f.poly([outer[i],outer[j],inner[j],inner[i]],"steelL",flip=True)
            f.poly([inner[i],inner[j],back[j],back[i]],"steelD",flip=True)
    f.poly(back,"steel",flip=True)


def open_arch(f,p):
    """Freestanding U-frame: no plate across its centre or beneath the plug.

    Two continuous rails and seven radial webs bound six actual open windows.
    The pressure closure is a separate recessed circular component.
    """
    u=p.length/2+p.end_overhang
    rv=p.radius_v+p.end_frame_extra;rz=p.radius_z+p.end_frame_extra
    band=p.arch_band_width;rail=p.frame_width
    def point(a,t,depth=0):
        return f.pt(u-depth,p.centre_v+(rv-band*t)*math.cos(a),
                    p.spring_z+(rz-band*t)*math.sin(a))
    def strip(a,b,t0,t1):
        front=[point(a,t0),point(b,t0),point(b,t1),point(a,t1)]
        back=[point(a,t0,p.frame_depth),point(b,t0,p.frame_depth),
              point(b,t1,p.frame_depth),point(a,t1,p.frame_depth)]
        f.poly(front,"steelL",flip=True);f.poly(back[::-1],"steel",flip=True)
    for i in range(48):
        a=i*math.pi/48;b=(i+1)*math.pi/48
        strip(a,b,0,rail/band);strip(a,b,1-rail/band,1)
        # Only each window's boundary receives a sidewall, never its subdivisions.
        for t in (0,rail/band,1-rail/band,1):
            f.poly([point(a,t),point(b,t),point(b,t,p.frame_depth),
                    point(a,t,p.frame_depth)],"steel",flip=True)
    for angle in (0,30,60,90,120,150,180):
        a=max(0,math.radians(angle)-.027);b=min(math.pi,math.radians(angle)+.027)
        strip(a,b,rail/band,1-rail/band)
        for theta in (a,b):
            f.poly([point(theta,rail/band),point(theta,1-rail/band),
                    point(theta,1-rail/band,p.frame_depth),point(theta,rail/band,p.frame_depth)],"steel",flip=True)
    for sign in (-1,1):
        f.box(u-p.frame_depth/2,p.centre_v+sign*(rv-band/2),p.base_z,
              p.frame_depth,band,p.spring_z-p.base_z,"steelL",top="steel")
    # Independent circular pressure closure, with a real rim and tapered throat.
    circles=[]
    for depth,radius in ((p.frame_depth*.65,p.port_radius+.055),
                         (p.frame_depth*.65,p.port_radius),
                         (p.frame_depth+p.port_depth,p.plate_radius)):
        circles.append([f.pt(u-depth,p.centre_v+radius*math.cos(i*math.tau/48),
                             p.port_z+radius*math.sin(i*math.tau/48)) for i in range(48)])
    for a,b in zip(circles,circles[1:]):
        for i in range(48):
            j=(i+1)%48
            f.poly([a[i],a[j],b[j],b[i]],"steel",flip=True)
    f.poly(circles[-1],"steelD",flip=True)


def service_connections(p,u):
    """Exact centreline endpoints shared by pipe and flange geometry."""
    face=p.cabinet_v+p.cabinet_depth/2+p.cabinet_outreach
    pipe_u=u-.07;flange_v=face+.10;flange_top=.07
    path=[(face-.01,.46),(face+.10,.43),(face+.16,.34),
          (face+.16,.23),(flange_v,.16),(flange_v,flange_top)]
    return pipe_u,flange_v,flange_top,path


def service_loop(f,p,u):
    v=p.cabinet_v
    path=[(v-.12,.46),(v+.10,.38),(v+.23,.24),(v+.23,.12),
          (v+.16,.08),(v+.04,.08),(v,.16)]
    pipe_u=u-.20
    if p.connected_service_pipes:
        pipe_u,flange_v,flange_top,path=service_connections(p,u)
    rings=[]
    for i,(vv,z) in enumerate(path):
        a,b=path[max(0,i-1)],path[min(len(path)-1,i+1)]
        dv,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dv,dz)
        rings.append([f.pt(pipe_u+.055*math.cos(t),vv-.055*math.sin(t)*dz/length,
                           z+.055*math.sin(t)*dv/length) for t in (k*math.tau/10 for k in range(10))])
    for a,b in zip(rings,rings[1:]):
        for i in range(10):
            j=(i+1)%10
            f.poly([a[i],a[j],b[j],b[i]],"steel",flip=True)
    if p.connected_service_pipes:
        f.poly(rings[0],"steel",flip=True);f.poly(rings[-1][::-1],"steel",flip=True)
        f.vcyl(pipe_u,flange_v,.015,.12,flange_top-.015,"steelD",top="steelL",sides=24)
    else:
        f.vcyl(u-.20,v+.14,.015,.14,.045,"steelD",top="steelL",sides=16)


def build_blockout(p=ReactorShape()):
    m=core.Mesh("reactor_geometry_blockout");f=VesselFrame(m,0)
    end=p.length/2
    front=end+p.end_overhang-(p.frame_depth if p.open_end_arch else 0)
    prism(f,-end-p.end_overhang,front,profile(p),"steelL",close=(True,False))
    for i in range(5):
        if p.open_end_arch and i==4:
            continue
        u=-end+i*p.length/4
        prism(f,u-p.hoop_width/2,u+p.hoop_width/2,profile(p,p.hoop_extra),"steel",close=(False,False))
        if p.solid_hoops:
            for uu in (u-p.hoop_width/2,u+p.hoop_width/2):
                a=[f.pt(uu,v,z) for v,z in profile(p)]
                b=[f.pt(uu,v,z) for v,z in profile(p,p.hoop_extra)]
                for k in range(len(a)):
                    j=(k+1)%len(a)
                    f.poly([a[k],a[j],b[j],b[k]],"steel",flip=True)
    end_cap(f,p)
    for u in p.cabinet_u:
        f.box(u,p.cabinet_v,p.cabinet_bottom,p.cabinet_width,p.cabinet_depth,
              p.cabinet_top-p.cabinet_bottom,"steel",top="plate")
        if p.cabinet_outreach:
            face=p.cabinet_v+p.cabinet_depth/2
            f.box(u,face+p.cabinet_outreach/2,p.cabinet_bottom,p.cabinet_width,
                  p.cabinet_outreach,p.cabinet_extension_top-p.cabinet_bottom,"steel",top="plate")
        if p.service_loops:
            service_loop(f,p,u)
        else:
            f.box(u,p.cabinet_v,.02,.24,.28,max(.03,p.cabinet_bottom-.02),"steelD")
    f.box(p.controller_u,p.controller_v,.07,p.controller_width,p.controller_depth,p.controller_top-.07,"steel",top="plate")
    for u in (-end+.35,end-.35):
        for v in (p.centre_v-.68,p.centre_v+.68):
            f.box(u,v,0,.28,.26,.18,"steelD")
    return [m.build()]


def landmarks(p):
    from . import core
    arc=profile(p,p.hoop_extra)[:25]
    def screen(u,v,z):
        x,y=core.screen_xy(core.G(u,v,z));return [float(x),float(-y)]
    peak=min(arc,key=lambda point:screen(0,*point)[1])
    front_peak=min(profile(p,p.end_frame_extra)[:25],key=lambda point:screen(0,*point)[1])
    out={"rear_peak":screen(-p.length/2,*peak),"front_peak":screen(p.length/2+p.end_overhang,*front_peak),
         "port_center":screen(p.length/2+p.end_overhang-p.port_depth-(p.frame_depth if p.open_end_arch else 0),p.centre_v,p.port_z)}
    out["controller"]=screen(p.controller_u,p.controller_v,p.controller_top)
    for i,u in enumerate(p.cabinet_u):
        out[f"cabinet_{i+1}"]=screen(u,p.cabinet_v,p.cabinet_top)
    return out
