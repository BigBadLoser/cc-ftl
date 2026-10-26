"""Small strut/vent corrections, with an audit against the approved v2 mesh."""
from collections import Counter
import numpy as np
from . import core
from .core_systems_blockout import Reactor, LifeSupport


def parameters(name):
    # At this fixed camera the face-on strut is eight native pixels wide.
    # Align its two straight sides to pixel boundaries, rather than letting a
    # half-covered edge flip between the casing and strut colour each row.
    return Reactor(rib_width=8 / core.PXU) if name == 'reactor' else LifeSupport(refined_vents=True)


def faces(me):
    return Counter(tuple(sorted(tuple(round(float(c), 6) for c in me.vertices[i].co)
                                for i in p.vertices)) for p in me.polygons)


def audit(name, approved, revised):
    assert len(approved) == len(revised) == 2
    # The entire separate mechanical-hardware object must remain exact.
    assert faces(approved[1]) == faces(revised[1].data)
    if name == 'reactor':
        a, b = approved[0], revised[0].data
        assert len(a.polygons) == len(b.polygons)
        assert [tuple(p.vertices) for p in a.polygons] == [tuple(p.vertices) for p in b.polygons]
        qa = np.array([v.co[:] for v in a.vertices])
        qb = np.array([v.co[:] for v in b.vertices])
        delta = qb - qa
        changed = np.max(np.abs(delta), axis=1) > 1e-7
        assert int(changed.sum()) == 288  # four 12-corner extruded support profiles
        assert np.max(np.abs(delta[:, 2])) == 0
        expected = (8 / core.PXU - .16) / (2 * np.sqrt(2))
        assert np.allclose(np.abs(delta[changed, :2]), expected, atol=1e-7)
        return {'strutVerticesChanged': 288, 'otherVerticesExact': True,
                'topologyExact': True, 'strutWidth': 8 / core.PXU,
                'changePerSide': (8 / core.PXU - .16) / 2}
    a, b = faces(approved[0]), faces(revised[0].data)
    removed, added = a - b, b - a
    # Only the hood and roof inlet topology may differ. All lower castings,
    # cassettes, pressure reservoirs and separate hardware remain exact.
    for face in list(removed) + list(added):
        assert min(p[2] for p in face) >= 1.11 - 1e-6
        assert max(p[2] for p in face) <= 1.5 + 1e-6
    return {'hoodFacesRemoved': sum(removed.values()), 'hoodFacesAdded': sum(added.values()),
            'lowerGeometryExact': True, 'mechanicalHardwareExact': True,
            'frontOpeningHeight': .17, 'frontRecessDepth': .065}
