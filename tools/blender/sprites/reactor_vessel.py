"""Preview-first 4x3 armoured reactor. Origin: footprint centre, deck z=0.

Horizontal pressure vessel with four shell bays, structural hoops, recessed
sealed end caps and a bank of coolant/service cabinets. No floor slab.
The original 2x2 props.reactor and the game registry remain unchanged.
"""
import math
from . import core
from .cmbkit import Frame

FOOTPRINT=(4,3)
CV,CZ=-.25,.62


class VesselFrame(Frame):
    def __init__(self,mesh,rot):
        self.m,self.rot=mesh,1
        self.cx=self.cy=0
        self.c,self.s=math.cos(rot*math.pi/2),math.sin(rot*math.pi/2)

    def xy(self,u,v):
        return u*self.c-v*self.s,u*self.s+v*self.c


def arch(radius):
    return [(CV+radius*math.cos(i*math.pi/20),CZ+radius*math.sin(i*math.pi/20))
            for i in range(21)]+[(CV-radius,.16),(CV+radius,.16)]


def shell(f,u0,u1,radius,color,end="bD"):
    a=[f.pt(u0,v,z) for v,z in arch(radius)]
    b=[f.pt(u1,v,z) for v,z in arch(radius)]
    f.poly(a,end,flip=True)
    f.poly(b[::-1],end,flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],color,flip=True)


def patch(f,u0,u1,a0,a1,radius,color):
    """A flush plate following the curved pressure jacket."""
    n=max(1,round((a1-a0)/6))
    for i in range(n):
        aa=math.radians(a0+(a1-a0)*i/n)
        ab=math.radians(a0+(a1-a0)*(i+1)/n)
        f.poly([f.pt(u,CV+radius*math.cos(a),CZ+radius*math.sin(a))
                for u,a in ((u0,aa),(u1,aa),(u1,ab),(u0,ab))],color,flip=True)


def cap(f,side):
    """Heavy raised annulus, with an opaque dished service plate recessed inside."""
    def ring(u,r):
        return [f.pt(side*u,CV+r*math.cos(i*math.tau/32),.82+r*math.sin(i*math.tau/32))
                for i in range(32)]
    def band(u0,r0,u1,r1,col):
        a,b=ring(u0,r0),ring(u1,r1)
        for i in range(32):
            j=(i+1)%32
            f.poly([a[i],a[j],b[j],b[i]],col,flip=True)
    band(1.82,.76,1.94,.72,"bL")
    band(1.94,.72,1.96,.62,"bT")
    band(1.96,.62,1.855,.58,"dark")
    f.poly(ring(1.854,.581),"bK",flip=True)
    band(1.855,.51,1.875,.45,"steelL")
    f.poly(ring(1.875,.45),"bM",flip=True)
    band(1.876,.34,1.88,.32,"bT")
    for i in range(8):
        a=(i+.5)*math.tau/8
        v,z=CV+.672*math.cos(a),.82+.672*math.sin(a)
        f.hcyl(side*1.955,side*1.974,v,z,.027,"steelL",sides=8,cap="bH",capstart="bH")
    # Upper radial webbing ties the round pressure closure to the arch frame.
    for angle in (24,58,90,122,156):
        a=math.radians(angle)
        pts=[]
        for r,t in ((.77,-.032),(1.045,-.032),(1.045,.032),(.77,.032)):
            pts.append(f.pt(side*1.846,CV+r*math.cos(a)-t*math.sin(a),
                            .62+r*math.sin(a)+t*math.cos(a)))
        f.poly(pts,"bL",flip=True)


def pipe(f,u):
    points=[(.83,.56),(1.10,.49),(1.38,.35),(1.38,.20),(1.25,.13),(1.08,.16),(1.00,.30)]
    rings=[]
    for i,(v,z) in enumerate(points):
        a,b=points[max(0,i-1)],points[min(len(points)-1,i+1)]
        dv,dz=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dv,dz)
        rings.append([f.pt(u+.062*math.cos(t),v-.062*math.sin(t)*dz/length,
                           z+.062*math.sin(t)*dv/length)
                      for t in (j*math.tau/8 for j in range(8))])
    for k,(a,b) in enumerate(zip(rings,rings[1:])):
        for i in range(8):
            j=(i+1)%8
            f.poly([a[i],a[j],b[j],b[i]],"steelL" if k%3 else "steelD",flip=True)


def cabinet(f,u):
    # Inboard coolant tower and lower outboard pump face leave the hoses exposed.
    f.box(u,1.00,.10,.57,.54,.89,"bD",top="bL")
    f.box(u,1.20,.20,.51,.38,.54,"bT",top="bL")
    f.box(u,1.397,.28,.40,.016,.34,"dark")
    f.box(u,1.409,.31,.34,.012,.28,"bD")
    for z in (.36,.43,.50):
        f.box(u,1.422,z,.25,.012,.018,"steelL")
    f.box(u+.18,1.427,.58,.035,.014,.11,"bH")
    f.box(u,1.005,.994,.38,.32,.018,"bT",top="bL")
    pipe(f,u-.10)


def reactor_vessel(rot=0,active=True):
    """Prototype only. Long axis is grid +x at r0; all parts fit 4x3 tiles."""
    m=core.Mesh("reactor_vessel_"+("on" if active else "off"))
    f=VesselFrame(m,rot)
    shell(f,-1.84,1.84,1.025,"bD")
    boundaries=(-1.75,-.875,0,.875,1.75)
    for i,(a,b) in enumerate(zip(boundaries,boundaries[1:])):
        shell(f,a+.055,b-.055,1.045,"bT" if i%2==0 else "bL")
        # Paired ports and restrained maintenance latches on the upper jacket.
        c=(a+b)/2
        for du in (-.10,.10):
            patch(f,c+du-.047,c+du+.047,72,79,1.056,"dark")
            patch(f,c+du-.031,c+du+.031,73,77,1.059,"steelL")
        if i in (0,3):
            patch(f,c-.23,c+.23,88,96,1.061,"steelD")
            patch(f,c-.19,c-.07,89,94,1.066,"bH")
            patch(f,c+.07,c+.19,89,94,1.066,"bH")
            for du in (-.19,.19):
                f.box(c+du,CV,1.69,.065,.13,.03,"steelL",top="bH")
            f.box(c,CV,1.735,.40,.045,.035,"steelL",top="bH")
        else:
            patch(f,c-.17,c+.17,27,48,1.061,"dark")
            patch(f,c-.115,c+.115,32,44,1.067,"flameY" if active else "brass")
            patch(f,c-.16,c-.12,18,27,1.065,"bK")
            patch(f,c+.12,c+.16,18,27,1.065,"bK")
    for u in boundaries:
        shell(f,u-.045,u+.045,1.085,"bD",end="bD")
        shell(f,u-.024,u+.024,1.095,"bL",end="bT")
    for side in (-1,1):
        cap(f,side)
    for u in (-1.38,1.38):
        for v in (-1.05,.53):
            f.box(u,v,0,.43,.34,.20,"steelD",top="bD")
            f.box(u,v,.04,.34,.35,.04,"steelL")
    for u in (-1.02,0,1.02):
        cabinet(f,u)
    # A compact local controller at the service end.
    f.box(-1.65,1.05,.08,.38,.54,.63,"bM",top="bL")
    f.box(-1.65,1.33,.30,.27,.022,.25,"dark")
    f.box(-1.65,1.35,.46,.18,.01,.065,"hazY" if active else "brass")
    for u in (-1.73,-1.57):
        f.box(u,1.351,.25,.05,.018,.045,"steelL")
    return [m.build()]
