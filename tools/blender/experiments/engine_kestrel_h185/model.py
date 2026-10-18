"""KESTREL: a split-keel, annular-feed propulsion assembly. Experimental art.

One continuous chamber, integrated feed ring, swept ducts and a petal jacket.
u points outboard. The 4x5 footprint and two-layer engine contract are fixed.
"""
import math
from sprites import core, detail as D, greeble as G
import hull_walls as walls
from sprites.cmbkit import Frame
from geometry import annulus, curved_pipe, sleeve, torus
from cassette import heavy_bed, armoured_powerhead, integrated_services

BZ=1.42
WALL_Z=1.85
ROOF_Z=2.05
THRUST_Z=1.30
CASSETTE_Z_FIT=.66
CENTRE={0:(-1.5,-2),1:(-2,-1.5),2:(-1.5,-2),3:(-2,-1.5)}


def prism(f,shape,a,b,mat="steel",top="steelL"):
    """Extrude a deliberate u/z outline across v, including both end faces."""
    n=len(shape)
    A=[f.pt(u,a,z) for u,z in shape]
    B=[f.pt(u,b,z) for u,z in shape]
    f.poly(A,mat,flip=True)
    f.poly(B[::-1],mat,flip=True)
    for i in range(n):
        j=(i+1)%n
        f.poly([A[i],B[i],B[j],A[j]],top if shape[j][0]>shape[i][0] else mat,flip=True)


def petal(f,profile,t0,t1,mat="steelL",thick=0.05):
    """Closed jacket stave, with a recessed underlying surface at its edges."""
    sleeve(f,profile,mat,sides=48,t0=t0,t1=t1)
    inner=[(u,r-thick,z) for u,r,z in profile]
    sleeve(f,inner,"steelD",inner=True,sides=48,t0=t0,t1=t1)
    for t in (t0,t1):
        for (u,r,z),(a,b,c) in zip(profile,profile[1:]):
            f.poly([f.pt(u,r*math.cos(t),z+r*math.sin(t)),
                    f.pt(a,b*math.cos(t),c+b*math.sin(t)),
                    f.pt(a,(b-thick)*math.cos(t),c+(b-thick)*math.sin(t)),
                    f.pt(u,(r-thick)*math.cos(t),z+(r-thick)*math.sin(t))],"steelD",flip=True)
    for (u,r,z),reverse in ((profile[0],False),(profile[-1],True)):
        for j in range(4):
            a=t0+(t1-t0)*j/4
            b=t0+(t1-t0)*(j+1)/4
            pts=[f.pt(u,q*math.cos(t),z+q*math.sin(t))
                 for q,t in ((r,a),(r,b),(r-thick,b),(r-thick,a))]
            f.poly(pts,"plate" if reverse else "steelD",flip=True)


def sculpted_stave(f,profile,t0,t1,mat,relief=1.0):
    """A shallow peaked casting, without contrasting decorative rail strips."""
    cross=((-1,-0.015),(-0.75,0.01),(0,0.06),(0.75,0.01),(1,-0.015))
    def ring(u,r,z):
        scale=relief(u) if callable(relief) else relief
        return [f.pt(u,(r+d*scale)*math.cos((t0+t1)/2+x*(t1-t0)/2),
                       z+(r+d*scale)*math.sin((t0+t1)/2+x*(t1-t0)/2)) for x,d in cross]
    rings=[ring(*p) for p in profile]
    for A,B in zip(rings,rings[1:]):
        for j in range(4):
            f.poly([A[j],A[j+1],B[j+1],B[j]],mat,flip=True)
    for side in (0,-1):
        theta=t0 if side==0 else t1
        for i,((u,r,z),(a,b,c)) in enumerate(zip(profile,profile[1:])):
            f.poly([rings[i][side],rings[i+1][side],
                    f.pt(a,(b-0.065)*math.cos(theta),c+(b-0.065)*math.sin(theta)),
                    f.pt(u,(r-0.065)*math.cos(theta),z+(r-0.065)*math.sin(theta))],"steelD",flip=True)
    for end in (rings[0],rings[-1]):
        # The backing jacket closes these low relief caps.
        f.poly(end,"steelD",flip=True)


def hull(rot,stage=1,holdout=False):
    objects=[]
    f=Frame(core.Mesh("unused"),rot,centre=CENTRE[rot])
    for v in (-1.5,1.5):
        ob=walls.block(5 if rot%2 else 10,"hull",full=True)[0]
        x,y=f.xy(2,v)
        ob.location=core.G(x,y,0)
        objects.append(ob)
    m=core.Mesh("KESTREL_armoured_bulkhead")
    f=Frame(m,rot,centre=CENTRE[rot])
    # Full-height armour shoulders meet the exact production end pieces.
    for side in (-1,1):
        f.box(2,side*0.81,0,2*walls.WT,0.38,walls.HF,"steel",top="steelL")
        prism(f,[(1.5,0),(1.5,0.04),(2-walls.WT,walls.H),
                 (2+walls.WT,walls.H),(2.5,0.04),(2.5,0)],
              side*0.6,side*1.0,"steelD","steelD")
        f.box(2.22,side*0.82,0.45,0.04,0.28,0.4,"blueGrey",top="steel")
    f.box(2,0,0,2*walls.WT,1.24,BZ-0.57,"steelD",top="steel")
    # Compact circular bearing instead of a tall rectangular bridge.
    bearing_start=len(m.v)
    annulus(f,1.81,2.26,0.555,0.75,BZ,"steel","steelL",sides=32)
    annulus(f,2.26,2.35,0.55,0.64,BZ,"steelD","brass",sides=32)
    for k in range(8):
        t=k*math.tau/8+math.pi/8
        G.disc(f,"+u",0.69*math.cos(t),BZ+0.69*math.sin(t),2.27,
               0.045,0,0.04,"steelD",sides=6)
    # Lower the circular hull bearing with the nozzle. Vertical wall faces and
    # deck-reaching armour below the bearing keep the full 1.85 wall profile.
    for i,(x,y,z) in enumerate(m.v):
        if i>=bearing_start:
            m.v[i]=(x,y,z+THRUST_Z-BZ)
    objects.append(m.build())
    for ob in objects:
        ob.is_holdout=holdout
    return objects


def bed(f,stage):
    if stage>=5:
        heavy_bed(f,stage)
        return
    # Low continuous thrust box, cut away at the inboard corners.
    f.box(-0.53,0,0.03,3.8,3.42,0.12,"steelD",top="plateA")
    for side in (-1,1):
        v=side*1.08
        shape=[(-2.25,0.17),(-2.25,0.47),(-1.45,0.9),
               (-0.25,0.84),(0.8,0.51),(1.55,0.31),(1.55,0.17)]
        prism(f,shape,v-0.18,v+0.18,"navy","steelL")
        # Large recessed cheek follows the load beam, not a separate cabinet.
        prism(f,[(-1.92,0.34),(-1.45,0.68),(-0.32,0.65),(0.76,0.36)],
              v+side*0.185,v+side*0.2,"steelD","steelD")
        for u in (-2.16,1.18):
            f.box(u,side*1.58,0.16,0.32,0.34,0.14,"steel",top="plate")
            G.disc(f,"z",u,side*1.58,0.3,0.07,0,0.055,"steelD",sides=6)
        for u in (-1.75,-0.42,0.68):
            G.disc(f,"+v" if side>0 else "-v",u,0.47,v+side*0.2,
                   0.045,0,0.035,"plate",sides=6)


def chamber_radius(u):
    p=[(-2.15,0.48),(-1.97,0.68),(-1.45,0.72),(-0.85,0.68),
       (0.05,0.59),(0.8,0.47),(1.45,0.38),(1.84,0.39),(2.4,0.54)]
    for (a,r),(b,s) in zip(p,p[1:]):
        if a<=u<=b:
            return r+(s-r)*(u-a)/(b-a)
    return p[0][1] if u<p[0][0] else p[-1][1]


def powerhead(f,stage):
    if stage>=5:
        armoured_powerhead(f,stage)
        return
    us=(-2.15,-1.97,-1.45,-0.85,0.05,0.8,1.45,1.84,2.4)
    sleeve(f,[(u,chamber_radius(u),BZ) for u in us],"steelD",sides=32)
    f.hcyl(-2.17,-2.15,0,BZ,0.48,"steel",sides=16,capstart="blueGrey")
    if stage>=3:
        # The integrated pump has one broad upper casting and a dark lower
        # gearbox belly, making the injector a designed head rather than a drum.
        petal(f,[(-2.06,0.64,BZ),(-1.86,0.76,BZ),(-1.57,0.8,BZ)],
              0.24,math.pi-0.24,"blueGrey",thick=0.07)
        for v in (-0.35,0.35):
            D.seg(f,(-2.02,v,1.78),(-1.76,v,2.02),0.052,"brass",8,cap="brass")
    # Annular turbine casing is part of the injector head. No isolated drums.
    torus(f,-1.5,0,BZ,0.74,0.13,"steelL",n=32)
    annulus(f,-1.69,-1.6,0.61,0.85,BZ,"gmD","brass",sides=32)
    for k in range(8):
        t=k*math.tau/8
        G.disc(f,"-u",0.76*math.cos(t),BZ+0.76*math.sin(t),-1.7,
               0.045,0,0.04,"steelD",sides=6)
    # Four long chamber shields; the open channels expose cooling returns.
    for k in range(4):
        t=k*math.pi/2
        profile=[(u,chamber_radius(u)+0.035,BZ) for u in (-1.35,-0.75,0.1,0.75,1.35)]
        petal(f,profile,t+0.15,t+math.pi/2-0.15,"blueGrey" if k==0 else "steel")
    for u in (-0.98,0.48):
        annulus(f,u,u+0.075,chamber_radius(u)-0.01,chamber_radius(u)+0.075,
                BZ,"steelD","steelL",sides=32)
    # Dorsal injector cover flows into a tapering armoured spine.
    spine=([(-2.08,1.79),(-1.84,2.28),(-0.83,2.24),(0.2,2.08),
            (0.92,1.94),(1.2,1.79),(0.92,1.58),(-1.78,1.7)] if stage>=2 else
           [(-2.08,1.79),(-1.84,2.17),(-0.83,2.13),(0.2,1.91),
            (0.92,1.7),(0.92,1.58),(-1.78,1.7)])
    prism(f,spine,-0.19,0.19,"navy","blueGrey" if stage>=3 else "steelL")
    f.box(-1.74,0,2.28 if stage>=2 else 2.17,0.45,0.23,0.05,"steelD",top="plate")
    if stage>=2:
        # Recessed injector access hub with three cast radial bridge pieces.
        annulus(f,-2.24,-2.16,0.22,0.49,BZ,"steelD","steel",sides=24)
        f.hcyl(-2.245,-2.24,0,BZ,0.225,"dark",sides=16,capstart="dark")
        for k in range(3):
            t=k*math.tau/3+math.pi/2
            petal(f,[(-2.27,0.48,BZ),(-2.17,0.5,BZ)],t-0.14,t+0.14,"steelL",thick=0.19)
            G.disc(f,"-u",0.37*math.cos(t),BZ+0.37*math.sin(t),-2.28,
                   0.045,0,0.03,"brass",sides=6)
    # Paired swan-neck discharge ducts define the engine silhouette.
    for side in (-1,1):
        curved_pipe(f,[(-1.51,side*0.61,1.86),(-1.24,side*0.94,2.3),
                       (-0.6,side*0.91,2.47),(0.18,side*0.67,2.22),
                       (0.98,side*0.34,1.89),(1.37,side*0.2,1.78)],
                    0.13,"gm" if side>0 else "steelL",steps=5,sides=12)
        D.seg(f,(-1.51,side*0.61,1.86),(-1.44,side*0.7,2.0),
              0.185,"brass",12,cap="steelL",capstart="steelL")
        D.flange(f,(1.37,side*0.2,1.78),"u",0.19,"brass",t=0.1)
        # Three closely grouped return tubes follow the same structural sweep.
        for k in range(3):
            v=side*(0.88+k*0.12)
            if stage>=4:
                angle=(k-1)*0.2
                pts=[]
                for u,clearance in ((-1.58,0.11),(-1.1,0.13),(-0.35,0.13),
                                    (0.45,0.13),(1.12,0.12),(1.57,0.03)):
                    r=chamber_radius(u)+clearance
                    pts.append((u,side*r*math.cos(angle),BZ+r*math.sin(angle)))
            else:
                pts=[(-1.58,v,1.29),(-1.11,v,1.24),(-0.32,v*0.87,1.2),
                     (0.54,v*0.63,1.15),(1.43,side*0.34,1.28+k*0.09)]
            curved_pipe(f,pts,0.047,"brass" if k==1 else "steelL",steps=4,sides=8)
    annulus(f,1.51,1.64,0.33,0.49,BZ,"steelL","steel",sides=24)


def services(f,stage,hot):
    if stage>=5:
        integrated_services(f,stage,hot)
        return
    # Two mirrored feed galleries are cast into the keels. Their low profile
    # supports the main chamber and leaves its outline dominant.
    for side in (-1,1):
        v=side*1.39
        prism(f,[(-1.55,0.32),(-1.55,0.59),(-0.98,0.82),
                 (0.16,0.66),(0.53,0.34)],v-0.2,v+0.2,"navy","blueGrey")
        curved_pipe(f,[(-1.5,side*0.72,1.16),(-1.74,side*1.16,0.96),
                       (-1.47,side*1.5,0.84),(-0.66,side*1.54,0.92),
                       (0.31,side*1.2,0.85),(0.76,side*0.48,1.19)],
                    0.105,"steelL",steps=5,sides=10)
        D.flange(f,(-0.66,side*1.54,0.92),"u",0.16,"brass",t=0.1)
        G.valve_wheel(f,"+v" if side>0 else "-v",-0.82,0.65,side*1.61,r=0.11)
        # Short inclined gimbal links follow the thrust path into the throat.
        a=(0.6,side*1.04,0.37)
        b=(1.6,side*0.37,1.16)
        D.seg(f,a,b,0.09,"steelD",10,cap="steelL")
        D.seg(f,(0.94,side*0.81,0.64),b,0.045,"plate",10,cap="plate")
    # Flush service panel, not a separate competing box.
    D.panel(f,-1.83,1.08,0.77,0.32,0.31,"steelD",bolts=False)
    f.box(-1.86,1.08,0.8,0.07,0.19,0.025,"cyan" if hot else "lens")


def bell_radius(u,stage=5):
    t=max(0,min(1,(u-2.36)/1.52))
    if stage>=7:
        # A distinct neck opens into a long, gently relaxed exit skirt.
        # The thin jacket converges on the exit ring instead of bulging past it.
        t=max(0,min(1,(u-2.48)/1.4))
        return 0.45+0.81*(t+0.2*t*(1-t))
    if stage>=6:
        # Almost straight conical flare, with a slight eased throat transition.
        # Both end radii and the entire nozzle's axial span stay fixed.
        return 0.55+0.65*(t+0.12*t*(1-t))
    return 0.55+0.65*(1-(1-t)**1.65)


def nozzle(f,stage):
    rad=lambda u:bell_radius(u,stage)
    us=(2.36,2.48,2.6,2.78,3.02,3.3,3.6,3.88) if stage>=7 else (2.36,2.49,2.67,2.9,3.16,3.43,3.69,3.88)
    progress=lambda u:max(0,min(1,(u-2.48)/1.4))
    if stage>=7:
        annulus(f,2.35,2.52,0.35,0.6,BZ,"steelD","steel",sides=24)
    sleeve(f,[(u,rad(u),BZ) for u in us],"steelD",sides=32)
    sleeve(f,[(u,rad(u)-0.1,BZ) for u in us],"dark",inner=True,sides=32)
    # Six broad sculpted castings replace the earlier decorative rail strips.
    count=6 if stage>=3 else 8
    pitch=math.tau/count
    for k in range(count):
        t=k*pitch
        for a,b in ((2.53,3.13),(3.18,3.86)):
            lift=lambda u:0.05-0.045*progress(u) if stage>=7 else 0.065
            profile=[(a+(b-a)*j/4,rad(a+(b-a)*j/4)+lift(a+(b-a)*j/4),BZ) for j in range(5)]
            if stage>=7:
                sculpted_stave(f,profile,t+0.11,t+pitch-0.11,"steel" if k%2 else "blueGrey",
                               relief=lambda u:1-0.8*progress(u))
            elif stage>=3:
                sculpted_stave(f,profile,t+0.11,t+pitch-0.11,"steel" if k%2 else "blueGrey")
            elif stage>=2:
                # Three facets across each broad stave make a pronounced
                # keel-shaped ridge, with recessed copper channels between.
                for j in range(3):
                    ta=t+0.105+(math.tau/8-0.21)*j/3
                    tb=t+0.105+(math.tau/8-0.21)*(j+1)/3
                    raised=[(u,min(1.27,r+(0.045 if j==1 else 0)),z) for u,r,z in profile]
                    petal(f,raised,ta,tb,"steelL" if j==1 else ("steel" if k%2 else "blueGrey"),thick=0.065)
            else:
                petal(f,profile,t+0.1,t+math.tau/8-0.1,"steel" if k%2 else "blueGrey",thick=0.06)
        # Paired regenerative tubes sit in the channels BETWEEN petals.
        for offset in (-0.035,0.035):
            angle=t+offset
            path=[(u,(rad(u)+0.045)*math.cos(angle),
                     BZ+(rad(u)+0.045)*math.sin(angle))
                  for u in (2.68,2.92,3.23,3.54,3.78)]
            end_u,end_r=(3.94,1.25) if stage>=7 else (3.91,1.17)
            path.append((end_u,end_r*math.cos(angle),BZ+end_r*math.sin(angle)))
            curved_pipe(f,path,0.032,"brass",steps=3,sides=8)
    torus(f,2.66,0,BZ,rad(2.66)+0.1,0.085,"gm",n=32)
    if stage>=7:
        # A slimmer bevelled rim opens the mouth and preserves the skirt's
        # flare. The cooling tubes terminate inside this exit manifold.
        sleeve(f,[(3.86,1.265,BZ),(3.92,1.3,BZ)],"steelL",sides=32)
        sleeve(f,[(3.86,1.16,BZ),(3.92,1.17,BZ)],"dark",inner=True,sides=32)
        annulus(f,3.92,4.0,1.17,1.3,BZ,"steel","plate",sides=32)
    else:
        annulus(f,3.86,4.0,1.085,1.3,BZ,"steel","plate",sides=16 if stage>=2 else 32)
        annulus(f,3.83,3.86,1.1,1.245,BZ,"gmD","brass",sides=32)
    for side in (-1,1):
        if stage>=7:
            collector=rad(2.66)+0.1
            curved_pipe(f,[(2.31,side*0.59,1.55),(2.46,side*0.67,1.64),
                           (2.66,side*collector*0.95,BZ+collector*0.31)],0.09,"gm",steps=5)
            continue
        if stage>=5:
            curved_pipe(f,[(2.31,side*0.59,1.55),(2.45,side*0.7,1.67),
                           (2.66,side*0.79,1.7)],0.09,"gm",steps=5)
            continue
        curved_pipe(f,[(2.3,side*0.59,1.65),(2.39,side*0.83,1.97),
                       (2.6,side*0.76,2.16),(2.66,side*0.43,2.22)],
                    0.075,"steelL",steps=5)
    f.hcyl(2.35,2.38,0,BZ,0.29,"dark",sides=24,cap="dark")


def exhaust(f,stage):
    profile=[(3.45,0.23,BZ),(3.95,0.49,BZ),(4.3,0.58,BZ),
             (4.78,0.3,BZ),(5.2,0.47,BZ),(5.65,0.22,BZ),
             (6.1,0.34,BZ),(6.65,0.12,BZ),(7.4,0.006,BZ)]
    sleeve(f,profile,"cyan",sides=32)
    for (u,r,z),reverse in ((profile[0],True),(profile[-1],False)):
        pts=[f.pt(u,r*math.cos(t*math.tau/32),z+r*math.sin(t*math.tau/32)) for t in range(32)]
        f.poly(pts[::-1] if reverse else pts,"cyan",flip=True)


def machine(rot,hot=False,stage=1,holdout=True):
    if holdout:
        hull(rot,stage,True)
    objects=[]
    for name,fn in (("bed",bed),("powerhead",powerhead),
                    ("services",lambda f,s:services(f,s,hot)),("bell",nozzle)):
        m=core.Mesh("KESTREL_"+name)
        fn(Frame(m,rot,centre=CENTRE[rot]),stage)
        if name=="powerhead":
            # A low, broad armoured cassette fits inside the new roof plane.
            # Its fore end returns smoothly to a circular throat so the
            # full-size bell and bearing retain their approved round section.
            cx,cy=CENTRE[rot]
            for i,(x,y,z) in enumerate(m.v):
                gx,gy=x-cx,-y-cy
                u=(-gy,gx,gy,-gx)[rot]
                blend=max(0,min(1,(u-1.45)/.95))
                fit=CASSETTE_Z_FIT+(1-CASSETTE_Z_FIT)*blend
                m.v[i]=(x,y,THRUST_Z+(z-BZ)*fit)
        elif name in ("services","bell"):
            m.v=[(x,y,z+THRUST_Z-BZ) for x,y,z in m.v]
        objects.append(m.build())
    if hot:
        m=core.Mesh("KESTREL_exhaust",selflit=True)
        exhaust(Frame(m,rot,centre=CENTRE[rot]),stage)
        m.v=[(x,y,z+THRUST_Z-BZ) for x,y,z in m.v]
        objects.append(m.build())
    return objects
