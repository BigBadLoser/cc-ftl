"""Asset-local curved ducts, hollow surfaces and toroidal manifolds."""
import math
from mathutils import Vector


def sleeve(f, profile, mat, inner=False, sides=24, t0=0, t1=math.tau):
    """Open lathed surface along u. Profile entries are (u, radius, centre_z)."""
    n = max(1, round(sides*(t1-t0)/math.tau))
    def p(u, r, z, t):
        return f.pt(u, r*math.cos(t), z+r*math.sin(t))
    for (u, r, z), (a, b, c) in zip(profile, profile[1:]):
        for i in range(n):
            t, s = t0+(t1-t0)*i/n, t0+(t1-t0)*(i+1)/n
            f.poly([p(u,r,z,t),p(u,r,z,s),p(a,b,c,s),p(a,b,c,t)], mat, flip=not inner)


def annulus(f, a, b, ri, ro, z, mat="steelL", face="plate", v=0, sides=24):
    """Closed thick ring; includes the real inner bore."""
    def p(u, r, t):
        return f.pt(u, v+r*math.cos(t), z+r*math.sin(t))
    for i in range(sides):
        t, s = i*math.tau/sides, (i+1)*math.tau/sides
        faces = [([p(a,ro,t),p(a,ro,s),p(b,ro,s),p(b,ro,t)],mat),
                 ([p(b,ri,t),p(b,ri,s),p(a,ri,s),p(a,ri,t)],"steelD"),
                 ([p(b,ri,t),p(b,ro,t),p(b,ro,s),p(b,ri,s)],face),
                 ([p(a,ri,s),p(a,ro,s),p(a,ro,t),p(a,ri,t)],mat)]
        for pts, color in faces:
            f.poly(pts, color, flip=True)


def torus(f, u, v, z, major, minor, mat="gm", n=24, sides=8):
    def p(t, s):
        r = major+minor*math.cos(s)
        return f.pt(u+minor*math.sin(s), v+r*math.cos(t), z+r*math.sin(t))
    for i in range(n):
        t, a = i*math.tau/n, (i+1)*math.tau/n
        for j in range(sides):
            s, b = j*math.tau/sides, (j+1)*math.tau/sides
            f.poly([p(t,s),p(a,s),p(a,b),p(t,b)], mat, flip=True)


def curved_pipe(f, controls, radius, mat="gm", steps=5, sides=10):
    """Catmull-Rom sweep with parallel-transported circular sections."""
    cp = [Vector(p) for p in controls]
    cp = [cp[0]]+cp+[cp[-1]]
    points = []
    for p0,p1,p2,p3 in zip(cp,cp[1:],cp[2:],cp[3:]):
        for j in range(steps):
            t=j/steps
            points.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*0.5)
    points.append(cp[-1])
    rings=[]
    e1=Vector((0,0,1))
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        e1=e1-tangent*e1.dot(tangent)
        if e1.length<0.1:
            e1=tangent.cross(Vector((1,0,0)))
        e1.normalize()
        e2=tangent.cross(e1)
        rings.append([f.pt(*(p+radius*(e1*math.cos(j*math.tau/sides)+e2*math.sin(j*math.tau/sides)))) for j in range(sides)])
    for a,b in zip(rings,rings[1:]):
        for j in range(sides):
            k=(j+1)%sides
            f.poly([a[j],a[k],b[k],b[j]],mat,flip=True)
    f.poly(rings[0][::-1],mat,flip=True)
    f.poly(rings[-1],mat,flip=True)


def port_frame(f, u0, u1, z, ri=0.7, half=1.0, bottom=0.38, top=2.25):
    """Extruded rectangular armoured frame with a circular through-port."""
    angles={i*math.tau/32 for i in range(32)}
    for v in (-half,half):
        for h in (bottom-z,top-z):
            angles.add(math.atan2(h,v)%math.tau)
    ts=sorted(angles)
    def p(u,t,inside):
        c,s=math.cos(t),math.sin(t)
        r=ri if inside else min(half/max(abs(c),1e-9),
                               ((top-z) if s>=0 else (z-bottom))/max(abs(s),1e-9))
        return f.pt(u,r*c,z+r*s)
    for t,s in zip(ts,ts[1:]+[ts[0]+math.tau]):
        for pts,mat in [([p(u1,t,True),p(u1,t,False),p(u1,s,False),p(u1,s,True)],"steelL"),
                        ([p(u0,s,True),p(u0,s,False),p(u0,t,False),p(u0,t,True)],"steel"),
                        ([p(u0,t,False),p(u0,s,False),p(u1,s,False),p(u1,t,False)],"steel"),
                        ([p(u1,t,True),p(u1,s,True),p(u0,s,True),p(u0,t,True)],"dark")]:
            f.poly(pts,mat,flip=True)
