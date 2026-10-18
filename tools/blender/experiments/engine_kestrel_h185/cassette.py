"""Heavy installed power cassette: integrated load case, pump crown and feeds."""
import math
from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, sleeve, torus

BZ=1.42


def body_radius(u):
    p=[(-2.15,0.59),(-1.92,0.82),(-1.48,0.89),(-0.7,0.86),
       (0.12,0.77),(0.8,0.64),(1.45,0.52),(1.85,0.47),(2.4,0.54)]
    for (a,r),(b,s) in zip(p,p[1:]):
        if a<=u<=b:
            return r+(s-r)*(u-a)/(b-a)
    return p[0][1] if u<p[0][0] else p[-1][1]


def heavy_bed(f,stage):
    from model import prism
    # The cassette's sump and deep side castings carry the engine directly.
    if stage<7:
        f.box(-0.52,0,0.04,3.84,3.4,0.16,"steelD",top="plateA")
    ground=0 if stage>=7 else 0.2
    f.box(-0.35,0,0.2,3.5,1.55,0.50,"steelD",top="steel")
    for side in (-1,1):
        v=side*1.13
        shape=[(-2.25,ground),(-2.25,0.79),(-1.69,1.15),
               (-0.76,1.12),(0.32,0.84),(1.5,0.55),(1.5,ground)]
        prism(f,shape,v-0.26,v+0.26,"navy","blueGrey")
        # Two large access castings, with a restrained outline and fasteners.
        for a,b in ((-2.06,-0.92),(-0.84,0.48)):
            top=0.96 if a< -1 else 0.74
            prism(f,[(a,0.38),(a,top-0.08),(a+0.24,top),
                     (b,top-0.12),(b,0.38)],
                  v+side*0.265,v+side*0.285,"blueGrey","steelL")
            for u in (a+0.14,b-0.12):
                G.disc(f,"+v" if side>0 else "-v",u,0.49,v+side*0.295,
                       0.045,0,0.035,"steelD",sides=6)
        for u in (-2.17,1.18):
            if stage>=7:
                # Integral mounting lugs overlap the cast supports and bolt
                # directly into the ship's deck. No shared plinth underneath.
                f.box(u,side*1.5,0,0.34,0.52,0.16,"steel",top="plate")
                G.disc(f,"z",u,side*1.58,0.16,0.07,0,0.05,"steelD",sides=6)
            else:
                f.box(u,side*1.58,0.2,0.34,0.36,0.16,"steel",top="plate")
                G.disc(f,"z",u,side*1.58,0.36,0.07,0,0.05,"steelD",sides=6)
    # A proper broad saddle under the injector replaces exposed fork legs.
    prism(f,[(-2.15,ground),(-2.15,0.84),(-1.75,1.08),
             (-1.31,0.97),(-1.31,ground)],-0.8,0.8,"steelD","steel")


def armoured_powerhead(f,stage):
    from model import petal, sculpted_stave
    us=(-2.15,-1.92,-1.48,-0.7,0.12,0.8,1.45,1.85,2.4)
    sleeve(f,[(u,body_radius(u),BZ) for u in us],"steelD",sides=32)
    f.hcyl(-2.2,-2.15,0,BZ,0.59,"steel",sides=16,capstart="blueGrey")
    # A broad armoured pump crown flows directly into the chamber jacket.
    # The change in section belongs to one casting, rather than stacked drums.
    for t0,t1,mat in ((0.16,1.1,"steel"),(1.1,2.04,"blueGrey"),
                      (2.04,2.98,"steel"),(3.42,6.0,"navy")):
        for samples in ((-1.75,-1.48,-0.7,-0.17),(-0.08,0.12,0.8,1.43)):
            profile=[(u,body_radius(u)+0.075,BZ) for u in samples]
            sculpted_stave(f,profile,t0,t1,mat)
    # Inboard armour over the integrated annular pump, with one narrow bronze
    # gasket line and four large clamp blocks. No open freestanding hoop.
    annulus(f,-1.94,-1.82,0.69,0.94,BZ,"steelD","steelL",sides=16)
    annulus(f,-1.82,-1.78,0.74,0.9,BZ,"brass","gm",sides=24)
    for k in range(4):
        t=k*math.pi/2+math.pi/4
        petal(f,[(-2.02,0.9,BZ),(-1.72,0.99,BZ),(-1.45,0.96,BZ)],
              t-0.09,t+0.09,"steelL",thick=0.13)
    # Heavy injector service plate, recessed centre and widely spaced clamps.
    annulus(f,-2.27,-2.2,0.26,0.58,BZ,"steelD","steel",sides=16)
    f.hcyl(-2.25,-2.2,0,BZ,0.255,"navy",sides=8,capstart="navy")
    for k in range(6):
        t=k*math.tau/6
        G.disc(f,"-u",0.43*math.cos(t),BZ+0.43*math.sin(t),-2.28,
               0.055,0,0.045,"plate",sides=6)
    # Close-coupled cast ducts sit on the upper shoulders, not above them as
    # skeletal handles. They remain readable as a pair of functional feeds.
    for side in (-1,1):
        curved_pipe(f,[(-1.6,side*0.7,2.0),(-1.25,side*0.8,2.17),
                       (-0.5,side*0.8,2.18),(0.3,side*0.68,2.08),
                       (0.95,side*0.46,1.94),(1.45,side*0.25,1.9)],
                    0.15,"steelL",steps=5,sides=12)
        D.seg(f,(-1.6,side*0.7,2.0),(-1.5,side*0.76,2.09),
              0.2,"brass",12,cap="steelL",capstart="steelL")
        D.flange(f,(1.43,side*0.25,1.91),"u",0.2,"brass",t=0.12)
        # A short pair of saddles visibly secures each duct to the casting.
        for u,v,z in ((-0.64,side*0.8,2.18),(0.45,side*0.65,2.05)):
            service_union=stage>=6 and u<0
            D.flange(f,(u,v,z),"u",0.21 if service_union else 0.175,
                     "steel" if service_union else "gmD",t=0.09)
            if service_union:
                for t in (0.3,2.4,4.5):
                    G.disc(f,"+u",v+0.178*math.cos(t),z+0.178*math.sin(t),u+0.047,
                           0.033,0,0.035,"steelD",sides=6)
        for k in range(3):
            angle=-0.34+k*0.17
            pts=[]
            for u,c in ((-1.72,0.14),(-1.1,0.15),(-0.3,0.15),(0.55,0.15),(1.57,0.1)):
                r=body_radius(u)+c
                pts.append((u,side*r*math.cos(angle),BZ+r*math.sin(angle)))
            curved_pipe(f,pts,0.05,"brass" if k==1 else "steelL",steps=3,sides=8)
    annulus(f,1.51,1.66,0.45,0.65,BZ,"steelD","steelL",sides=24)
    # One small maintenance cover breaks the broad crown, without turning
    # the casing into a stack of competing accessories.
    if stage>=6:
        # Develop the existing cover into a removable service lid. A captive
        # bar handle and four corner fasteners stay close to the crown.
        D.panel(f,-0.95,0,2.435,0.64,0.44,"blueGrey",t=0.02,ring=0.05,bolts=False)
        for u in (-1.19,-0.71):
            for v in (-0.14,0.14):
                G.disc(f,"z",u,v,2.475,0.035,0,0.025,"steelL",sides=6)
        for u in (-1.035,-0.865):
            f.box(u,0,2.475,0.04,0.065,0.02,"steelD",top="gm")
        f.box(-0.95,0,2.495,0.21,0.05,0.025,"brass",top="brass")
    else:
        f.box(-0.95,0,2.44,0.48,0.34,0.045,"steelD",top="blueGrey")
        for v in (-0.1,0.1):
            G.disc(f,"z",-0.95,v,2.485,0.035,0,0.025,"steelL",sides=6)


def integrated_services(f,stage,hot):
    from model import prism
    for side in (-1,1):
        # Feed gallery is now inside the armoured sump, with only the external
        # inlet elbow and valve accessible in a shallow side recess.
        curved_pipe(f,[(-1.7,side*0.92,1.14),(-1.87,side*1.25,1.12),
                       (-1.52,side*1.43,1.16),(-0.81,side*1.42,1.1),
                       (-0.4,side*1.2,1.04),(-0.4,side*1.2,0.82)],0.105,"gm",steps=4)
        D.flange(f,(-0.98,side*1.42,1.12),"u",0.16,"brass",t=0.1)
        G.valve_wheel(f,"+v" if side>0 else "-v",-0.78,0.87,side*1.43,r=0.105)
        if stage>=6:
            face="+v" if side>0 else "-v"
            # A single access hatch and analogue gauge make this existing
            # gallery visibly serviceable, without adding another subsystem.
            G.hatch(f,face,-1.47,0.65,side*1.419,w=0.57,h=0.31)
            D.seg(f,(-1.15,side*1.44,1.12),(-1.15,side*1.44,1.27),
                  0.045,"gm",8,cap="gm")
            G.disc(f,face,-1.15,1.29,side*1.44,0.105,0,0.1,"steelL",sides=12)
            G.disc(f,face,-1.15,1.29,side*1.44,0.077,0.1,0.105,"navy",sides=12)
            D.seg(f,(-1.18,side*1.55,1.26),(-1.12,side*1.55,1.32),
                  0.015,"plate",6,cap="plate")
        a=(0.58,side*1.13,0.62)
        b=(1.65,side*0.48,1.19)
        D.seg(f,a,b,0.13,"steelD",12,cap="steelL")
        D.seg(f,(0.93,side*0.92,0.8),b,0.075,"plate",12,cap="plate")
        # A protective cast cheek hides the sump's forward plumbing.
        prism(f,[(0.28,0.33),(0.4,0.76),(1.46,0.54),(1.46,0.33)],
              side*1.1,side*1.4,"steelD","steel")
    D.panel(f,-1.65,1.13,1.17,0.36,0.3,"steelD",bolts=False)
    f.box(-1.72,1.13,1.2,0.08,0.18,0.025,"cyan" if hot else "lens")
