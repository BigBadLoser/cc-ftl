"""Flush exterior cabin surfaces for the separate transport concept B."""
from lib.transport_forms import loft,section


def cabin_details(f,hatch_height):
    # Thin flush end rims and a centre mullion give the opaque glass a frame.
    canopy=[(.55,.70,2.00,.40),(1.82,.65,2.02,.36),(2.10,.39,1.66,.26)]
    loft(f,canopy,"gW1",upper="glassD")
    for a,b,t0,t1 in ((canopy[0],canopy[1],0,.08),(canopy[1],canopy[2],.92,1)):
        rows=[tuple(x+(y-x)*t for x,y in zip(a,b)) for t in (t0,t1)]
        rings=[[f.pt(row[0],v,min(2.4,z+.003)) for v,z in section(*row[1:])] for row in rows]
        for i in (7,0,1):
            j=(i+1)%8
            f.poly([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],"gW1",flip=True)
    for a,b in zip(canopy,canopy[1:]):
        f.poly([f.pt(a[0],-.018,min(2.4,a[2]+a[3]+.003)),f.pt(b[0],-.018,min(2.4,b[2]+b[3]+.003)),
                f.pt(b[0],.018,min(2.4,b[2]+b[3]+.003)),f.pt(a[0],.018,min(2.4,a[2]+a[3]+.003))],"gW2",flip=True)
    # One large flush cargo-service cover, following the aft roof's slope.
    def roof(u):
        return 2.0+(u+1.70)*(.30/1.15) if u<-.55 else 2.30+(u+.55)*(-.06/1.41)
    for u0,u1,w,col,d in ((-1.43,-.54,.53,"steelD",.004),(-1.37,-.60,.47,"gW1",.008)):
        f.poly([f.pt(u0,-w,roof(u0)+d),f.pt(u1,-w,roof(u1)+d),
                f.pt(u1,w,roof(u1)+d),f.pt(u0,w,roof(u0)+d)],col,flip=True)
    # Recess the closed leaf into an opening in the hull's flat port sidewall.
    # Four flush skin strips replace the omitted hull face around the aperture.
    for u,w in ((.915,.11),(1.76,.12)):
        f.box(u,-1.045,.473,w,.010,1.674,"gW1")
    f.box(1.335,-1.045,.473,.73,.010,.037,"gW1")
    f.box(1.335,-1.045,2.13,.73,.010,.017,"gW1")
    f.box(1.335,-.995,.51,.75,.034,1.62,"steelD")
    f.box(1.335,-1.018,.52,.73,.012,hatch_height,"rM",top="rH")
    f.box(1.335,-1.026,1.64,.34,.006,.11,"glassD")
    # The inset docking jamb and sill connect directly to the belly skin.
    for u in (.96,1.71):
        f.box(u,-1.032,.51,.018,.036,1.62,"steelL")
    for i in range(6):
        f.box(1.025+i*.125,-1.043,.482,.12,.05,.025,"hazY" if i%2==0 else "hazK")


def rear_details(f):
    """Closed rear cargo hatch, engine cooling grilles and reinforced nozzle collars."""
    f.box(-2.163,0,.70,.026,1.02,1.28,"steelD")
    f.box(-2.182,0,.76,.016,.90,1.16,"gW1")
    for v in (-.32,.32):
        f.box(-2.196,v,.81,.012,.035,1.06,"steelL")
    f.box(-2.199,0,1.27,.018,.16,.12,"steelD")
    f.box(-2.19,0,.69,.04,1.02,.07,"steelL")
    for v in (-.42,-.14,.14,.42):
        f.box(-2.211,v,.72,.016,.14,.045,"hazY")
    for side in (-1,1):
        v=side*1.36
        f.box(-2.054,v,1.69,.022,.39,.25,"steelD")
        for i in range(4):
            f.box(-2.071,v,1.715+i*.055,.014,.32,.018,"steelL")
        f.hcyl(-2.21,-2.06,side*1.38,1.31,.35,"steelL",r1=.32,sides=12)
