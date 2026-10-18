"""Closed solids for the separate sweepback shuttle experiment."""
import math
from sprites.cmbkit import Frame
from sprites import core


class FlightFrame(Frame):
    def __init__(self, mesh, heading):
        self.m=mesh
        self.rot=1
        self.cx=self.cy=0
        self.c,self.s=math.cos(heading),math.sin(heading)

    def xy(self,u,v):
        return u*self.c-v*self.s,u*self.s+v*self.c


def section(width,center,height,side_height=.48):
    return [(-width*.72,center+height),(width*.72,center+height),
            (width,center+height*side_height),(width,center-height*side_height),
            (width*.72,center-height),(-width*.72,center-height),
            (-width,center-height*side_height),(-width,center+height*side_height)]


def loft(f,stations,color,upper=None,front=None,omit=(),aft_slope=0):
    """Stations: u, half-width, centre, half-height, optional offset/side-height."""
    rings=[[f.pt(row[0]+((z-row[2])*aft_slope if k==0 else 0),v+(row[4] if len(row)>4 else 0),z)
            for v,z in section(*row[1:4],row[5] if len(row)>5 else .48)] for k,row in enumerate(stations)]
    f.poly(rings[0],color,flip=True)
    f.poly(rings[-1][::-1],front or color,flip=True)
    for seg,(a,b) in enumerate(zip(rings,rings[1:])):
        for i in range(8):
            if (seg,i) in omit:
                continue
            j=(i+1)%8
            f.poly([a[i],a[j],b[j],b[i]],upper if upper and i in (0,1,7) else color,flip=True)


def plate(f,points,z,thickness,color):
    a=[f.pt(u,v,z) for u,v in points]
    b=[f.pt(u,v,z+thickness) for u,v in points]
    f.poly(a[::-1],color,flip=True)
    f.poly(b,color,flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],color,flip=True)


def side_prism(f,profile,v0,v1,color):
    """Extrude a closed u/z profile across the side of a pressure hull."""
    a=[f.pt(u,v0,z) for u,z in profile]
    b=[f.pt(u,v1,z) for u,z in profile]
    f.poly(a[::-1],color,flip=True)
    f.poly(b,color,flip=True)
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],color,flip=True)
