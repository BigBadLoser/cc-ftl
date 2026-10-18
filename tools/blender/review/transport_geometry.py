"""Measured envelope, access and mechanism checks for transport review poses."""
import math
import numpy as np


def validate(craft,core,setup,faction):
    # Measure the new geometry, not the untouched original craft's constants.
    setup()
    parked=craft.transport_shuttle(0,"parked")
    q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in parked])
    dims=np.ptp(q,axis=0)
    assert dims[0]<=5.0+1e-5 and dims[1]<=3.9+1e-5
    assert np.abs(q[:,0]).max()<2.5 and np.abs(q[:,1]).max()<2
    assert abs(q[:,2].min())<1e-6 and abs(q[:,2].max()-craft.TRANSPORT_HEIGHT)<1e-5
    pit=craft.TRANSPORT_PIT
    assert q[:,2].max()-pit<2.05 and pit>dims[2]/2
    setup()
    flight=craft.transport_shuttle(0,"fly")
    coords=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in flight])
    assert abs(np.ptp(coords[:,1])-craft.TRANSPORT_WING_SPAN)<1e-5
    # Isolate the moving foils and check the folded pose clears the boarding leaf.
    from lib.transport_forms import FlightFrame
    moving=core.Mesh("review_folded_foils")
    for side in (-1,1):
        craft.transport_wing(FlightFrame(moving,0),side,craft.TRANSPORT_FOLD)
    from lib.transport_hatch import HATCH_U,HATCH_RADIUS
    from lib.transport_ramp import REAR_SLOPE,rear_u,loading_ramp
    door_min=HATCH_U-HATCH_RADIUS
    moving_u=max(p[0] for p in moving.v)
    assert moving_u<door_min-.10
    assert craft.TRANSPORT_HATCH_HEIGHT>=1.60
    # Enforce the requested stern: upper edge farther aft than the lower hinge.
    assert rear_u(2.03)<rear_u(.70)-.30
    ramp=core.Mesh("review_closed_ramp")
    loading_ramp(FlightFrame(ramp,0))
    rq=np.array(ramp.v)
    assert rq[rq[:,2]>1.95,0].max()<rq[rq[:,2]<.75,0].min()-.25
    from lib.transport_mounts import wing_mount,MOUNT_BASE_Z,MOUNT_SEAT_Z
    mount=core.Mesh("review_mount")
    wing_mount(FlightFrame(mount,0),1)
    mq=np.array(mount.v)
    lower=mq[np.isclose(mq[:,2],MOUNT_BASE_Z)]
    upper=mq[np.isclose(mq[:,2],MOUNT_SEAT_Z)]
    assert upper[:,0].max()<lower[:,0].max()-.40
    assert np.ptp(upper[:,1])<np.ptp(lower[:,1])-.20
    glow_faces=0
    for ob in flight:
        attr=ob.data.color_attributes["Glow"]
        for poly in ob.data.polygons:
            if any(max(attr.data[i].color[:3])>0 for i in poly.loop_indices):
                p=np.array([ob.data.vertices[i].co[:] for i in poly.vertices])
                assert p[:,0].max()< -2.16 and np.abs(np.abs(p[:,1])-1.38).max()<.17
                glow_faces+=1
    # The lowered ramp reaches the landing datum and extends outside the stowed envelope.
    setup()
    lowered=craft.transport_shuttle(0,"parked",ramp_open=1)
    ramp_q=np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in lowered])
    assert ramp_q[:,2].min()>=-1e-4 and ramp_q[:,0].min() < -3.0
    height=craft.TRANSPORT_HEIGHT
    def area(points):
        return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1])))/2
    wing_area=2*(area(craft.TRANSPORT_WING)+area(craft.TRANSPORT_OUTER_WING))
    assert wing_area>10.0
    design={"variant":"B / full-chord folding-wing utility shuttle / revision 6","legacyV4Preserved":True,
            "parkedSize":[round(float(dims[1]),4),round(float(dims[0]),4),height],
            "pitDepth":pit,"topAboveDeck":round(height-pit,4),"roofTop":2.05,
            "clearanceToRoofTop":round(2.05-(height-pit),4),"flightSpan":craft.TRANSPORT_WING_SPAN,
            "deployedWingPlanArea":round(wing_area,4),"previousWingPlanArea":10.3982,
            "boardingOpeningHeight":craft.TRANSPORT_HATCH_HEIGHT,
            "boardingOpeningShape":"circle","boardingOpeningDiameter":2*HATCH_RADIUS,
            "rearFaceAngleFromVertical":round(abs(math.degrees(math.atan(REAR_SLOPE))),2),
            "rearSlopeDirection":"upper edge aft / lower hinge toward nose",
            "rearTopU":round(rear_u(2.03),4),"rearBottomU":round(rear_u(.70),4),
            "rearSlopeGeometryCheck":"passed",
            "mountFrontBaseU":round(float(lower[:,0].max()),4),
            "mountFrontSeatU":round(float(upper[:,0].max()),4),
            "mountSeatHeight":MOUNT_SEAT_Z,"mountTaperGeometryCheck":"passed",
            "hatchFeatures":["opaque inspection porthole","pressure equalisation valve"],
            "loadingRamp":"bottom-hinged / closed and lowered review poses",
            "canopyFrontU":2.43,"canopyFrontTop":1.54,"canopyFrontWidth":.64,
            "foldedWingClearanceAheadOfDoorLeaf":round(door_min-moving_u,4),
            "reviewFactionColors":faction,
            "wingFoldDegrees":180,"wingFoldPlane":"longitudinal roll / flat over aft roof",
            "outerPanelFoldDegrees":180,"wingStorage":"outer panels stacked flat over aft hull",
            "deployedWingChord":2.7,"doorLeafMinimumU":round(door_min,4),
            "loweredRampMinimumU":round(float(ramp_q[:,0].min()),4),"loweredRampGroundCheck":"passed",
            "spriteSamples":4,"beautySamples":8,"glowingNozzleFaces":glow_faces,
            "previewOnly":True,"renderedFlights":[0,2,5],"geometryChecks":"passed"}
    return design,pit
