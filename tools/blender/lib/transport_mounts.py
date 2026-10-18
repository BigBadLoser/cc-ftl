"""Raised structural wing seats with sloping fronts and tapered hull-aligned sides."""
MOUNT_BASE_Z=1.66
MOUNT_SEAT_Z=2.30
MOUNT_FRONT_BASE=.34
MOUNT_FRONT_SEAT=-.14


def wing_mount(f,side):
    def outline(front,rear,inner,outer,c):
        return [(front,inner+c),(front,outer-c),(front-c,outer),(rear+c,outer),
                (rear,outer-c),(rear,inner+c),(rear+c,inner),(front-c,inner)]
    base=outline(MOUNT_FRONT_BASE,-1.94,.82,1.88,.10)
    seat=outline(MOUNT_FRONT_SEAT,-2.04,1.06,1.76,.07)
    a=[f.pt(u,side*v,MOUNT_BASE_Z) for u,v in base]
    b=[f.pt(u,side*v,MOUNT_SEAT_Z) for u,v in seat]
    # Paired closed mounts; the outboard side tapers into the nacelle armour.
    f.poly(a[::-1],"gW2",flip=True)
    f.poly(b,"steelL",flip=True)
    for i in range(8):
        j=(i+1)%8
        f.poly([a[i],a[j],b[j],b[i]],"gW1",flip=True)
