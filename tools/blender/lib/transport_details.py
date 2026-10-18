"""Flush exterior cabin surfaces for the separate transport concept B."""
from lib.transport_hatch import pressure_hatch
from lib.transport_ramp import loading_ramp


def cabin_details(f,hatch_height):
    # One large flush cargo-service cover, following the aft roof's slope.
    def roof(u):
        return 2.0+(u+1.50)*(.30/.95) if u<-.55 else 2.30+(u+.55)*(-.04/1.05)
    for u0,u1,w,col,d in ((-1.43,-.54,.53,"steelD",.004),(-1.37,-.60,.47,"gW1",.008)):
        f.poly([f.pt(u0,-w,roof(u0)+d),f.pt(u1,-w,roof(u1)+d),
                f.pt(u1,w,roof(u1)+d),f.pt(u0,w,roof(u0)+d)],col,flip=True)
    pressure_hatch(f)


def rear_details(f,ramp_open=0):
    """Inclined loading ramp, engine cooling grilles and reinforced nozzle collars."""
    loading_ramp(f,ramp_open)
    for side in (-1,1):
        v=side*1.36
        f.box(-2.054,v,1.69,.022,.39,.25,"steelD")
        for i in range(4):
            f.box(-2.071,v,1.715+i*.055,.014,.32,.018,"steelL")
        f.hcyl(-2.21,-2.06,side*1.38,1.31,.35,"steelL",r1=.32,sides=12)
