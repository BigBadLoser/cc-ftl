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


def section(width,center,height):
    return [(-width*.72,center+height),(width*.72,center+height),
            (width,center+height*.48),(width,center-height*.48),
            (width*.72,center-height),(-width*.72,center-height),
            (-width,center-height*.48),(-width,center+height*.48)]


def loft(f,stations,color,upper=None,front=None):
    """Stations are u, half-width, centre-height, half-height."""
    rings=[[f.pt(u,v,z) for v,z in section(w,c,h)] for u,w,c,h in stations]
    f.poly(rings[0],color,flip=True)
    f.poly(rings[-1][::-1],front or color,flip=True)
    for a,b in zip(rings,rings[1:]):
        for i in range(8):
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
