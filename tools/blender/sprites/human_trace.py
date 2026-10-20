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
UPPER_K = (1.12, 1.45, 1.12)          # upper arm thickness against the traced arm: shoulder, bicep, elbow
FORE_K = (1.08, 1.02, 0.95)           # forearm: elbow, a third down, wrist


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


def limb(P, head, tail, step=0.045, lo_pad=0.0, hi_pad=0.0, round_=False, axis=False):
    """Sections of one limb part: [(centre, e1, e2, r1, r2)] from head to tail. The centre line is fitted straight and
    the radii as a smooth taper (a quadratic over the length), so the old muscle bulges go; round_: circular sections
    (the radius is the mean of the two), so a roll of the bone in a clip does not show; axis: the centre on the bone line
    itself, so consecutive parts meet at the joint (a traced centre drifts with the muscle and steps at the elbow)."""
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
    cu, cw = (np.polyval(np.polyfit(ts, R[:, k], 1), ts) * (0.0 if axis else 1.0) for k in (1, 2))
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


def tidy_torso(rows, h, arm_r, leg_out):
    """The traced torso tidied for game size: a straight back from the seat to the shoulder blades (the traced seat and
    small of the back curve the spine in a side view), a pinched waist, room under the arms (the hanging upper arm,
    radius arm_r at the bicep, clears the ribs instead of merging into one slab), a rounded shoulder from the neck out over the top
    of the arm (no shrug up to the chin, no dip where the arm meets it) and a pelvis as wide as the thigh tops (leg_out:
    the outside of the thigh), so the legs come out of the hips instead of bulging out under them."""
    hz = h["leg.L"].z
    r0 = rows[0]
    rows = [(Vector((0.0, r0[0].y, z)), r0[1], r0[2], r0[3]) for z in (hz - 0.07, hz - 0.035, hz)] + list(rows)
    narrow = {0: 0.07, 1: 0.035}                                             # in to the crotch below the hip joints
    zs = np.array([r[0].z for r in rows])
    front = np.array([r[0].y - r[2] for r in rows])
    back = np.array([r[0].y + r[2] for r in rows])
    hx = np.array([r[1] for r in rows])
    sz, ax, nz = h["arm.L"].z, abs(h["arm.L"].x), h["neck_01"].z
    kb = int(np.argmax(np.where(zs < sz, back, -1)))                        # the shoulder blades
    kw = int(np.argmin(np.where((zs < sz - 0.1) & (zs > hz + 0.1), hx, 9)))  # the waist
    b0 = back[kw] + 0.008
    for k in range(kb):
        back[k] = b0 + (back[kb] - b0) * (zs[k] - zs[0]) / (zs[kb] - zs[0])
    hx = hx * (1 - 0.1 * np.exp(-((zs - zs[kw]) / 0.07) ** 2))
    under = ax - arm_r - 0.025                                               # clear of the hanging arm
    top, sh, s0 = 0.115, ax - 0.005, sz                                    # neck base; shoulder (over the joint)
    ease = lambda t: t * t * (3 - 2 * t)  # noqa: E731
    for k, z in enumerate(zs):
        if z < hz + 0.08:                                                    # pelvis: out to the thighs
            hx[k] = hx[k] + (leg_out - 0.01 - hx[k]) * ease(min(1.0, (hz + 0.08 - z) / 0.08)) - narrow.get(k, 0.0)
        elif z < sz - 0.09:
            hx[k] = min(hx[k], under)
        elif z < s0:
            hx[k] = under + (sh - under) * ease((z - sz + 0.09) / (s0 - sz + 0.09))
        else:                                                                # a round shoulder in to the neck
            hx[k] = top + (sh - top) * np.sqrt(max(0.0, 1 - ((z - s0) / (nz - s0)) ** 2))
    return [(Vector((0.0, float(f + b) / 2, float(z))), float(x), float(b - f) / 2, r[3])
            for z, f, b, x, r in zip(zs, front, back, hx, rows)]


def bulk(secs, ks):
    """Arm thickness against the traced arm along the part: ks = (top, peak, bottom), the peak a third of the way down,
    eased between (for the upper arm: in towards the shoulder, full at the bicep, tapering to the elbow)."""
    n = max(1, len(secs) - 1)
    k0, kp, k1 = ks

    def k(t):
        if t < 1 / 3:
            u = t * 3
            return k0 + (kp - k0) * (1 - (1 - u) ** 2)                      # rounds out from the shoulder
        u = (t - 1 / 3) * 1.5
        return kp + (k1 - kp) * u * u * (3 - 2 * u)
    return [(c, e1, e2, r1 * k(i / n), r2 * k(i / n)) for i, (c, e1, e2, r1, r2) in enumerate(secs)]


def to_joint(secs, head):
    """The traced thigh starts a hand's width below the hip (the verts above it follow the pelvis): carry its first
    section up to the joint, so the leg comes out of the inside of the pelvis instead of ending in a cap under it."""
    c, e1, e2, r1, r2 = secs[0]
    a = (Vector(secs[-1][0]) - Vector(c)).normalized()
    d = (Vector(c) - Vector(head)).dot(a)
    n = max(1, int(d / 0.045))
    return [(Vector(c) - a * (d * k / n), e1, e2, r1, r2) for k in range(n, 0, -1)] + list(secs)


def wrist(secs, head):
    """The hand's traced offset (the palm hangs below and in front of the bone) eased in from zero at the wrist, so it
    carries on from the forearm without a step."""
    n = len(secs)
    out = []
    for k, (c, e1, e2, r1, r2) in enumerate(secs):
        a = (Vector(c) - Vector(head))
        ax = (Vector(secs[-1][0]) - Vector(secs[0][0])).normalized()
        on = Vector(head) + ax * a.dot(ax)
        out.append((on.lerp(Vector(c), min(1.0, k / max(1, n // 2))), e1, e2, r1, r2))
    return out


def measure(arm, body):
    """Everything human_v2 builds on, from the base body mesh (`body`, still with its arms) and the rest bones."""
    by = verts_by_bone(body)
    B = arm.data.bones
    h = {b.name: Vector(b.head_local) for b in B}
    t = {b.name: Vector(b.tail_local) for b in B}
    out = {"limb": {}}
    for s in "LR":
        out["limb"][f"arm.{s}"] = bulk(limb(by[f"arm.{s}"], h[f"arm.{s}"], t[f"arm.{s}"], round_=True, lo_pad=-0.07,
                                            axis=True), UPPER_K)          # starts low: its dome meets the shoulder
        out["limb"][f"forearm.{s}"] = bulk(limb(by[f"forearm.{s}"], h[f"forearm.{s}"], t[f"forearm.{s}"], round_=True,
                                                axis=True), FORE_K)
        out["limb"][f"hand.{s}"] = wrist(limb(by[f"hand.{s}"], h[f"hand.{s}"], t[f"hand.{s}"], step=0.03), h[f"hand.{s}"])
        out["limb"][f"leg.{s}"] = to_joint(limb(by[f"leg.{s}"], h[f"leg.{s}"], t[f"leg.{s}"]), h[f"leg.{s}"])
        out["limb"][f"shin.{s}"] = limb(by[f"shin.{s}"], h[f"shin.{s}"], t[f"shin.{s}"])
        out["limb"][f"foot.{s}"] = limb(by[f"foot.{s}"], h[f"foot.{s}"], t[f"toe.{s}"], step=0.035)
    hz = max(b[:, 2].max() for k, b in by.items() if k == "head")
    tz = by["hips"][:, 2].min()
    lg = out["limb"]["leg.L"][0]
    out["torso"] = tidy_torso(stack(by, TORSO, tz, h["neck_01"].z, step=0.025), h, out["limb"]["arm.L"][-2][3],
                              abs(lg[0].x) + lg[3])
    # the head alone (the neck is a tube): a slice through both the jaw and the neck turns the chin into a cone
    out["head"] = stack(by, ("head",), by["head"][:, 2].min() + 0.01, hz - 0.01, step=0.03)
    return out
