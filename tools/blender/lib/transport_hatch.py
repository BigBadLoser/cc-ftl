"""Opaque circular pressure hatch; no cabin interior or glowing indicators."""
import math
from lib.transport_forms import side_prism,FlightFrame

HATCH_U,HATCH_Z=1.40,1.30
HATCH_RADIUS=.80
HATCH_OUTER=.92
RIB_DEPTH=.015
RIB_COLOR="steelL"
NOSE_TAPER=.12
NOSE_LEAN=math.radians(6)
NOSE_LEAN_SLOPE=math.tan(NOSE_LEAN)


def nose_width(u):
    """Full nose side wall: inward taper starts at the cabin/canopy junction."""
    return 1.05-NOSE_TAPER*(u-.50)


class LeaningNoseFrame(FlightFrame):
    """Lean both nose walls inward, blending into the existing aft cabin."""
    def pt(self,u,v,z):
        blend=max(0,min(1,(u+.55)/1.05))
        v-=math.copysign(1,v)*NOSE_LEAN_SLOPE*(z-HATCH_Z)*blend
        return super().pt(u,v,z)


class TaperedHatchFrame(FlightFrame):
    """Rigid yaw and roll seat the round hatch on the tapered, leaning wall."""
    def pt(self,u,v,z):
        a=math.atan(NOSE_TAPER)
        b=math.atan(NOSE_LEAN_SLOPE/math.sqrt(1+NOSE_TAPER**2))
        c,s=math.cos(a),math.sin(a)
        cb,sb=math.cos(b),math.sin(b)
        du,dv,dz=u-HATCH_U,v+1.05,z-HATCH_Z
        across=dv*cb+dz*sb
        return super().pt(HATCH_U+du*c-across*s,-nose_width(HATCH_U)+du*s+across*c,
                          HATCH_Z-dv*sb+dz*cb)


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
    band(.24,-1.079,.15,-1.155,"steelD")
    f.poly(ring(.15,-1.155),"steelL",flip=True)
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
                 for r,t in ((.04,-.035),(.18,-.035),(.18,.035),(.04,.035))]
        side_prism(f,profile,-1.155,-1.178,"steelL")
    # Hazard arcs belong to the lower pressure-ring segment, rather than a house-door sill.
    for i in range(6):
        a0=math.radians(222+i*17)
        a1=a0+math.radians(12)
        f.poly([f.pt(HATCH_U+r*math.cos(a),-1.153,HATCH_Z+r*math.sin(a))
                for r,a in ((.84,a0),(.90,a0),(.90,a1),(.84,a1))],
               "hazY" if i%2==0 else "hazK",flip=True)


    # Six broad structural pressure ribs, distinct from the smaller operating wheel.
    for i in range(6):
        a=(i+.5)*math.tau/6
        c,s=math.cos(a),math.sin(a)
        profile=[(HATCH_U+r*c-t*s,HATCH_Z+r*s+t*c)
                 for r,t in ((.24,-.055),(.73,-.080),(.73,.080),(.24,.055))]
        side_prism(f,profile,-1.078,-1.078-RIB_DEPTH,RIB_COLOR)
