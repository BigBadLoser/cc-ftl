"""Traces the realistic base body into smooth sections for the v2 crew base (human_v2): the old silhouette and proportions
without the sculpted anatomy that turns to noise at game size.

Each limb bone's verts (dominant group; fingers fold into the hand, toes into the foot) are sliced along the bone: per
station the section's centre and its half extents across the bone (front/back and up/side), then the stations are
smoothed so muscle bumps go. The torso (hips, spine chain, clavicles) and the head (neck and head) are sliced
horizontally the same way, with skin weights per slice from the bones its verts follow. Rest space: z up, feet at 0,
front = -y, +x = character left, arms out in a T."""
import numpy as np
from mathutils import Vector

FOLD = {"index": "hand", "middle": "hand", "ring": "hand", "pinky": "hand", "thumb": "hand", "toe": "foot"}
TORSO = ("hips", "spine", "spine_02", "spine_03", "clavicle.L", "clavicle.R")
HEAD = ("neck_01", "head")
LIMBS = ("arm", "forearm", "hand", "leg", "shin", "foot")


def fold(name):
    base, _, side = name.partition(".")
    for k, v in FOLD.items():
        if base.startswith(k):
            return f"{v}.{side}"
    return name


def verts_by_bone(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    out = {}
    for v in ob.data.vertices:
        if v.groups:
            g = max(v.groups, key=lambda g: g.weight)
            out.setdefault(fold(names[g.group]), []).append(tuple(v.co))
    return {k: np.array(v) for k, v in out.items()}


def smooth(a, passes=2):
    a = np.array(a, float)
    for _ in range(passes):
        b = a.copy()
        b[1:-1] = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4
        a = b
    return a


def frame(axis):
    """Two unit vectors across `axis`: e2 as near world up as it can be (world -y, front, for upright bones)."""
    a = Vector(axis).normalized()
    ref = Vector((0, 0, 1)) if abs(a.z) < 0.8 else Vector((0, -1, 0))
    e2 = (ref - a * a.dot(ref)).normalized()
    return a, e2.cross(a), e2


def limb(P, head, tail, step=0.045, lo_pad=0.0, hi_pad=0.0, round_=False):
    """Sections of one limb part: [(centre, e1, e2, r1, r2)] from head to tail. The centre line is fitted straight and
    the radii as a smooth taper (a quadratic over the length), so the old muscle bulges go; round_: circular sections
    (the radius is the mean of the two), so a roll of the bone in a clip does not show."""
    a, e1, e2 = frame(Vector(tail) - Vector(head))
    h = np.array(head)
    t = (P - h) @ np.array(a)
    lo, hi = np.percentile(t, 1) - lo_pad, np.percentile(t, 99) + hi_pad
    n = max(3, int(round((hi - lo) / step)) + 1)
    rows = []
    prev = None
    for ti in np.linspace(lo, hi, n):
        sel = P[np.abs(t - ti) < (hi - lo) / (n - 1) * 0.8]
        if len(sel) < 5:
            if prev is None:
                continue
            rows.append((ti, *prev[1:]))
            continue
        u, w = (sel - h) @ np.array(e1), (sel - h) @ np.array(e2)
        u0, u1 = np.percentile(u, (4, 96))
        w0, w1 = np.percentile(w, (4, 96))
        prev = (ti, (u0 + u1) / 2, (w0 + w1) / 2, (u1 - u0) / 2, (w1 - w0) / 2)
        rows.append(prev)
    R = np.array(rows)
    ts = R[:, 0]
    cu, cw = (np.polyval(np.polyfit(ts, R[:, k], 1), ts) for k in (1, 2))
    deg = 1 if round_ or len(ts) <= 3 else 2                                 # arms: a straight taper (no deltoid bulge)
    r1, r2 = (np.polyval(np.polyfit(ts, R[:, k], deg), ts) for k in (3, 4))
    if round_:
        r1 = r2 = (r1 + r2) / 2
    out = []
    for ti, a0, b0, x1, x2 in zip(R[:, 0], cu, cw, r1, r2):
        c = Vector(h) + a * float(ti) + e1 * float(a0) + e2 * float(b0)
        out.append((c, e1, e2, max(float(x1), 0.02), max(float(x2), 0.02)))
    return out


def stack(by, bones, z0, z1, step=0.04):
    """Horizontal sections of the verts of `bones` between z0 and z1: [(centre, hx, hy, weights)]."""
    P = np.vstack([by[b] for b in bones if b in by])
    owner = np.concatenate([[b] * len(by[b]) for b in bones if b in by])
    n = max(3, int(round((z1 - z0) / step)) + 1)
    rows = []
    for z in np.linspace(z0, z1, n):
        m = np.abs(P[:, 2] - z) < (z1 - z0) / (n - 1) * 0.8
        if m.sum() < 6:
            continue
        s = P[m]
        x0, x1 = np.percentile(s[:, 0], (3, 97))
        y0, y1 = np.percentile(s[:, 1], (3, 97))
        names, counts = np.unique(owner[m], return_counts=True)
        wt = {}
        for nm, c in zip(names, counts):
            nm = "spine_03" if nm.startswith("clavicle") else nm
            wt[nm] = wt.get(nm, 0) + c / counts.sum()
        rows.append((z, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, wt))
    zs = [r[0] for r in rows]
    cy, hx, hy = (smooth([r[k] for r in rows]) for k in (2, 3, 4))
    return [(Vector((0.0, float(y), float(z))), float(a), float(b), r[5]) for z, y, a, b, r in zip(zs, cy, hx, hy, rows)]


def measure(arm, body):
    """Everything human_v2 builds on, from the base body mesh (`body`, still with its arms) and the rest bones."""
    by = verts_by_bone(body)
    B = arm.data.bones
    h = {b.name: Vector(b.head_local) for b in B}
    t = {b.name: Vector(b.tail_local) for b in B}
    out = {"limb": {}}
    for s in "LR":
        out["limb"][f"arm.{s}"] = limb(by[f"arm.{s}"], h[f"arm.{s}"], t[f"arm.{s}"], round_=True, lo_pad=-0.03)
        out["limb"][f"forearm.{s}"] = limb(by[f"forearm.{s}"], h[f"forearm.{s}"], t[f"forearm.{s}"], round_=True)
        out["limb"][f"hand.{s}"] = limb(by[f"hand.{s}"], h[f"hand.{s}"], t[f"hand.{s}"], step=0.03)
        out["limb"][f"leg.{s}"] = limb(by[f"leg.{s}"], h[f"leg.{s}"], t[f"leg.{s}"])
        out["limb"][f"shin.{s}"] = limb(by[f"shin.{s}"], h[f"shin.{s}"], t[f"shin.{s}"])
        out["limb"][f"foot.{s}"] = limb(by[f"foot.{s}"], h[f"foot.{s}"], t[f"toe.{s}"], step=0.035)
    hz = max(b[:, 2].max() for k, b in by.items() if k == "head")
    tz = by["hips"][:, 2].min()
    out["torso"] = stack(by, TORSO, tz, h["neck_01"].z + 0.02)
    out["head"] = stack(by, HEAD, h["neck_01"].z - 0.02, hz - 0.01, step=0.03)
    return out
