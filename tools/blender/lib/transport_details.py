"""Flush exterior cabin surfaces for the separate transport concept B."""
from lib.transport_forms import loft,section,chamfer_station
from lib.transport_hatch import pressure_hatch
from lib.transport_ramp import loading_ramp


def cabin_details(f,hatch_height,hatch_frame=None):
    # Thin flush end rims and a centre mullion give the opaque glass a frame.
    canopy=[(.50,.70,2.00,.40),(1.50,.65,1.98,.38),(1.90,.56,1.84,.34),
            (2.25,.46,1.54,.30),(2.43,.32,1.25,.29)]
    canopy=chamfer_station(canopy,3)
    loft(f,canopy,"gW1",upper="glassD")
    for a,b,t0,t1 in ((canopy[0],canopy[1],0,.08),(canopy[-2],canopy[-1],.92,1)):
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
        return 2.0+(u+1.50)*(.30/.95) if u<-.55 else 2.30+(u+.55)*(-.04/1.05)
    for u0,u1,w,col,d in ((-1.43,-.54,.53,"steelD",.004),(-1.37,-.60,.47,"gW1",.008)):
        f.poly([f.pt(u0,-w,roof(u0)+d),f.pt(u1,-w,roof(u1)+d),
                f.pt(u1,w,roof(u1)+d),f.pt(u0,w,roof(u0)+d)],col,flip=True)
    pressure_hatch(hatch_frame or f)


def rear_details(f,ramp_open=0):
    """Inclined loading ramp, engine cooling grilles and reinforced nozzle collars."""
    loading_ramp(f,ramp_open)
    for side in (-1,1):
        v=side*1.36
        f.box(-2.054,v,1.69,.022,.39,.25,"steelD")
        for i in range(4):
            f.box(-2.071,v,1.715+i*.055,.014,.32,.018,"steelL")
        f.hcyl(-2.21,-2.06,side*1.38,1.31,.35,"steelL",r1=.32,sides=12)
