"""Swept, tapered full-chord wings for transport concept B, revision 5."""
import math

TRANSPORT_FOLD = math.pi
TRANSPORT_WING_SPAN = 7.2
TRANSPORT_WING = [(.22,.94),(-.08,1.84),(-2.48,1.84),(-2.05,.94)]
TRANSPORT_OUTER_WING = [(-.08,1.84),(-1.12,3.60),(-2.24,3.60),(-2.48,1.84)]


def transport_wing(f,side,fold,livery=False):
    """Thick inboard roots carry thinner outboard panels over longitudinal hinges."""
    c,s=math.cos(fold),math.sin(fold)
    def pt(u,v,z,outer):
        if outer:
            dv,dz=v-1.84,z-2.385
            v,z=1.84+dv*c-dz*s,2.385+dv*s+dz*c+.185*math.sin(fold/2)
        return f.pt(u,side*v,z)
    def lower(v,outer):
        return 2.32 if outer else 2.04+.28*(v-.94)/.90
    def upper(v,outer):
        return 2.45-.07*(v-1.84)/1.76 if outer else 2.36+.09*(v-.94)/.90
    for outer,points in enumerate((TRANSPORT_WING,TRANSPORT_OUTER_WING)):
        if livery:
            cu=sum(p[0] for p in points)/len(points)
            cv=sum(p[1] for p in points)/len(points)
            points=[(cu+(u-cu)*.84,cv+(v-cv)*.85) for u,v in points]
            f.poly([pt(u,v,upper(v,outer)+.005,outer) for u,v in points],"mkP",flip=True)
            if outer:
                f.poly([pt(u,v,lower(v,outer)-.005,outer) for u,v in points[::-1]],"mkP",flip=True)
            continue
        a=[pt(u,v,lower(v,outer),outer) for u,v in points]
        b=[pt(u,v,upper(v,outer),outer) for u,v in points]
        f.poly(b,"gW1",flip=True)
        f.poly(a[::-1],"gW2",flip=True)
        for i in range(len(a)):
            j=(i+1)%len(a)
            f.poly([a[i],a[j],b[j],b[i]],"gW1",flip=True)
    if not livery:
        # Continuous fold beam, two deep knuckles and positive locking blocks.
        f.hcyl(-2.38,-.13,side*1.84,2.385,.045,"steelD",sides=8)
        for u in (-2.13,-.37):
            f.hcyl(u-.14,u+.14,side*1.84,2.385,.075,"steelL",sides=12)
            f.box(u,side*1.79,2.445,.17,.10,.018,"steelD",top="steelL")
