"""Angled rear loading ramp, kept opaque even in the lowered mechanism preview."""
import math

REAR_SLOPE=-.2866666667
REAR_BASE_U=-1.72
RAMP_HINGE_U=REAR_BASE_U+(.64-.60)*REAR_SLOPE-.028
RAMP_HINGE_Z=.64
RAMP_LENGTH=1.48


def rear_u(z):
    return REAR_BASE_U+(z-.60)*REAR_SLOPE


def loading_ramp(f,opening=0):
    # Fixed angled aperture surround; a dark opaque cap masks the cabin at all times.
    def fixed(v,z,offset=0):
        return f.pt(rear_u(z)-.014-offset,v,z)
    f.poly([fixed(-.54,.70),fixed(.54,.70),fixed(.54,2.03),fixed(-.54,2.03)],"dark",flip=True)
    for v0,v1,z0,z1 in ((-.66,-.54,.63,2.12),(.54,.66,.63,2.12),(-.54,.54,2.03,2.12)):
        f.poly([fixed(v0,z0,.006),fixed(v1,z0,.006),fixed(v1,z1,.006),fixed(v0,z1,.006)],"steelL",flip=True)
    closed=math.atan2(1,REAR_SLOPE)
    # The open ramp reaches ground level from the landing-gear datum.
    down=math.pi+math.asin((RAMP_HINGE_Z-.024)/RAMP_LENGTH)
    angle=closed+(down-closed)*max(0,min(1,opening))
    du,dz=math.cos(angle),math.sin(angle)
    def pt(v,t,n=0):
        return f.pt(RAMP_HINGE_U+t*du-n*dz,v,RAMP_HINGE_Z+t*dz+n*du)
    def panel(v0,v1,t0,t1,n,col):
        f.poly([pt(v0,t0,n),pt(v1,t0,n),pt(v1,t1,n),pt(v0,t1,n)],col,flip=True)
    # A closed solid, including side edges and reinforced upper/lower skins.
    panel(-.53,.53,0,RAMP_LENGTH,.026,"gW1")
    panel(.53,-.53,0,RAMP_LENGTH,-.026,"steelD")
    for v in (-.53,.53):
        f.poly([pt(v,0,-.026),pt(v,RAMP_LENGTH,-.026),pt(v,RAMP_LENGTH,.026),pt(v,0,.026)],"steelL",flip=True)
    for t in (0,RAMP_LENGTH):
        f.poly([pt(-.53,t,-.026),pt(.53,t,-.026),pt(.53,t,.026),pt(-.53,t,.026)],"steelL",flip=True)
    panel(-.44,.44,.09,RAMP_LENGTH-.09,.030,"plate")
    for v0,v1 in ((-.47,-.43),(.43,.47)):
        panel(v0,v1,.08,RAMP_LENGTH-.08,.045,"steelL")
    for i in range(6):
        panel(-.41,.41,.20+i*.19,.23+i*.19,.039,"steelD")
    panel(-.12,.12,RAMP_LENGTH-.21,RAMP_LENGTH-.12,.048,"steelD")
    for i in range(6):
        panel(-.48+i*.16,-.33+i*.16,.035,.085,.044,"hazY" if i%2==0 else "hazK")
    # Traction ribs on the inner walking face become visible when lowered.
    panel(.44,-.44,.09,RAMP_LENGTH-.09,-.030,"plate")
    for i in range(6):
        panel(.41,-.41,.20+i*.19,.23+i*.19,-.042,"steelL")
    for v0,v1 in ((-.43,-.47),(.47,.43)):
        panel(v0,v1,.08,RAMP_LENGTH-.08,-.045,"steelL")
    # Hinge barrel along v, segmented into three heavy knuckles.
    for v0,v1 in ((-.64,-.37),(-.16,.16),(.37,.64)):
        rings=[]
        for v in (v0,v1):
            rings.append([f.pt(RAMP_HINGE_U+.06*math.cos(i*math.tau/12),v,
                               RAMP_HINGE_Z+.06*math.sin(i*math.tau/12)) for i in range(12)])
        for i in range(12):
            j=(i+1)%12
            f.poly([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],"steelL",flip=True)
        f.poly(rings[0],"steelD",flip=True)
        f.poly(rings[1][::-1],"steelD",flip=True)
