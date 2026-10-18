"""BASTION heavy resonator and WARD compact field pump. No floor plates."""
from mathutils import Vector
from sprites import core
from sprites.detail import seg, panel
from geometry import frame,poly,octagon,loft,muted,light,cells,hex_plate,extrude_v,ZR


def large(rot=0,active=False):
    m=core.Mesh("BASTION_heavy_generator")
    f=frame(m,False,rot)
    # A full-bodied fore/aft casing. Its recessed foot is the casing itself.
    loft(f,[(.02,octagon(1.30,.70)),(.17,octagon(1.39,.82)),
            (.72,octagon(1.34,.82)),(1.03,octagon(1.15,.71))],
         ["dark","steelD","steel"],"steel")
    # Recessed seven-cell resonator, normal facing -u, shared console motif.
    hex_plate(f,(-1.40,0,1.18),(0,-1,0),(0,0,1),.72,.65,"steelL")
    hex_plate(f,(-1.42,0,1.18),(0,-1,0),(0,0,1),.625,.045,"dark")
    cells(f,(-1.435,0,1.18),(0,-1,0),(0,0,1),.175,.325,active)
    # Two cast return yokes read as mass rather than an exposed skeletal frame.
    for s in (-1,1):
        profile=[(-1.14,.25),(-.62,.24),(.43,1.26),(.43,1.73),
                 (.20,1.80),(-.19,1.59),(-.64,1.03),(-1.15,.78)]
        # Extrude a local profile in a v-offset frame, without altering anchors.
        # Offset the coordinates explicitly, since frame rotations vary.
        start=len(m.v)
        extrude_v(f,profile,.12,"steelL")
        delta=f.pt(0,s*.62,0)-f.pt(0,0,0)
        for i in range(start,len(m.v)):
            m.v[i]=tuple(m.v[i][k]+delta[k] for k in range(3))
    # Rear conditioning bank and a vertical, physically continuous mast well.
    loft(f,[(.56,[(u+.80,v) for u,v in octagon(.55,.68)]),
            (1.32,[(u+.83,v) for u,v in octagon(.48,.64)]),
            (1.47,[(u+.75,v) for u,v in octagon(.40,.56)])],
         ["steelD","steel"],"steelL")
    muted(m,lambda:f.box(.79,.646,.99,.65,.03,.43,"lens",base=False),.11)
    panel(f,.83,.68,.90,.43,.28,"steelD",face="+v",bolts=False)
    f.box(.80,.730,.90,.17,.025,.045,"plate",base=False)
    for z in (.58,.74):
        seg(f,(.29,.71,z),(.59,.71,z),.055,"steelD",cap="steelL")
    loft(f,[(1.18,octagon(.46,.45,.14)),(ZR-.20,octagon(.37,.39,.12)),
            (ZR,octagon(.47,.47,.13))],["blueGrey","steelL"],"dark")
    # Inset shoulder band is a field coil, not coloured paint.
    f.box(-.386,0,1.75,.035,.42,.095,"dark",base=False)
    light(m,lambda:f.box(-.41,0,1.75,.015,.32,.035,"cyan",base=False),.08 if active else 0)
    # Single tiny pilot remains powered in the idle reference.
    light(m,lambda:f.box(-1.394,.29,.38,.025,.045,.035,"cyan",base=False),.045)
    return [m.build()]


def small(rot=0,active=False):
    m=core.Mesh("WARD_compact_field_pump")
    f=frame(m,True,rot)
    # Lower the pressure case instead of shortening the swept upper spine.
    # This is still the machine's casing, seated directly on the ship deck.
    loft(f,[(.02,octagon(.70,.70,.24)),(.18,octagon(.86,.86,.28)),
            (.50,octagon(.83,.83,.27)),(.86,octagon(.64,.68,.20))],
         ["dark","steelD","steel"],"steel")
    muted(m,lambda:f.box(-.72,0,.36,.035,.89,.21,"lens",base=False),.12)
    # Recover the original 2.4-height spine's sweep and vertical length by
    # dropping its roots into the lower case. Its ceiling socket stays at 2.05.
    profile=[(.24,.37),(.77,.30),(.83,.90),(.65,1.52),
             (.29,ZR-.06),(-.17,ZR),(-.29,ZR-.16),(.13,1.44),(.26,.92)]
    extrude_v(f,profile,.30,"steelL")
    muted(m,lambda:poly(f,[(.42,.313,.59),(.68,.313,.88),(.52,.313,1.42),
                          (.21,.313,1.80),(.06,.313,1.75),(.33,.313,1.33)],"lens"),.11)
    f.vcyl(-.02,0,ZR-.12,.32,.12,"steelD",top="dark",sides=8)
    # Tilted top lens: seven cells, but compact and upward-facing.
    a,b=(0,-1,0),(.835,0,.55)
    normal=Vector(a).cross(Vector(b)).normalized()
    lens=Vector((-.25,0,1.02))+normal*.14
    # The casing lid is z=0.86. The lowest face corner still clears it by 0.046
    # tiles; a narrower socket joins the back to the case rather than floating.
    hex_plate(f,lens-normal*.105,a,b,.445,.20,"steelD")
    hex_plate(f,lens,a,b,.485,.105,"steelL")
    cells(f,lens+normal*.018,a,b,.105,.194,active)
    # One maintenance cassette, one field return line; no busy fin array.
    panel(f,.08,.817,.35,.50,.26,"steelD",face="+v",bolts=False)
    f.box(.08,.868,.35,.16,.025,.045,"plate",base=False)
    seg(f,(.46,.45,.48),(.46,.45,.79),.045,"steelD",cap="steelL")
    light(m,lambda:f.box(-.856,-.16,.27,.018,.04,.035,"cyan",base=False),.045)
    return [m.build()]
