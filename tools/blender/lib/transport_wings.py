"""Broad full-chord folding wings for transport concept B, revision 4."""
import math

TRANSPORT_FOLD = math.pi
TRANSPORT_WING_SPAN = 7.2
TRANSPORT_WING = [(.30,.94),(.50,1.84),(-2.20,1.84),(-1.98,.94)]
TRANSPORT_OUTER_WING = [(.50,1.84),(-.65,3.60),(-1.92,3.60),(-2.20,1.84)]


def transport_wing(f,side,fold,livery=False):
    """Longitudinal hinges roll the outer panels flat onto the aft roof."""
    c,s=math.cos(fold),math.sin(fold)
    def pt(u,v,z,outer):
        if outer:
            dv,dz=v-1.84,z-2.385
            v,z=1.84+dv*c-dz*s,2.385+dv*s+dz*c+.185*math.sin(fold/2)
        return f.pt(u,side*v,z)
    for outer,points in enumerate((TRANSPORT_WING,TRANSPORT_OUTER_WING)):
        if livery:
            cu=sum(p[0] for p in points)/len(points)
            cv=sum(p[1] for p in points)/len(points)
            points=[(cu+(u-cu)*.84,cv+(v-cv)*.85) for u,v in points]
            f.poly([pt(u,v,2.455,outer) for u,v in points],"mkP",flip=True)
            if outer:
                # Underside paint becomes the visible top when the wing folds over.
                f.poly([pt(u,v,2.315,outer) for u,v in points[::-1]],"mkP",flip=True)
            continue
        a=[pt(u,v,2.32,outer) for u,v in points]
        b=[pt(u,v,2.45,outer) for u,v in points]
        f.poly(b,"gW1",flip=True)
        f.poly(a[::-1],"gW2",flip=True)
        for i in range(len(a)):
            j=(i+1)%len(a)
            f.poly([a[i],a[j],b[j],b[i]],"gW1",flip=True)
    if not livery:
        # Two visible hinge knuckles, tied into a continuous structural fold beam.
        f.hcyl(-2.08,.38,side*1.84,2.385,.055,"gW2",sides=8)
        for u in (-1.75,-.10):
            f.hcyl(u-.12,u+.12,side*1.84,2.385,.075,"steelL",sides=12)
