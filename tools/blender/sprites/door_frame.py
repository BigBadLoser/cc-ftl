"""The door frame's face treatments (door_block.door's `frame`), on the metal look's frame:

  ring     a band a px proud and a px wide round the opening, a px out from its edge (following the cuts), a shade
           lighter than the face
  hazard   the jambs' fronts in yellow and black bands at 45 degrees
  mech     an inset panel along the header (a shade darker, its bottom edge lit) with vent slits either side of the
           lamp; a groove down each jamb with a bolt at either end

Paint (a groove, a band) is a polygon a hair in front of the face: flat tones, so a dark line reads as a groove."""
import math

from . import door_block as DB

FRAMES = ("plain", "ring", "hazard", "mech")
EPS = 1e-3


def _px(p):
    return p[0] / DB.PU, p[1] / DB.PZ


def _uz(p):
    return p[0] * DB.PU, p[1] * DB.PZ


def _paint(k, vw, poly, tone):
    if poly:
        k.poly([(u, vw + EPS, z) for u, z in poly], tone)


def _rect(u0, u1, z0, z1):
    return [(u0, z0), (u1, z0), (u1, z1), (u0, z1)]


def _offset(line, d):
    """A polyline (px) offset d px to its left, mitred."""
    def nrm(a, b):
        du, dz = b[0] - a[0], b[1] - a[1]
        n = math.hypot(du, dz)
        return -dz / n, du / n
    out = []
    for i, p in enumerate(line):
        ns = [nrm(line[i - 1], p)] if i else []
        ns += [nrm(p, line[i + 1])] if i + 1 < len(line) else []
        if len(ns) == 2:
            (a, b), (c, e) = ns
            m = 1 + a * c + b * e
            out.append((p[0] + d * (a + c) / m, p[1] + d * (b + e) / m))
        else:
            out.append((p[0] + d * ns[0][0], p[1] + d * ns[0][1]))
    return out


def _ring(k, vw, face):
    ct, cbu, cbz = DB.CT, DB.CBU, DB.CBZ
    line = [_px(p) for p in ((-DB.HW + cbu, 0.0), (-DB.HW, cbz), (-DB.HW, DB.ZO - ct), (-DB.HW + ct, DB.ZO),
                             (DB.HW - ct, DB.ZO), (DB.HW, DB.ZO - ct), (DB.HW, cbz), (DB.HW - cbu, 0.0))]
    (a, b), (c, d) = line[0], line[1]                   # (run past the floor at both ends, then cut at it)
    line = [(a - (c - a), b - (d - b))] + line
    (a, b), (c, d) = line[-1], line[-2]
    line = line + [(a - (c - a), b - (d - b))]
    lo, hi = _offset(line, 1.0), _offset(line, 2.0)     # (the line runs clockwise round the opening: out is its
                                                        # left)
    for i in range(len(line) - 1):
        q = DB._clip([_uz(p) for p in (lo[i], lo[i + 1], hi[i + 1], hi[i])], 0, -1, 0.0)
        if q:
            k.prism(q if _ccw(q) else q[::-1], vw, vw + DB.PU, face + "l")


def _ccw(q):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(q, q[1:] + q[:1])) > 0


def _hazard(k, vw, hf):
    w = 2                                               # band px (along z)
    for s in (-1, 1):
        u0, u1 = (-0.5 + DB.PU, -DB.HW) if s < 0 else (DB.HW, 0.5 - DB.PU)   # (inside the feet's fins)
        n = int(DB.ZO / DB.PZ) + 8
        for i in range(-4, n):
            z0 = i * w * DB.PZ
            rise = (u1 - u0) / DB.PU * DB.PZ            # (45 degrees in px)
            p = [(u0, z0), (u1, z0 + rise), (u1, z0 + rise + w * DB.PZ), (u0, z0 + w * DB.PZ)]
            for a, b, c in ((-1, 0, -u0), (1, 0, u1), (0, -1, 0.0), (0, 1, DB.ZO)):
                p = DB._clip(p, a, b, c) if p else p
            _paint(k, vw, p, "dHzY" if i % 2 == 0 else "dHzK")


def _mech(k, vw, hf, face):
    zl = (DB.ZO + DB.PZ + hf) / 2                       # (the lamp's centre)
    z0, z1 = DB.ZO + DB.PZ, hf - DB.PZ
    _paint(k, vw, _rect(-DB.HW + DB.PU, DB.HW - DB.PU, z0, z1), face + "d")        # the inset panel
    _paint(k, vw, _rect(-DB.HW + DB.PU, DB.HW - DB.PU, z0, z0 + DB.PZ), face + "l")
    for s in (-1, 1):
        for i in range(3):                              # vent slits, 2 px apart, from 2 px off the lamp
            u = s * (DB.LAMP[0] / 2 + 2 + 2 * i) * DB.PU
            a, b = (u, u + DB.PU) if s > 0 else (u - DB.PU, u)
            k.poly([(a, vw + 2 * EPS, zl - 1.5 * DB.PZ), (b, vw + 2 * EPS, zl - 1.5 * DB.PZ),
                    (b, vw + 2 * EPS, zl + 1.5 * DB.PZ), (a, vw + 2 * EPS, zl + 1.5 * DB.PZ)], face + "dd")
        uc = s * (0.5 + DB.HW) / 2                      # the jamb's middle px
        a, b = uc - DB.PU / 2, uc + DB.PU / 2
        _paint(k, vw, _rect(a, b, 5 * DB.PZ, DB.ZO - 5 * DB.PZ), face + "dd")
        for zb in (3 * DB.PZ, DB.ZO - 2 * DB.PZ):
            _paint(k, vw, _rect(a, b, zb - DB.PZ, zb), face + "l")


def trim(k, kind, vw, hf, face):
    """The frame's treatment `kind` (FRAMES) on its face at v = vw; `face` its tone ("bkY" / "bkX")."""
    if kind == "ring":
        _ring(k, vw, face)
    elif kind == "hazard":
        _hazard(k, vw, hf)
    elif kind == "mech":
        _mech(k, vw, hf, face)
