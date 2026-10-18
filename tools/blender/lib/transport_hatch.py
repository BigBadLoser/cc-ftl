"""Opaque circular pressure hatch; no cabin interior or glowing indicators."""
import math
from lib.transport_forms import side_prism

HATCH_U,HATCH_Z=1.40,1.30
HATCH_RADIUS=.80
HATCH_OUTER=.92


def pressure_hatch(f):
    def ring(radius,v):
        return [f.pt(HATCH_U+radius*math.cos(i*math.tau/32),v,
                     HATCH_Z+radius*math.sin(i*math.tau/32)) for i in range(32)]
    def band(r0,v0,r1,v1,col):
        a,b=ring(r0,v0),ring(r1,v1)
        for i in range(32):
            j=(i+1)%32
            f.poly([a[i],a[j],b[j],b[i]],col,flip=True)
    band(.92,-1.052,.86,-1.125,"gW1")
    band(.86,-1.125,.80,-1.125,"steelL")
    band(.80,-1.125,.80,-1.064,"steelD")
    f.poly(ring(.799,-1.065),"gW1",flip=True)
    # A shallow reinforcing dish and manual wheel make the sealed leaf read as pressure hardware.
    band(.66,-1.067,.61,-1.076,"steelL")
    f.poly(ring(.61,-1.076),"gW2",flip=True)
    band(.20,-1.079,.20,-1.155,"steelD")
    f.poly(ring(.20,-1.155),"steelL",flip=True)
    for i in range(8):
        a=(i+.5)*math.tau/8
        c,s=math.cos(a),math.sin(a)
        profile=[(HATCH_U+r*c+t*(-s),HATCH_Z+r*s+t*c)
                 for r,t in ((.79,-.05),(.92,-.05),(.92,.05),(.79,.05))]
        side_prism(f,profile,-1.125,-1.15,"steelD")
    for i in range(3):
        a=i*math.tau/3
        c,s=math.cos(a),math.sin(a)
        profile=[(HATCH_U+r*c+t*(-s),HATCH_Z+r*s+t*c)
                 for r,t in ((.04,-.035),(.24,-.035),(.24,.035),(.04,.035))]
        side_prism(f,profile,-1.155,-1.178,"steelL")
    # Hazard arcs belong to the lower pressure-ring segment, rather than a house-door sill.
    for i in range(6):
        a0=math.radians(222+i*17)
        a1=a0+math.radians(12)
        f.poly([f.pt(HATCH_U+r*math.cos(a),-1.153,HATCH_Z+r*math.sin(a))
                for r,a in ((.84,a0),(.90,a0),(.90,a1),(.84,a1))],
               "hazY" if i%2==0 else "hazK",flip=True)
