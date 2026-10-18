"""Faceted rounded helicopter-like cockpit pod, with opaque wraparound glazing."""
import math

POD_ROWS=[(-1.05,1.27,1.10,.99),(-.92,1.25,1.17,1.06),(-.65,1.23,1.21,1.11),
          (-.30,1.22,1.225,1.13),(0,1.22,1.225,1.14),(.30,1.22,1.225,1.13),
          (.65,1.23,1.21,1.11),(.92,1.25,1.17,1.06),(1.05,1.27,1.10,.99)]
POD_Z=1.28
SEGMENTS=32


def cockpit_pod(f):
    def pt(row,a,offset=0):
        v,u,ru,rz=row
        return f.pt(u+(ru+offset)*math.cos(a),v,POD_Z+(rz+offset)*math.sin(a))
    rings=[[pt(row,i*math.tau/SEGMENTS) for i in range(SEGMENTS)] for row in POD_ROWS]
    f.poly(rings[0][::-1],"gW1",flip=True)
    f.poly(rings[-1],"gW1",flip=True)
    # The window covers the continuous upper/front arc, with an armoured lower chin.
    for k,(a,b) in enumerate(zip(rings,rings[1:])):
        for i in range(SEGMENTS):
            j=(i+1)%SEGMENTS
            glass=1<=i<=9 and 1<=k<=6
            f.poly([a[i],a[j],b[j],b[i]],"glassD" if glass else "gW1",flip=True)
    # Flush end frames follow the curved shell, rather than straight bars on a wedge.
    for angle in (math.tau/SEGMENTS,10*math.tau/SEGMENTS):
        for a,b in zip(POD_ROWS[1:-2],POD_ROWS[2:-1]):
            f.poly([pt(a,angle-.018,.004),pt(b,angle-.018,.004),
                    pt(b,angle+.018,.004),pt(a,angle+.018,.004)],"gW1",flip=True)
    # Thin central mullion keeps a cockpit read at native scale.
    row0=(-.018,1.22,1.225,1.14)
    row1=(.018,1.22,1.225,1.14)
    for i in range(1,10):
        a,b=i*math.tau/SEGMENTS,(i+1)*math.tau/SEGMENTS
        f.poly([pt(row0,a,.004),pt(row0,b,.004),pt(row1,b,.004),pt(row1,a,.004)],"gW2",flip=True)
