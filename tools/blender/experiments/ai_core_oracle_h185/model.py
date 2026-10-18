"""ORACLE: isolated 2x2 computer and folding roof sensor. Units are ship tiles."""
import math
from sprites import core
from sprites.cmbkit import Frame
from sprites.detail import seg, panel

WALL_Z = 1.85
ROOF_Z = 2.05
SOURCE_ROOF_Z = 2.4
# Keep the kick recess untouched; shorten the continuous upper casting.
BODY_FIT = (ROOF_Z - .40) / (SOURCE_ROOF_Z - .40)
CENTRE = (-0.5, -0.5)
POSES = {
    "stowed": (0, 0, 0, 0),
    "deploy.f0": (.25, 0, 0, 0),
    "deploy.f1": (.80, 0, 0, 0),
    "deploy.f2": (1, .48, .16, .2),
    "deploy.f3": (1, .88, .67, .6),
    "deploy.f4": (1, 1, 1, 1),
    "deployed": (1, 1, 1, 0),
    "active": (1, 1, 1, 1),
}


def paint(m, fn, strength=.42):
    """Palette magenta as real paint: absolutely no emission or glow."""
    start = len(m.f)
    fn()
    c = tuple(x * strength for x in core.lin("magenta"))
    for i in range(start, len(m.f)):
        m.f[i] = (m.f[i][0], c, (0, 0, 0), (0, 0, 0))


def light(m, fn, power):
    # Unpowered readouts are genuinely blank glass, not dim printed glyphs.
    if power <= 0:
        return
    start = len(m.f)
    fn()
    c = core.lin("magenta")
    for i in range(start, len(m.f)):
        ids = m.f[i][0]
        m.f[i] = (ids, tuple(x * .035 for x in c),
                  tuple(x * power * .55 for x in c), tuple(x * power for x in c))


def polygon(f, pts, mat):
    f.poly([f.pt(*p) for p in pts], mat, flip=True)


def octagon(a, b, cut=.14):
    return [(-a + cut, -b), (a - cut, -b), (a, -b + cut), (a, b - cut),
            (a - cut, b), (-a + cut, b), (-a, b - cut), (-a, -b + cut)]


def loft(f, rings, mats, cap="plate"):
    """Each ring is (z, [(u,v)...]); consistent closed, chamfered shells."""
    for k, ((za, A), (zb, B)) in enumerate(zip(rings, rings[1:])):
        for i in range(len(A)):
            j = (i + 1) % len(A)
            polygon(f, [(*A[i], za), (*A[j], za), (*B[j], zb), (*B[i], zb)], mats[k])
    polygon(f, [(*p, rings[0][0]) for p in rings[0][1]][::-1], mats[0])
    if cap:
        polygon(f, [(*p, rings[-1][0]) for p in rings[-1][1]], cap)


def aperture_frame(f, z=ROOF_Z):
    outer,inner=octagon(.80,.80,.12),octagon(.66,.54,.08)
    for i in range(8):
        j=(i+1)%8
        polygon(f,[(*outer[i],z),(*outer[j],z),
                   (*inner[j],z),(*inner[i],z)],"steelL")


def core_module(rot=0, active=False, revision=2, roof_part=False):
    m = core.Mesh("ORACLE_computer")
    f = Frame(m, rot, centre=CENTRE)
    # The casing itself reaches the deck. This is NOT an accessory floor slab.
    levels = [(0.02, .74, .73), (.16, .83, .81), (.40, .86, .82),
              (1.24, .70, .80), (1.76, .58, .69), (1.96, .37, .52)]
    if revision==2:
        # One continuous cast yoke, rather than a pod plus a second neck/collar.
        # The slight outward return at the ceiling is a structural shoulder.
        levels=[(0.02,.74,.73),(.16,.83,.81),(.40,.86,.82),
                (1.24,.70,.80),(1.76,.63,.73),(2.16,.59,.70),
                (2.34,.70,.72),(SOURCE_ROOF_Z,.80,.80)]
    loft(f, [(z, octagon(a, b)) for z, a, b in levels],
         ["dark", "steelD", "steel"]+["steelL"]*(len(levels)-4),
         "plate" if revision==1 else None)
    # Angled shoulders wrapping down both sides, broad enough to survive at 1x.
    for s in (-1, 1):
        # Follow the casing's two planar slopes, with a deliberate diagonal
        # break at the upper shoulder. Avoid accidental buried/intersecting paint.
        panels=[
            [(-.52,s*.831,.48),(.52,s*.831,.48),(.49,s*.812,1.24),(-.49,s*.812,1.24)],
            [(-.49,s*.812,1.24),(.49,s*.812,1.24),(.40,s*.716,1.69),(-.31,s*.716,1.69)],
        ]
        if revision==2:
            panels[1]=[(-.49,s*.812,1.24),(.49,s*.812,1.24),
                       (.41,s*.742,1.76),(-.39,s*.742,1.76)]
            panels.append([(-.39,s*.742,1.76),(.41,s*.742,1.76),
                           (.38,s*.713,2.13),(-.32,s*.713,2.13)])
        for pts in panels:
            paint(m, lambda pts=pts: polygon(f,pts if s>0 else pts[::-1],"magenta"),.46)
        # Two large service fasteners, one maintenance door, one data umbilical.
        for u, z, vv in ((-.45, .65, .84), (.30, 1.93, .73) if revision==2 else (.34,1.48,.75)):
            seg(f, (u,s*vv,z), (u,s*(vv+.035),z), .048, "steelD", 6, cap="plate")
        if s == 1:
            panel(f, .25, .847, .78, .49, .34, "steelD", face="+v", bolts=False)
            f.box(.25, .894, .79, .22, .025, .055, "plate", base=False)
            # Rearward connector chase stays inside the silhouette.
            for z in (.97, 1.12):
                seg(f, (.62,.78,z), (.39,.82,z), .046, "dark", cap="steelL")
    # Recessed front face: flat sloping display, with an armoured picture frame.
    def face(v,z,off=0):
        return ((-.93+.13*z if revision==2 else -1.03+.24*z)-off,v,z)
    perimeter = [(-.46,.43),(.46,.43),(.46,1.23),(.28,1.72),(-.28,1.72),(-.46,1.23)]
    if revision==2:
        perimeter=[(-.46,.43),(.46,.43),(.46,1.68),(.25,2.08),(-.25,2.08),(-.46,1.68)]
    polygon(f, [face(v,z) for v,z in perimeter], "steelD")
    inset = [(-.34,.55),(.34,.55),(.34,1.20),(.21,1.58),(-.21,1.58),(-.34,1.20)]
    if revision==2:
        inset=[(-.34,.55),(.34,.55),(.34,1.64),(.19,1.93),(-.19,1.93),(-.34,1.64)]
    polygon(f, [face(v,z,.012) for v,z in inset], "dark")
    # A sparse connected decision graph, rather than rack-like repeated slits.
    nodes = [(-.19,.80),(.16,.89),(-.11,1.17),(.10,1.43)]
    edges=((0,1),(0,2),(1,2),(2,3))
    if revision==2:
        # Restore the preferred v1 triangle and upward branch. Uniform scaling
        # retains the graphic's proportions inside the taller current window.
        nodes=[(v*1.15*BODY_FIT,.95+(z-.80)*1.15) for v,z in nodes]
    for a,b in edges:
        va,za=nodes[a]; vb,zb=nodes[b]
        light(m, lambda va=va,za=za,vb=vb,zb=zb:
              seg(f, face(va,za,.029),face(vb,zb,.029),.018,"magenta",sides=4),
              .32 if active else 0)
    for i,(v,z) in enumerate(nodes):
        p = [face(v,z+.074,.040),face(v+.065*BODY_FIT,z,.040),
             face(v,z-.074,.040),face(v-.065*BODY_FIT,z,.040)]
        light(m,lambda p=p:polygon(f,p,"magenta"), (1 if i==2 else .65) if active else 0)
    # Continuous bright brow and one secondary task-readout, no decorative noise.
    for s in (-1,1):
        paint(m,lambda s=s:polygon(f,[face(s*.38,.52,.015),face(s*.47,.52,.015),
                                    face(s*.47,1.22,.015),face(s*.38,1.22,.015)],"magenta"),.50)
    brow=1.99 if revision==2 else 1.64
    light(m,lambda:seg(f,face(-.18,brow,.025),face(.18,brow,.025),.026,"magenta",sides=4),.8 if active else 0)
    for j in range(3):
        z=.64+j*.10
        light(m,lambda j=j,z=z:seg(f,face(.10,z,.028),face(.26-j*.035,z,.028),.013,"magenta",sides=4),.5 if active else 0)
    # Narrow access latch. The old split crown now becomes a structural cradle
    # around a continuous mast well, physically connected to the ceiling hatch.
    f.box(-.889,0,.29,.04,.34,.065,"plate",base=False)
    if revision==1:
        loft(f,[(1.89,octagon(.40,.53,.10)),
                (2.16,octagon(.40,.53,.10)),
                (2.34,octagon(.70,.71,.12)),
                (SOURCE_ROOF_Z,octagon(.80,.80,.12))],
             ["steelD","steel","steelL"],None)
    polygon(f,[(*p,2.27) for p in octagon(.66,.54,.08)],"dark")
    if not roof_part:
        aperture_frame(f, SOURCE_ROOF_Z)
    if revision==1:
        for s in (-1,1):
            loft(f,[(1.89,[(u,v+s*.38) for u,v in octagon(.37,.16,.065)]),
                    (2.31,[(u+.12,v+s*.50) for u,v in octagon(.23,.13,.055)])],
                 ["steelL"],"plate")
            paint(m,lambda s=s:polygon(f,[(-.22,s*.553,1.98),(.27,s*.553,1.98),
                                         (.29,s*.637,2.29),(-.06,s*.637,2.29)],"magenta"),.40)
        f.box(-.421,0,2.01,.025,.37,.16,"dark")
        light(m,lambda:f.box(-.439,0,2.05,.015,.21,.045,"magenta"),.60 if active else 0)
    else:
        # A service rail interrupts the broad cheek without filling it with vents.
        for s in (-1,1):
            seg(f,(.48,s*.811,1.24),(.40,s*.716,2.12),.035,"steelD",sides=4)
    # Mesh-space adjustment before normal generation. Feet, footprint and
    # palette are unchanged. The graph's width is fitted above by the same
    # factor, preserving the preferred triangular graphic's aspect ratio.
    m.v=[(x,y,z if z<=.40 else .40+(z-.40)*BODY_FIT) for x,y,z in m.v]
    return [m.build()]


def roof_sensor(pose="active", rot=0, revision=2):
    opening,rise,spread,power = POSES[pose]
    m=core.Mesh("ORACLE_roof_"+pose)
    f=Frame(m,rot,centre=CENTRE)
    # Broad fixed target rim; three nested shutters on each side stack into
    # shallow pockets under it. Nothing stands up in front of the antenna.
    aperture_frame(f)
    polygon(f,[(*p,ROOF_Z-.10) for p in octagon(.66,.54,.08)],"dark")
    for side in (-1,1):
        # Permanent magenta frame panels retain the target's identity deployed.
        stripe=[(-.40,side*.61,ROOF_Z+.001),(.40,side*.61,ROOF_Z+.001),
                (.40,side*.74,ROOF_Z+.001),(-.40,side*.74,ROOF_Z+.001)]
        paint(m,lambda stripe=stripe,side=side:polygon(f,stripe if side>0 else stripe[::-1],"magenta"),.40)
        for k in range(3):
            vc=side*((k+.5)*.18*(1-opening)+.65*opening)
            z=ROOF_Z-opening*(.035+k*.022)
            # Clip the hidden portion to the well: under-roof leaves must not
            # reappear outside the roof when this becomes an overlay sprite.
            lo,hi=max(-.54,vc-.088),min(.54,vc+.088)
            if hi<=lo:
                continue
            # Crop corner positions to the chamfered well perimeter.
            def umax(v):
                return .66-max(0,abs(v)-.46)
            points=[(-umax(lo),lo,z),(umax(lo),lo,z),
                    (umax(hi),hi,z),(-umax(hi),hi,z)]
            polygon(f,points,"steelL" if k%2==0 else "steel")
            if k==1:
                vlo,vhi=max(lo,vc-.055),min(hi,vc+.055)
                paint(m,lambda vlo=vlo,vhi=vhi,z=z:polygon(f,
                      [(-.38,vlo,z+.001),(.38,vlo,z+.001),
                       (.38,vhi,z+.001),(-.38,vhi,z+.001)],"magenta"),.35)
    if rise>0:
        # Telescoping, keyed column. Geometry remains opaque; runtime ghosts it.
        h=.92*rise
        f.vcyl(0,0,ROOF_Z-.03,.24,.12,"steelD",top="steelL",sides=8)
        f.box(0,0,ROOF_Z,.21,.27,h,"steelL",top="plate",taper=.78)
        f.box(-.118,0,ROOF_Z+.03,.035,.12,max(.02,h-.05),"dark")
        z=ROOF_Z+h
        f.vcyl(0,0,z-.08,.28,.16,"steel",top="plate",sides=6)
        # Revision 1 explores a four-paddle crown. Revision 2 uses two broad
        # swept phased-array wings with two thinner orthogonal ranging booms.
        for axis in (0,1):
            for s in (-1,1):
                a=math.radians(82*(1-spread))
                direction=(math.cos(a),math.sin(a))
                length=.64*min(1,rise*1.8)
                end=s*(.19+length*direction[0])
                ez=z+length*direction[1]
                if axis==0:
                    start=(s*.15,0,z); tip=(end,0,ez)
                else:
                    start=(0,s*.15,z); tip=(0,end,ez)
                if revision==2 and axis==1:
                    def wing_pt(u,t,dz=0):
                        length=min(1,rise*1.8)
                        return (u,s*(.18+t*length*math.cos(a)),
                                z+t*length*math.sin(a)+.15*u+dz)
                    outline=[(-.25,0),(.16,0),(.35,.48),(.21,.68),(-.18,.68),(-.32,.49)]
                    A=[wing_pt(u,t,-.055) for u,t in outline]
                    B=[wing_pt(u,t,.018) for u,t in outline]
                    polygon(f,A[::-1] if s>0 else A,"steelD")
                    for i in range(len(A)):
                        j=(i+1)%len(A)
                        edge=[A[i],A[j],B[j],B[i]]
                        polygon(f,edge if s>0 else edge[::-1],"steelL")
                    polygon(f,B if s>0 else B[::-1],"plate")
                    inner=[wing_pt(u*.77,.32+(t-.32)*.78,.025) for u,t in outline]
                    polygon(f,inner if s>0 else inner[::-1],"dark")
                    # One substantial pink leading edge and a small tip beacon.
                    patch=[wing_pt(-.275,.43,.030),wing_pt(-.21,.43,.030),
                           wing_pt(-.12,.62,.030),wing_pt(-.185,.62,.030)]
                    paint(m,lambda patch=patch,s=s:polygon(f,patch if s>0 else patch[::-1],"magenta"),.50)
                    tip=wing_pt(.05,.65,.06)
                    light(m,lambda tip=tip:f.vcyl(tip[0],tip[1],tip[2],.055,.045,"magenta",sides=6),power*.85)
                    continue
                seg(f,start,tip,.075,"steelD",sides=4,cap="steelL")
                # Faceted sensing heads, rather than generic square rod ends.
                d=(tip[0]-start[0],tip[1]-start[1],tip[2]-start[2])
                mid=tuple(start[i]+d[i]*.75 for i in range(3))
                seg(f,mid,tip,.15 if revision==1 else .095,"steelL",sides=6,cap="dark")
                light(m,lambda tip=tip:f.vcyl(tip[0],tip[1],tip[2]+.02,.07,.05,"magenta",sides=6),power*.85)
        paint(m,lambda:f.vcyl(0,0,z+.08,.16,.045,"magenta",sides=6),.40)
        light(m,lambda:f.vcyl(0,0,z+.13,.075,.045,"magenta",sides=6),power)
    return [m.build()]


def context(kind):
    """Preview geometry only; never exported as part of a module sprite."""
    m=core.Mesh("review_"+kind)
    if kind=="wall":
        # Visible wall and roof plane intentionally have different heights.
        for x in (-1,0,1):
            m.box((x,-2.05,0),(.99,.19,WALL_Z-.06),"steel",base=True)
            m.box((x,-2.05,WALL_Z-.06),(1.0,.23,.06),"steelL",top="plate",base=True)
            m.box((x,-1.944,.36),(.91,.018,.055),"steelD",base=True)
            m.box((x,-1.944,WALL_Z-.46),(.91,.018,.065),"steelD",base=True)
    else:
        for x in (-1,0):
            for y in (-1,0):
                m.box((x,y,ROOF_Z-.08),(.995,.995,.08),"blueGrey",top="steel",base=True)
                m.box((x,y,ROOF_Z+.001),(.86,.86,.005),"steelD",top="blueGrey",base=True)
    return [m.build()]
