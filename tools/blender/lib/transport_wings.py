"""Swept aircraft-like wings with a pitched folding axis, concept B revision 7."""
import math

TRANSPORT_FOLD=math.pi
TRANSPORT_WING_SPAN=7.2
TRANSPORT_WING_PITCH=math.radians(-6)
PITCH_U,PITCH_Z=-1.20,2.385
TRANSPORT_WING=[(.30,.94),(-.15,1.84),(-2.45,1.84),(-2.05,.94)]
TRANSPORT_OUTER_WING=[(-.15,1.84),(-1.95,3.60),(-2.45,3.60),(-2.45,1.84)]
# Highest stored metal edge after the complete assembly is pitched six degrees.
TRANSPORT_HEIGHT=PITCH_Z+(-2.45-PITCH_U)*math.sin(TRANSPORT_WING_PITCH)+(.250)*math.cos(TRANSPORT_WING_PITCH)


def transport_wing(f,side,fold,livery=False):
    """Broad roots, strongly swept narrow tips; the complete assembly rakes up aft."""
    c,s=math.cos(fold),math.sin(fold)
    def pt(u,v,z,outer):
        if outer:
            dv,dz=v-1.84,z-2.385
            v,z=1.84+dv*c-dz*s,2.385+dv*s+dz*c+.185*math.sin(fold/2)
        return f.pt(u,side*v,z,pitch=TRANSPORT_WING_PITCH,pu=PITCH_U,pz=PITCH_Z)
    def lower(v,outer):
        return 2.32 if outer else 2.04+.28*(v-.94)/.90
    def upper(v,outer):
        return 2.45-.07*(v-1.84)/1.76 if outer else 2.36+.09*(v-.94)/.90
    for outer,points in enumerate((TRANSPORT_WING,TRANSPORT_OUTER_WING)):
        if livery:
            cu=sum(p[0] for p in points)/len(points)
            cv=sum(p[1] for p in points)/len(points)
            points=[(cu+(u-cu)*.90,1.87 if outer and v<2 else 1.81 if not outer and v>1.5
                     else cv+(v-cv)*.88) for u,v in points]
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
        # Hinges share the wing's attitude; the B5 nacelle/rest geometry is unchanged.
        kw=dict(pitch=TRANSPORT_WING_PITCH,pu=PITCH_U,pz=PITCH_Z)
        f.hcyl(-2.38,-.20,side*1.84,2.385,.045,"steelD",sides=8,**kw)
        for u in (-2.13,-.42):
            f.hcyl(u-.14,u+.14,side*1.84,2.385,.075,"steelL",sides=12,**kw)
            f.box(u,side*1.79,2.445,.17,.10,.018,"steelD",top="steelL",**kw)
