"""Distinct deployable roof projectors; supplied sprites have no baked ghost."""
import math
from mathutils import Vector
from sprites import core
from sprites.detail import seg
from geometry import frame,poly,octagon,hexagon,rim,clip,light,muted,hex_plate,ZR

POSES={
    "stowed":(0,0,0,0),
    "deploy.f0":(.25,0,0,0),
    "deploy.f1":(1,0,0,0),
    "deploy.f2":(1,.42,.05,0),
    "deploy.f3":(1,.83,.55,.10),
    "deploy.f4":(1,1,1,1),
    "deployed":(1,1,1,0),
    "active":(1,1,1,1),
}


def hatch(f,small,opening):
    # 63.15% coverage for BASTION, 58.62% for WARD, including the whole well.
    outer=hexagon(.95) if small else octagon(1.20,.80,.16)
    inner=hexagon(.68) if small else octagon(.99,.56,.12)
    rim(f,outer,inner)
    poly(f,[(*p,ZR-.15) for p in inner],"dark")
    if small:
        # Three radial iris leaves withdraw into the hexagonal collar.
        for k in range(3):
            i=2*k
            a=math.tau*(i+1)/6
            du,dv=.90*opening*math.cos(a),.90*opening*math.sin(a)
            points=[(du,dv)]+[(inner[j%6][0]+du,inner[j%6][1]+dv) for j in (i,i+1,i+2)]
            points=clip(points,inner)
            if len(points)>=3:
                poly(f,[(*p,ZR-.045*opening) for p in points],"steelL" if k==1 else "steel")
        # Pilot only: no painted identity-colour surface.
        light(f.m,lambda:f.vcyl(.80,0,ZR,.022,.001,"cyan",sides=6),.04)
    else:
        # Two banks of three nested armour shutters. No open upright doors.
        for s in (-1,1):
            for k in range(3):
                vc=s*((k+.5)*(.56/3)*(1-opening)+.68*opening)
                pts=[(-1.0,vc-.091),(1.0,vc-.091),(1.0,vc+.091),(-1.0,vc+.091)]
                pts=clip(pts,inner)
                if len(pts)>=3:
                    poly(f,[(*p,ZR-opening*(.035+k*.022)) for p in pts],"steelL" if k%2==0 else "steel")
        for u in (-1.09,1.09):
            light(f.m,lambda u=u:f.vcyl(u,0,ZR,.023,.001,"cyan",sides=6),.04)


def large(pose="active",rot=0):
    opening,rise,spread,power=POSES[pose]
    m=core.Mesh("BASTION_roof_"+pose)
    f=frame(m,False,rot)
    hatch(f,False,opening)
    if rise:
        z=ZR+.55*rise
        f.vcyl(0,0,ZR-.03,.28,.10,"steelD",top="steelL",sides=6)
        f.vcyl(0,0,ZR,.17,.55*rise,"steelL",top="steel",sides=6)
        # Central hex plus six hinged hexagonal petals, one coherent dish.
        hex_plate(f,(0,0,z),(1,0,0),(0,1,0),.27,.10,"steelD",True,.70 if power==1 else 0)
        angle=math.radians(80-60*spread)
        shape=[(0,0),(.13,-.225),(.39,-.225),(.52,0),(.39,.225),(.13,.225)]
        for k in range(6):
            a=k*math.tau/6
            radial=Vector((math.cos(a),math.sin(a),0))
            tangent=Vector((-math.sin(a),math.cos(a),0))
            def point(t,w,dz=0):
                return tuple(radial*(.25+t*math.cos(angle))+tangent*w+Vector((0,0,z+t*math.sin(angle)+dz)))
            A=[point(t,w,-.045) for t,w in shape]
            B=[point(t,w,0) for t,w in shape]
            for i in range(6):
                j=(i+1)%6
                poly(f,[A[i],A[j],B[j],B[i]],"steel")
            poly(f,A[::-1],"steelD")
            poly(f,B,"steelL")
            inset=[point(.26+(t-.26)*.82,w*.82,.005) for t,w in shape]
            muted(m,lambda inset=inset:poly(f,inset,"lens"),.055)
            emit=[point(.26+(t-.26)*.55,w*.55,.008) for t,w in shape]
            light(m,lambda emit=emit:poly(f,emit,"cyan"),.045 if power==1 else 0)
            # Small hinge ears, readable even when the lens is inactive.
            seg(f,point(0,-.11,-.035),point(0,.11,-.035),.045,"steelD",sides=6,cap="plate")
        light(m,lambda:f.vcyl(0,0,z+.009,.07,.022,"arc",sides=6),.20 if power==1 else 0,True)
    return [m.build()]


def small(pose="active",rot=0):
    opening,rise,spread,power=POSES[pose]
    m=core.Mesh("WARD_roof_"+pose)
    f=frame(m,True,rot)
    hatch(f,True,opening)
    if rise:
        z=ZR+.72*rise
        f.vcyl(0,0,ZR-.04,.23,.10,"steelD",top="steel",sides=6)
        f.vcyl(0,0,ZR,.15,.43*rise,"steelL",top="dark",sides=6)
        # A low central field lens between two tall telescoping pylon heads.
        centerz=ZR+.43*rise
        hex_plate(f,(0,0,centerz),(1,0,0),(0,1,0),.28,.08,"steel",True,.42 if power==1 else 0)
        for s in (-1,1):
            v=s*(.17+.40*spread)
            seg(f,(0,0,ZR+.07),(0,v,ZR+.16*rise),.07,"steelD",sides=6,cap="steelL")
            f.box(0,v,ZR+.08,.17,.15,max(.02,.72*rise-.08),"steel",top="plate")
            # Inward-curving field claws, rather than two forward-facing pods.
            # Their inner sections extend as the pylons separate.
            width=.25+.75*spread
            profile=[(-.20,-.12),(.11,-.16),(.12,.07),(-.02,.25),(-.24,.28),(-.26,.13)]
            lo=[(-.14,v+s*t*width,z+h) for t,h in profile]
            hi=[(.14,vv,zz) for u,vv,zz in lo]
            if s<0:
                lo,hi=lo[::-1],hi[::-1]
            poly(f,lo,"steelL")
            poly(f,hi[::-1],"steelL")
            for i in range(len(lo)):
                j=(i+1)%len(lo)
                poly(f,[lo[i],lo[j],hi[j],hi[i]],"steelD")
            # Short vertical coil face follows the claw; no barrel/muzzle read.
            light(m,lambda v=v,s=s:seg(f,(-.148,v-s*.15*width,z+.12),
                  (-.148,v-s*.13*width,z+.22),.024,"cyan",sides=4),.48 if power==1 else power*.12)
            light(m,lambda v=v,s=s:f.box(0,v-s*.10*width,z+.264,.10,.07,.012,"cyan",base=False),.12 if power==1 else 0)
    return [m.build()]


def context(small=False,wall=False):
    m=core.Mesh("review_wall" if wall else "review_roof")
    if wall:
        for x in (-1,0,1):
            m.box((x,-2.65,0),(.99,.19,2.34),"steel",base=True)
            m.box((x,-2.65,2.34),(1,.23,.06),"steelL",top="plate",base=True)
            for z in (.36,1.94):
                m.box((x,-2.544,z),(.91,.018,.055),"steelD",base=True)
    else:
        for x in (-1,0):
            for y in ((-1,0) if small else (-2,-1,0)):
                m.box((x,y,ZR-.08),(.995,.995,.08),"steelD",top="blueGrey",base=True)
    return [m.build()]
