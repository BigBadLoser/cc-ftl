"""Opaque circular pressure hatch; no cabin interior or glowing indicators."""
import math
from lib.transport_forms import side_prism,FlightFrame,section

HATCH_U,HATCH_Z=1.40,1.30
HATCH_RADIUS=.80
HATCH_OUTER=.92
RIB_DEPTH=.015
RIB_COLOR="steelL"
NOSE_TAPER=.12
NOSE_OUTWARD_LEAN=math.radians(6)
NOSE_LEAN_SLOPE=-math.tan(NOSE_OUTWARD_LEAN)


def nose_width(u):
    """Full nose side wall: inward taper starts at the cabin/canopy junction."""
    return 1.05-NOSE_TAPER*(u-.50)


class LeaningNoseFrame(FlightFrame):
    """Keep B11's upper edge, then slope outward from a narrower base."""
    def __init__(self,mesh,heading,stations):
        super().__init__(mesh,heading)
        self.stations=stations

    def interval(self,u):
        for a,b in zip(self.stations,self.stations[1:]):
            if u<=b[0]:
                return a,b,max(0,min(1,(u-a[0])/(b[0]-a[0])))
        return self.stations[-2],self.stations[-1],1

    def shift(self,u):
        a,b,t=self.interval(u)
        top=lambda row:row[2]+row[3]*row[5]
        upper=top(a)+(top(b)-top(a))*t
        blend=max(0,min(1,(u+.55)/1.05))
        return 2*math.tan(NOSE_OUTWARD_LEAN)*(upper-HATCH_Z)*blend

    def local_v(self,u,v,z):
        blend=max(0,min(1,(u+.55)/1.05))
        return v-math.copysign(1,v)*(NOSE_LEAN_SLOPE*(z-HATCH_Z)*blend+self.shift(u))

    def pt(self,u,v,z):
        return super().pt(u,self.local_v(u,v,z),z)

    def side_width(self,u,z):
        # Intersect the actual loft cross-section, including its roof/chin bevels.
        a,b,t=self.interval(u)
        ra,rb=section(*a[1:4],*a[5:7]),section(*b[1:4],*b[5:7])
        ring=[(self.local_v(u,va+(vb-va)*t,za+(zb-za)*t),za+(zb-za)*t)
              for (va,za),(vb,zb) in zip(ra,rb)]
        z=max(min(z,max(p[1] for p in ring)),min(p[1] for p in ring))
        hits=[]
        for (v0,z0),(v1,z1) in zip(ring,ring[1:]+ring[:1]):
            if abs(z1-z0)>1e-8 and min(z0,z1)-1e-7<=z<=max(z0,z1)+1e-7:
                hits.append(abs(v0+(v1-v0)*(z-z0)/(z1-z0)))
        return max(hits)


class TaperedHatchFrame(FlightFrame):
    """Keep a rigid round hatch seated on the narrower, outward-flared wall."""
    def __init__(self,mesh,heading,profile):
        super().__init__(mesh,heading)
        self.profile=profile
        slope=NOSE_TAPER+(profile.shift(HATCH_U+.92)-profile.shift(HATCH_U-.92))/1.84
        a=math.atan(slope)
        b=math.atan(NOSE_LEAN_SLOPE/math.sqrt(1+slope*slope))
        self.yc,self.ys=math.cos(a),math.sin(a)
        self.rc,self.rs=math.cos(b),math.sin(b)
        self.centre_v=-nose_width(HATCH_U)+profile.shift(HATCH_U)
        # Fit the entire flange outside the hull; a short sleeve seals its back.
        gaps=[]
        for i in range(32):
            a=i*math.tau/32
            u,v,z=self.local(HATCH_U+.92*math.cos(a),-1.052,HATCH_Z+.92*math.sin(a))
            gaps.append(v+profile.side_width(u,z))
        self.centre_v-=max(gaps)+.004

    def local(self,u,v,z):
        du,dv,dz=u-HATCH_U,v+1.05,z-HATCH_Z
        across=dv*self.rc+dz*self.rs
        return (HATCH_U+du*self.yc-across*self.ys,self.centre_v+du*self.ys+across*self.yc,
                HATCH_Z-dv*self.rs+dz*self.rc)

    def pt(self,u,v,z):
        return super().pt(*self.local(u,v,z))

    def mounting_sleeve(self):
        inner,outer=[],[]
        for i in range(32):
            a=i*math.tau/32
            u,v,z=self.local(HATCH_U+.92*math.cos(a),-1.052,HATCH_Z+.92*math.sin(a))
            outer.append(super().pt(u,v,z))
            inner.append(super().pt(u,-self.profile.side_width(u,z)+.015,z))
        for i in range(32):
            j=(i+1)%32
            self.poly([inner[i],inner[j],outer[j],outer[i]],"gW1",flip=True)


def pressure_hatch(f):
    if hasattr(f,"mounting_sleeve"):
        f.mounting_sleeve()
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
