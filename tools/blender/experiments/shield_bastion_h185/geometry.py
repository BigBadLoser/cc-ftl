"""Shared, palette-native shield geometry. Runs inside Blender."""
import math
from mathutils import Vector
from sprites import core
from sprites.cmbkit import Frame

WALL_Z=1.85
ZR=2.05


def frame(m,small=False,rot=0):
    centre=(-.5,-.5) if small else ((-.5,-1) if rot%2==0 else (-1,-.5))
    return Frame(m,rot,centre=centre)


def footprint(small=False,rot=0):
    return [2,2] if small else ([2,3] if rot%2==0 else [3,2])


def poly(f,pts,col):
    f.poly([f.pt(*p) for p in pts],col,flip=True)


def octagon(a,b,c=.13):
    return [(-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),
            (a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c)]


def hexagon(r):
    return [(r*math.cos(k*math.tau/6),r*math.sin(k*math.tau/6)) for k in range(6)]


def loft(f,rings,mats,cap="steelL"):
    for k,((za,A),(zb,B)) in enumerate(zip(rings,rings[1:])):
        for i in range(len(A)):
            j=(i+1)%len(A)
            poly(f,[(*A[i],za),(*A[j],za),(*B[j],zb),(*B[i],zb)],mats[min(k,len(mats)-1)])
    poly(f,[(*p,rings[0][0]) for p in rings[0][1]][::-1],mats[0])
    if cap:
        poly(f,[(*p,rings[-1][0]) for p in rings[-1][1]],cap)


def muted(m,fn,strength=.13):
    """Muted dark teal housing, using the non-emissive palette lens albedo."""
    start=len(m.f)
    fn()
    c=tuple(v*strength for v in core.lin("lens"))
    for i in range(start,len(m.f)):
        m.f[i]=(m.f[i][0],c,(0,0,0),(0,0,0))


def light(m,fn,power=1,white=False):
    if power<=0:
        return
    start=len(m.f)
    fn()
    c=core.lin("arc" if white else "cyan")
    for i in range(start,len(m.f)):
        m.f[i]=(m.f[i][0],tuple(v*.012 for v in c),
                tuple(v*power*.30 for v in c),tuple(v*power for v in c))


def hex_plate(f,c,a,b,r,depth=.07,mat="steelL",lens=False,power=0):
    """Hexagonal puck on arbitrary local-plane basis a,b, with a recessed lens."""
    c,a,b=Vector(c),Vector(a),Vector(b)
    n=a.cross(b).normalized()
    ring=lambda rad,d:[tuple(c+a*(rad*math.cos(k*math.tau/6))+b*(rad*math.sin(k*math.tau/6))+n*d) for k in range(6)]
    A,B=ring(r,-depth),ring(r,0)
    for k in range(6):
        j=(k+1)%6
        poly(f,[A[k],A[j],B[j],B[k]],"steelD")
    poly(f,B,mat)
    if lens:
        muted(f.m,lambda:poly(f,ring(r*.80,.003),"lens"),.07)
        light(f.m,lambda:poly(f,ring(r*.64,.006),"cyan"),power)


def cells(f,c,a,b,r,pitch,active):
    """Exactly one central hex plus six neighbours; centre dominates the light."""
    c,a,b=Vector(c),Vector(a),Vector(b)
    hex_plate(f,c,a,b,r,.045,"steelD",True,.65 if active else 0)
    for k in range(6):
        angle=math.pi/6+k*math.tau/6
        p=c+a*(pitch*math.cos(angle))+b*(pitch*math.sin(angle))
        hex_plate(f,p,a,b,r*.87,.04,"steelD",True,.055 if active else 0)


def extrude_v(f,profile,halfwidth,col):
    A=[(u,-halfwidth,z) for u,z in profile]
    B=[(u,halfwidth,z) for u,z in profile]
    poly(f,A,col)
    poly(f,B[::-1],col)
    for i in range(len(A)):
        j=(i+1)%len(A)
        poly(f,[A[i],A[j],B[j],B[i]],col)


def clip(subject,boundary):
    """Clip a convex shutter to its well; buried hardware never overpaints roof."""
    out=list(subject)
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        start,out=out,[]
        def signed(p):
            return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
        if not start:
            break
        prev=start[-1]; dp=signed(prev)
        for p in start:
            d=signed(p)
            if (d>=0)!=(dp>=0):
                t=dp/(dp-d)
                out.append((prev[0]+t*(p[0]-prev[0]),prev[1]+t*(p[1]-prev[1])))
            if d>=0:
                out.append(p)
            prev,dp=p,d
    return out


def rim(f,outer,inner,z=ZR):
    for i in range(len(outer)):
        j=(i+1)%len(outer)
        poly(f,[(*outer[i],z),(*outer[j],z),(*inner[j],z),(*inner[i],z)],"steel")
