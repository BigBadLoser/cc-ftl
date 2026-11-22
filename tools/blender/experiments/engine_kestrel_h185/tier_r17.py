"""Kestrel tier fit-out study, round 17: round 15's FA machine and base (side castings, sponsons, guarded bells) kept
as they were; the grey block between the side castings (the Mk I sump) becomes each concept's own casting, its
inboard end (under and behind the crown) shaped to show it.

  IA keel cradle: the solid block opened into a ribbed cradle: two lightened girders, transverse webs carrying the
     casing, a raked end bulkhead with a flanged inlet and a feed trunk to the crown's stem. Mk III: deeper girders,
     X-bracing between the webs.
  IB tank: the block is a propellant tank lying on saddles between the castings, its domed end facing out with a
     valve manifold and banding. Mk III: twin tanks side by side and a cross-feed header.
  IC vault: the block is a barrel-vaulted gearbox housing, ribbed, its half-round end a bolted cover with the input
     shaft boss and a sight glass. Mk III: a longer vault with a raised lantern and a second cover.
"""
import math

from sprites import detail as D, greeble as G
import tierkit as T
from geometry import sleeve
from tier_r15 import _trunk, fa_base

W = 0.84          # half the clear width between the side castings


def _none(u0, ue, stem_u):
    return None


def _stem(big):
    uc = -2.45 if not big else -2.9
    return uc - 0.45


def _half_disc(f, u, zc, r, mat, face):
    n = 16
    pts = [f.pt(u, r * math.cos(math.pi * k / n), zc + r * math.sin(math.pi * k / n)) for k in range(n + 1)]
    f.poly(pts if face < 0 else pts[::-1], mat, flip=True)


def _vault(f, p, q, zc, r, mat="steelD", cap="blueGrey"):
    sleeve(f, [(p, r, zc), (q, r, zc)], mat, sides=24, t0=0, t1=math.pi)
    _half_disc(f, p, zc, r, cap, -1)
    _half_disc(f, q, zc, r, cap, 1)


# ---- IA: keel cradle -------------------------------------------------------------------------------------------------

def keel(f, fs, tier, a):
    big = tier == 3
    top = a - 0.63
    stem_u = _stem(big)

    def sump(segs):
        u0 = segs[0][0] - 0.15
        for i, (p, q) in enumerate(segs):
            if i == 0:
                p = u0 + 0.05
            f.box((p + q) / 2, 0, 0, q - p, 2 * W, 0.1, "steelD", top="plateB")
            gh = top - 0.12 if not big else top - 0.04
            for side in (-1, 1):
                v = side * 0.5
                T._m().prism(f, [(p, 0.1), (p, gh), (q, gh), (q, 0.1)], v - 0.05, v + 0.05, "steel", "steelL")
                n = int((q - p) / 0.4)
                for k in range(n):
                    G.disc(f, "+v" if side > 0 else "-v", p + 0.2 + k * 0.4, (0.1 + gh) / 2, v + side * 0.05,
                           min(0.11, (gh - 0.1) * 0.3), -0.002, 0.004, "dark", sides=10)
            webs = []
            u = p + 0.15 if i else p + 0.45
            while u < q - 0.05:
                webs.append(u)
                u += 0.3
            for u in webs:
                f.box(u, 0, 0.1, 0.05 if not big else 0.08, 2 * W - 0.04, top - 0.12, "steelD", top="steel")
                f.box(u, 0, top - 0.04, 0.12, 1.0, 0.04, "steelL", base=False)
            if big:
                for w0, w1 in zip(webs, webs[1:]):
                    for side in (-1, 1):
                        v = side * 0.57
                        D.seg(f, (w0, v, 0.14), (w1, v, gh - 0.04), 0.025, "steelL", 6)
                        D.seg(f, (w0, v, gh - 0.04), (w1, v, 0.14), 0.025, "steelL", 6)
        # Raked end bulkhead with its inlet, and the trunk to the stem.
        e = u0 + 0.05
        T._m().prism(f, [(e, 0), (e, 0.62), (e + 0.3, top + 0.1), (e + 0.42, top + 0.1), (e + 0.42, 0)], -W, W,
                     "navy", "blueGrey")
        G.disc(f, "-u", 0, 0.34, e, 0.2, 0, 0.04, "brass", sides=16)
        G.disc(f, "-u", 0, 0.34, e, 0.14, 0.04, 0.05, "dark", sides=16)
        T.bolts(f, e - 0.04, 0.34, 0.17, n=8)
        _trunk(f, e + 0.34, top + 0.1, stem_u, a)

    fa_base(f, fs, tier, a, _none, sump=sump)


# ---- IB: tank --------------------------------------------------------------------------------------------------------

def _tank(f, p, q, v, zc, r):
    f.hcyl(p + 0.12, q, v, zc, r, "steelL", sides=20, cap="steel")
    f.hcyl(p, p + 0.12, v, zc, r * 0.82, "steelL", r1=r, sides=20, capstart="steelL")
    f.hcyl(p - 0.05, p, v, zc, r * 0.45, "steel", r1=r * 0.82, sides=16, capstart="steel")
    n = max(2, int((q - p) / 0.45))
    for k in range(n):
        u = p + 0.3 + k * (q - p - 0.45) / max(1, n - 1)
        f.hcyl(u - 0.03, u + 0.03, v, zc, r + 0.02, "brass", sides=20, cap="brass", capstart="brass")
    for u in (p + 0.25, q - 0.2):
        f.box(u, v, 0, 0.12, r * 1.6, zc - r * 0.55, "navy", top="blueGrey")
    D.seg(f, (p - 0.05, v, zc), (p - 0.18, v, zc), 0.06, "steel", 10, cap="steelL")
    G.valve_wheel(f, "-u", v, zc, p - 0.18, r=0.1)


def tank(f, fs, tier, a):
    big = tier == 3
    top = a - 0.63
    stem_u = _stem(big)

    def sump(segs):
        u0 = segs[0][0] - 0.15
        p, q = u0 + 0.3, segs[0][1] - 0.05
        if not big:
            r = (top - 0.08) / 2
            _tank(f, p, q, 0, 0.06 + r, r)
            f.vcyl(stem_u - 0.25, 0, 0.06 + 2 * r, 0.08, 0.08, "steel", top="steelL", sides=10)
            _trunk(f, stem_u - 0.25, 0.14 + 2 * r, stem_u, a)
        else:
            r = min(0.38, (top - 0.08) / 2)
            for v in (-0.42, 0.42):
                _tank(f, p, q, v, 0.06 + r, r)
            hu = p + 0.12
            D.seg(f, (hu, -0.42, 0.06 + 2 * r + 0.05), (hu, 0.42, 0.06 + 2 * r + 0.05), 0.06, "steel", 10,
                  cap="steelL", capstart="steelL")
            for v in (-0.42, 0.42):
                f.vcyl(hu, v, 0.06 + 2 * r - 0.02, 0.05, 0.08, "steel", top="steel", sides=8)
            _trunk(f, hu, 0.06 + 2 * r + 0.05, stem_u, a)
        for p2, q2 in segs[1:]:
            f.box((p2 + q2) / 2, 0, 0, q2 - p2, 2 * W, 0.12, "steelD", top="steel")
        f.box((u0 + 0.05 + q) / 2, 0, 0, q - u0 - 0.05, 2 * W, 0.06, "plateA", top="plateB")

    fa_base(f, fs, tier, a, _none, sump=sump)


# ---- IC: vault -------------------------------------------------------------------------------------------------------

def vault(f, fs, tier, a):
    big = tier == 3
    top = a - 0.63
    stem_u = _stem(big)

    def sump(segs):
        u0 = segs[0][0] - 0.15
        r = min(W - 0.02, top - 0.08)
        zc = 0.08
        for i, (p, q) in enumerate(segs):
            if i == 0:
                p = u0 + 0.25
            f.box((p + q) / 2, 0, 0, q - p, 2 * W, zc, "steelD", top="steel")
            _vault(f, p, q, zc, r)
            n = int((q - p) / 0.3)
            for k in range(1, n):
                u = p + k * (q - p) / n
                sleeve(f, [(u - 0.03, r + 0.03, zc), (u + 0.03, r + 0.03, zc)], "steelL", sides=24, t0=0,
                              t1=math.pi)
        # The end cover: a bolted half-round plate, the input shaft boss and a sight glass.
        e = u0 + 0.25
        sleeve(f, [(e - 0.06, r + 0.04, zc), (e, r + 0.04, zc)], "blueGrey", sides=24, t0=0, t1=math.pi)
        _half_disc(f, e - 0.06, zc, r + 0.04, "blueGrey", -1)
        for k in range(7):
            t = math.pi * (k + 0.5) / 7
            G.disc(f, "-u", (r - 0.04) * math.cos(t), zc + (r - 0.04) * math.sin(t), e - 0.06, 0.035, 0, 0.03, "plate",
                   sides=6)
        G.disc(f, "-u", 0, zc + r * 0.45, e - 0.06, 0.13, 0, 0.1, "steelD", sides=16)
        G.disc(f, "-u", 0, zc + r * 0.45, e - 0.06, 0.07, 0.1, 0.16, "steelL", sides=12)
        G.disc(f, "-u", 0.38, zc + 0.18, e - 0.06, 0.06, 0, 0.02, "lens", sides=10)
        _trunk(f, e + 0.2, zc + r - 0.02, stem_u, a)
        if big:
            # A raised lantern along the vault's crown, louvred, and a second cover forward of the rings' gap.
            p, q = e + 0.4, segs[0][1] - 0.1
            if q - p > 0.3:
                f.box((p + q) / 2, 0, zc + r - 0.08, q - p, 0.42, 0.14, "navy", top="blueGrey")
                for k in range(int((q - p) / 0.12)):
                    f.box(p + 0.08 + k * 0.12, 0.215, zc + r - 0.04, 0.05, 0.01, 0.08, "dark", base=False)
                    f.box(p + 0.08 + k * 0.12, -0.215, zc + r - 0.04, 0.05, 0.01, 0.08, "dark", base=False)
            for side in (-1, 1):
                G.disc(f, "-u", side * 0.5, zc + 0.2, e - 0.06, 0.08, 0, 0.08, "brass", sides=10)

    fa_base(f, fs, tier, a, _none, sump=sump)
