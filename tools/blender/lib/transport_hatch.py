"""Opaque circular pressure hatch; no cabin interior or glowing indicators."""
import math
from lib.transport_forms import side_prism

HATCH_U,HATCH_Z=1.40,1.30
HATCH_RADIUS=.80
HATCH_OUTER=.92


def pressure_hatch(f):
    def ring(radius,v,u=HATCH_U,z=HATCH_Z):
        return [f.pt(u+radius*math.cos(i*math.tau/32),v,
                     z+radius*math.sin(i*math.tau/32)) for i in range(32)]
    def band(r0,v0,r1,v1,col,u=HATCH_U,z=HATCH_Z):
        a,b=ring(r0,v0,u,z),ring(r1,v1,u,z)
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

    # Opaque inspection porthole above the wheel, in a shallow pressure flange.
    band(.195,-1.079,.16,-1.103,"steelL",z=1.79)
    f.poly(ring(.16,-1.105,z=1.79),"glassD",flip=True)
    # Pressure-equalisation control and short pipe are distinct from the main handwheel.
    side_prism(f,[(.23,1.13),(.42,1.13),(.45,1.16),(.45,1.45),
                  (.42,1.48),(.23,1.48),(.20,1.45),(.20,1.16)],-1.052,-1.135,"steelL")
    f.box(.325,-1.14,1.37,.14,.014,.065,"steelD")
    band(.075,-1.139,.065,-1.16,"hazY",u=.325,z=1.255)
    f.poly(ring(.065,-1.161,u=.325,z=1.255),"steelD",flip=True)
    f.box(.325,-1.17,1.245,.105,.014,.022,"steelL")
    side_prism(f,[(.43,1.19),(.56,1.19),(.56,1.24),(.43,1.24)],-1.07,-1.105,"steelL")
