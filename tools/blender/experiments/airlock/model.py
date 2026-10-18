"""AIRLOCK / 01. One tile across, four deep. No accessory floor geometry.

u points OUT of the ship; rows 0,1,2,3 have u=1.5,.5,-.5,-1.5.
The row-0 door replaces the hull tile; its cross-section meets the hull skirt.
All exported objects share the front-most footprint tile's deck anchor.
"""
from sprites import core
from sprites.cmbkit import Frame
from sprites.detail import seg

WALL_Z = 1.85
SKIRT_Z = .38
HULL_HALF = 7 / 32
CENTRE = {0: (0, -1.5), 1: (-1.5, 0), 2: (0, -1.5), 3: (-1.5, 0)}
OPEN = .33
DOOR_TOP = 1.61
CHAMBER_MIN = -1.355
CHAMBER_MAX = 1.5-HULL_HALF
POSES = {"closed": 0, "opening.f0": .2, "opening.f1": .5,
         "opening.f2": .8, "open": 1}


def local(m, rot):
    return Frame(m, rot, centre=CENTRE[rot])


def outline(v, low, high, cut):
    return [(-v+cut, low), (v-cut, low), (v, low+cut),
            (v, high-cut), (v-cut, high), (-v+cut, high),
            (-v, high-cut), (-v, low+cut)]


def face(f, u, points, mat):
    f.poly([f.pt(u, v, z) for v, z in points], mat, flip=True)


def ring(f, u0, u1, outside, inside, mat, edge="steelL"):
    for u in (u0, u1):
        for i in range(8):
            j = (i+1) % 8
            face(f, u, [outside[i], outside[j], inside[j], inside[i]], mat)
    for profile, color in ((outside, edge), (inside, "dark")):
        for i in range(8):
            j = (i+1) % 8
            v0, z0 = profile[i]
            v1, z1 = profile[j]
            f.poly([f.pt(u0,v0,z0), f.pt(u1,v0,z0),
                    f.pt(u1,v1,z1), f.pt(u0,v1,z1)], color, flip=True)


def prism(f, profile, v0, v1, mat):
    """Closed extrusion of a u/z cross-section along v."""
    a = [f.pt(u,v0,z) for u,z in profile]
    b = [f.pt(u,v1,z) for u,z in profile]
    f.poly(a,mat,flip=True)
    f.poly(b[::-1],mat,flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],b[i],b[j],a[j]],mat,flip=True)


def threshold(f, u, heavy):
    # Only the narrow door threshold, not a floor slab beneath the module.
    f.box(u,0,.019,.35 if heavy else .27,.66,.025,"steelD",top="hazK")
    for k in range(6):
        v=-.31+k*.11
        reach=.17 if heavy else .13
        pts=[(u-reach,v,.047),(u+reach,v+.06,.047),
             (u+reach,min(.325,v+.115),.047),(u-reach,v+.055,.047)]
        f.poly([f.pt(*p) for p in pts],"hazY",flip=True)


def portal(rot, which):
    heavy=which=="outer"
    u=1.5 if heavy else -1.5
    m=core.Mesh("AIRLOCK_"+which+"_portal")
    f=local(m,rot)
    d=HULL_HALF if heavy else .145
    color="air.blue" if heavy else "air.rose"
    ring(f,u-d,u+d,outline(.5,.025,WALL_Z,.095),
         outline(OPEN,.025,DOOR_TOP,.075),color,"air.blueL" if heavy else "air.roseD")
    # Recessed continuous gasket and chamfered inner pressure land.
    ring(f,u-d-.008,u+d+.008,outline(.347,.023,1.65,.077),
         outline(.315,.027,1.595,.065),"dark","steelD")
    for s in (-1,1):
        # The hull-line skirt runs from +-0.5 at deck to +-7/32 at .38.
        profile=[(u-.5,0),(u+.5,0),(u+d,SKIRT_Z),(u-d,SKIRT_Z)]
        if heavy:
            prism(f,profile,s*.42-.08,s*.42+.08,"air.blue")
        else:
            prism(f,[(u-.25,0),(u+.25,0),(u+.145,.30),(u-.145,.30)],
                  s*.43-.07,s*.43+.07,"air.roseD")
        # Large, plain armour shoulders; warm ochre identifies the hull hatch.
        for side in (-1,1):
            uu=u+side*(d+.014)
            face(f,uu,[(s*.365,.42),(s*.475,.49),
                       (s*.475,1.54),(s*.365,1.60)],
                 "air.ochre" if heavy else "air.roseD")
            for z in (.51,1.49):
                seg(f,(uu,s*.417,z),(uu+side*.016,s*.417,z),
                    .025,"steelD",sides=6,cap="air.ivory")
        f.box(u,s*.425,1.05,2*d+.05,.07,.25,"steelD",top="air.blueL")
    # Broad header panel, no unreadable microtext.
    for side in (-1,1):
        uu=u+side*(d+.017)
        face(f,uu,[(-.31,1.68),(.31,1.68),(.27,1.78),(-.27,1.78)],
             "air.ochre" if heavy else "air.roseD")
        # A white entry chevron is paint, and remains visible with power off.
        face(f,uu+side*.002,[(-.12,1.745),(0,1.69),(.12,1.745),
                           (.08,1.765),(0,1.728),(-.08,1.765)],"air.ivory")
    threshold(f,u,heavy)
    return [m.build()]


def sidewall(rot, side):
    m=core.Mesh("AIRLOCK_chamber_side_"+str(side))
    f=local(m,rot)
    v=side*.42
    center=(CHAMBER_MIN+CHAMBER_MAX)/2
    length=CHAMBER_MAX-CHAMBER_MIN
    f.box(center,v,0,length,.14,1.68,"air.blue",top="air.blueL")
    # Integral toe recess and sloping pressure-wall skirt. Clear lane >= .66.
    for u in (-.69,.69):
        f.box(u,side*.408,0,1.20,.13,.20,"steelD",top="air.blue")
    for vv in (side*.347,side*.493):
        f.box(-.04,vv,.49,2.20,.006,.84,"air.blueL",top="air.blue")
        f.box(-.04,vv,1.40,2.22,.006,.065,"air.ivory")
        for u in (-1.08,1.03):
            f.box(u,vv,.37,.085,.012,1.26,"air.ochre")
    # Pressure hardware inside the sealed wall, no windows or open side panels.
    f.box(.42,v,.73,.46,.135,.45,"air.blueL",top="air.blue")
    for u in (.28,.40,.52):
        for vv in (side*.348,side*.493):
            f.box(u,vv,.81,.035,.006,.22,"dark")
    f.box(-.38,v,1.0,.30,.135,.30,"steelD",top="air.blueL")
    return [m.build()]


def roof(rot):
    """Opaque bevelled pressure shell, continuous between the two portals."""
    m=core.Mesh("AIRLOCK_sealed_roof")
    f=local(m,rot)
    cross=[(-.5,1.68),(-.38,1.85),(.38,1.85),(.5,1.68),
           (.35,1.68),(.28,1.73),(-.28,1.73),(-.35,1.68)]
    a=[f.pt(CHAMBER_MIN,v,z) for v,z in cross]
    b=[f.pt(CHAMBER_MAX,v,z) for v,z in cross]
    f.poly(a,"air.blue",flip=True)
    f.poly(b[::-1],"air.blue",flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],b[i],b[j],a[j]],"air.blueL" if i==1 else "air.blue",flip=True)
    for u in (-1.14,1.06):
        f.box(u,0,1.851,.13,.73,.006,"air.ochre",top="air.ochre")
    # Large painted entry chevrons remain visible without power.
    for u in (-.36,.18):
        points=[(u+.11,-.20),(u-.13,0),(u+.11,.20),
                (u+.17,.14),(u-.01,0),(u+.17,-.14)]
        f.poly([f.pt(uu,v,1.854) for uu,v in points],"air.ivory",flip=True)
    return [m.build()]


def frame(rot, mode="full"):
    # Wall controls affect adjacent hull only. This pressure tube never opens,
    # cuts down, ghosts, or reveals its chamber through its roof or sides.
    return portal(rot,"outer")+portal(rot,"inner")+sidewall(rot,-1)+sidewall(rot,1)+roof(rot)


def door(rot, which, opening=0):
    """Multi-track sliding pressure leaves. Retract within the 1-tile footprint.

    Outer: 3 interlocking steel leaves per side. Inner: 2 thinner leaves.
    Full open clears a .62-wide, 1.59-high passage. Nothing swings into crew.
    """
    m=core.Mesh("AIRLOCK_"+which+"_leaves")
    f=local(m,rot)
    heavy=which=="outer"
    u=1.5 if heavy else -1.5
    count=3 if heavy else 2
    width=OPEN/count
    for s in (-1,1):
        for i in range(count):
            v_closed=(i+.5)*width
            v=s*((1-opening)*v_closed+opening*(.327+width/2))
            # Each leaf has its own track through the thickness of the frame.
            uu=u+(i-(count-1)/2)*(.075 if heavy else .045)
            depth=.095 if heavy else .065
            f.box(uu,v,.055,depth,width+.013,1.525,
                  "air.blueL" if heavy else "air.roseD",top="steelL")
            for outward in (-1,1):
                face_u=uu+outward*(depth/2+.002)
                f.box(face_u,v,.22,.009,width*.76,1.18,"air.blue" if heavy else "steel")
                # Ochre inset locking bar, rose inner leaf with a quiet seam.
                f.box(face_u+outward*.006,v,.71,.012,width*.70,.24,
                      "air.ochre" if heavy else "air.rose")
                if i==0:
                    f.box(face_u+outward*.012,v,.91,.025,.04,.34,"air.ivory")
                    for z in (.39,1.30):
                        f.box(face_u+outward*.012,v,z,.03,.065,.08,"steelD")
    return [m.build()]


def lights(rot, state="sealed", phase=0):
    """Independent status/warning overlay; unpowered/broken are dark."""
    m=core.Mesh("AIRLOCK_status_"+state)
    f=local(m,rot)
    for which,u,depth in (("outer",1.5,HULL_HALF),("inner",-1.5,.145)):
        color="air.green" if state==which+"-open" else "red"
        if state in ("unpowered","broken"):
            continue
        for outward in (-1,1):
            for s in (-1,1):
                f.box(u+outward*(depth+.037),s*.425,1.09,.012,.048,.12,color)
    if state=="cycling":
        for s in (-1,1):
            for j,u in enumerate((-.92,-.55,.55,.92)):
                if j%2==phase:
                    f.box(u,s*.30,1.858,.22,.055,.012,"orange")
            for u,depth in ((1.5,HULL_HALF),(-1.5,.145)):
                for outward in (-1,1):
                    f.box(u+outward*(depth+.039),0,1.79,.014,.32,.04,"orange")
    if not m.v:
        return []
    return [m.build()]


def assembly(rot, mode="cut", state="sealed", opening=.5, phase=0):
    a=b=0
    if state.startswith("outer-"):
        a=1 if state=="outer-open" else opening
    if state.startswith("inner-"):
        b=1 if state=="inner-open" else opening
    # No assembly state can open both doors; blackout/failure always closes.
    obs=frame(rot,mode)+door(rot,"outer",a)+door(rot,"inner",b)
    return obs+lights(rot,state,phase)


def hull_tile(rot, v, cut=False):
    """Review-only colour-blocked hull, exact 1.85/.38 skirt cross-section."""
    m=core.Mesh("review_hull_"+str(v))
    f=local(m,rot)
    u=1.5
    prism(f,[(u-.5,0),(u+.5,0),(u+HULL_HALF,SKIRT_Z),
             (u-HULL_HALF,SKIRT_Z)],v-.5,v+.5,"air.blue")
    if not cut:
        f.box(u,v,SKIRT_Z,2*HULL_HALF,1,WALL_Z-SKIRT_Z,"air.blue",top="air.blueL")
        for outward in (-1,1):
            f.box(u+outward*(HULL_HALF+.003),v,.69,.008,.91,.44,"air.ochre")
            f.box(u+outward*(HULL_HALF+.009),v,1.64,.014,.96,.06,"air.blueL")
    return [m.build()]


def context(rot, mode="full", ghost_layer=False):
    obs=[]
    if not ghost_layer:
        # Ship floor is context only; no floor is part of any AIRLOCK export.
        m=core.Mesh("review_ship_deck")
        f=local(m,rot)
        for u in (-3,-2,-1,0,1):
            for v in (-2,-1,0,1,2):
                f.box(u+.5,v,-.065,.99,.99,.06,"plateA",top="plateB" if (u+v)%3 else "steel")
                if v==0 and u in (-1,0):
                    # Subtle standard deck seams: not part of the module.
                    f.box(u+.5,v,-.003,.86,.015,.004,"steelD")
        obs.append(m.build())
    if (mode!="ghost" and not ghost_layer) or ghost_layer:
        for v in (-2,-1,1,2):
            obs+=hull_tile(rot,v,cut=mode=="cut")
    return obs
