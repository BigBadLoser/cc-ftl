"""Parametric 3x5 refinery study; local u is the 5-tile long axis.

Six real square mouths, a recessed process channel, three exposed drums and
sloped end housings. No floor slab. Preview model, not registered in the game.
"""
from dataclasses import dataclass,asdict
import math
from . import core
from .cmbkit import Frame

LOCAL_COLOURS={'refineryArmour':{'hex':'#d77b29'}}


@dataclass(frozen=True)
class RefineryShape:
    bay_spacing:float=1.02
    rear_v:float=0
    rear_top:float=1.62
    rear_width:float=.74
    rear_depth:float=.76
    rear_bottom:float=1.00
    front_v:float=.58
    front_top:float=1.00
    front_width:float=.53
    front_depth:float=.51
    drum_v:float=1.14
    drum_z:float=.43
    drum_radius:float=.28
    drum_width:float=.72
    end_u:float=2.18
    end_width:float=.40
    end_top:float=.94
    rim:float=.075
    well_depth:float=.35
    ribbed_drums:bool=True
    coloured:bool=True
    front_u_offset:float=.40
    front_setback:float=0
    rear_plinth_top:float=1.08
    split_ends:bool=True
    footprint:tuple=(3,5)
    sill_length:float=4.66
    body_length:float=4.24
    end_links:bool=True
    end_bridges:bool=True
    end_bevel:float=.055
    centred_layout:bool=True

    def spec(self):
        return asdict(self)


def palette(p):
    if p.coloured:
        core.palette._data.update(LOCAL_COLOURS)
    return {'armour':'refineryArmour' if p.coloured else 'steelL',
            'rim':'plate','body':'blueGrey' if p.coloured else 'steel','dark':'steelD','metal':'steelL'}


def rectangle(u,v,w,d,chamfer=.05):
    x,y=w/2,d/2;c=min(chamfer,x/2,y/2)
    return [(u+a,v+b) for a,b in ((-x+c,-y),(x-c,-y),(x,-y+c),(x,y-c),
                                  (x-c,y),(-x+c,y),(-x,y-c),(-x,-y+c))]


def join(f,a,b,col):
    for i in range(len(a)):
        j=(i+1)%len(a)
        f.poly([a[i],a[j],b[j],b[i]],col,flip=True)


def housing(f,u0,u1,profile,col,bevel=0):
    a=[f.pt(u0,v,z) for v,z in profile];b=[f.pt(u1,v,z) for v,z in profile]
    if bevel:
        cv=sum(v for v,z in profile)/len(profile);cz=sum(z for v,z in profile)/len(profile)
        inset=[(v+(cv-v)*bevel/max(abs(v-cv),abs(z-cz)),
                z+(cz-z)*bevel/max(abs(v-cv),abs(z-cz))) for v,z in profile]
        aa=[f.pt(u0+bevel,v,z) for v,z in profile];bb=[f.pt(u1-bevel,v,z) for v,z in profile]
        a=[f.pt(u0,v,z) for v,z in inset];b=[f.pt(u1,v,z) for v,z in inset]
        f.poly(a,col,flip=True);f.poly(b[::-1],col,flip=True)
        join(f,a,aa,col);join(f,aa,bb,col);join(f,bb,b,col)
        return
    f.poly(a,col,flip=True);f.poly(b[::-1],col,flip=True);join(f,a,b,col)


def mouth(f,u,v,w,d,bottom,top,p,col):
    """Chamfered rectangular hopper with actual inner walls and deep bottom."""
    def loop(width,depth,z):
        return [f.pt(x,y,z) for x,y in rectangle(u,v,width,depth)]
    outer=loop(w,d,top);lower=loop(w*.88,d*.88,bottom)
    inner=loop(w-2*p.rim,d-2*p.rim,top)
    well=loop((w-2*p.rim)*.90,(d-2*p.rim)*.90,max(bottom+.03,top-p.well_depth))
    join(f,lower,outer,col['body']);join(f,outer,inner,col['rim'])
    join(f,inner,well,col['dark']);f.poly(well[::-1],col['dark'],flip=True)
    # A thick geometric lip, independent of the lower hopper walls.
    join(f,outer,loop(w,d,top-.13),col['rim'])


def refinery(p=RefineryShape()):
    m=core.Mesh('refinery_study');f=Frame(m,rot=1,centre=(0,0));c=palette(p)
    # Structural sills, not a deck or floor plate. The central trough stays recessed.
    for v in (-1.18,1.27-p.front_setback):
        f.box(0,v,0,p.sill_length,.18,.16,c['dark'])
    body_v=0 if p.centred_layout else -.01-p.front_setback/2
    body_depth=2.16 if p.centred_layout else 1.91-p.front_setback
    f.box(0,body_v,.23,p.body_length,body_depth,.22,c['body'])
    f.box(0,.43 if p.centred_layout else -.08,.45,2.98,.20 if p.centred_layout else .36,.035,c['dark'])
    for u in (-p.bay_spacing,0,p.bay_spacing):
        f.box(u,p.rear_v,.38,.85,.64 if p.centred_layout else .91,p.rear_plinth_top-.38,c['body'])
        mouth(f,u,p.rear_v,p.rear_width,p.rear_depth,p.rear_bottom,p.rear_top,p,c)
        mouth(f,u+p.front_u_offset,p.front_v,p.front_width,p.front_depth,.55,p.front_top,p,c)
        # Horizontal cylinder along the long axis, exposed in the sloped front bay.
        f.hcyl(u-p.drum_width/2,u+p.drum_width/2,p.drum_v,p.drum_z,
               p.drum_radius,c['metal'],sides=24,cap=c['body'],capstart=c['body'])
        if p.ribbed_drums:
            for du in (-.27,-.14,0,.14,.27):
                f.hcyl(u+du-.025,u+du+.025,p.drum_v,p.drum_z,
                       p.drum_radius+.027,c['rim'],sides=24)
        for sign in (-1,1):
            support=[(min(1.40,v-p.front_setback+.14) if p.centred_layout else v-p.front_setback,z)
                     for v,z in ((.46,.16),(.46,.83),(.70,.83),(1.40,.20),(1.40,.09))]
            pos=u+sign*(p.drum_width/2+.065)
            housing(f,pos-.055,pos+.055,support,c['armour'])
        f.box(u,.67-p.front_setback+(.14 if p.centred_layout else 0),.78,.91,.17,.10,c['armour'])
    end_profile=[(-1.36,.08),(-1.36,.40),(-.99,p.end_top),
                 (.66,p.end_top),(1.35,.40),(1.40,.08)]
    for sign in (-1,1):
        u=sign*p.end_u
        if p.end_links:
            link_start=p.bay_spacing+p.rear_width/2
            length=p.end_u-link_start
            f.box(sign*(link_start+length/2),p.rear_v,.39,length,.72,.57,c['body'])
        if p.end_bridges:
            start=p.bay_spacing+p.drum_width/2+.12;finish=p.end_u-p.end_width/2+.04
            uu=sorted((sign*start,sign*finish))
            profile=[(v+(.54 if p.centred_layout else 0),z) for v,z in ((.12,.10),(.12,.76),(.28,.78),(.86,.25),(.86,.10))]
            housing(f,*uu,profile,c['armour'],p.end_bevel)
        if p.split_ends:
            profiles=([(-1.36,.08),(-1.36,.40),(-1.03,p.end_top),(-.79,p.end_top),(-.40,.50),(-.40,.08)],
                      [(.08,.08),(.08,.74),(.32,p.end_top),(.51,p.end_top-.03),(.86,.40),(.86,.08)])
            if p.centred_layout:
                profiles=([(-1.40,.08),(-1.40,.40),(-1.07,p.end_top),(-.83,p.end_top),(-.18,.50),(-.18,.08)],
                          [(v+.54,z) for v,z in profiles[1]])
            for profile in profiles:
                housing(f,u-p.end_width/2,u+p.end_width/2,profile,c['armour'],p.end_bevel)
            control_v=.20 if p.centred_layout else -.18
            f.box(u,control_v,.16,p.end_width,.80 if p.centred_layout else .65,p.end_top-.16,c['body'])
            f.box(u,control_v,p.end_top,.39,.55,.27,c['body'])
        else:
            housing(f,u-p.end_width/2,u+p.end_width/2,end_profile,c['armour'])
            f.box(u,.04,p.end_top,.39,.55,.27,c['body'])
    result=[m.build()]
    if p.coloured:
        # Restrained reference-style light bands. Armour itself never emits.
        lm=core.Mesh('refinery_status_lights',selflit=True);lf=Frame(lm,rot=1,centre=(0,0))
        for u in (-p.bay_spacing,0,p.bay_spacing):
            lf.box(u,p.rear_v+p.rear_depth/2+.012,p.rear_top-.26,.42,.016,.065,'flameW')
            lf.box(u+p.rear_width/2+.012,p.rear_v,p.rear_top-.26,.016,.42,.065,'flameW')
        for sign in (-1,1):
            lf.box(sign*(p.end_u+p.end_width/2+.012),.20,p.end_top+.11,.014,.30,.055,'flameY')
        result.append(lm.build())
    return result


def landmarks(p):
    def screen(u,v,z):
        x,y=core.screen_xy(core.G(u,v,z));return [float(x),float(-y)]
    result={}
    for i,u in enumerate((-p.bay_spacing,0,p.bay_spacing)):
        result[f'rear_{i+1}']=screen(u,p.rear_v,p.rear_top)
        result[f'front_{i+1}']=screen(u+p.front_u_offset,p.front_v,p.front_top)
        result[f'drum_{i+1}']=screen(u,p.drum_v,p.drum_z)
    return result
