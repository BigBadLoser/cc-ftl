"""Bastion's straight-run designs (set 8). Its tops fill the wall's cut (the face's "cut" slot: k, ax, plane, f0, f1,
zlo, z0, z1, top, F, m, back; plane the cut's back, bast_r() in from the wall's line, f0..f1 between its posts; its
back face from z0 up to the cornice at z1, its floor the angled face down from it to the lower wall's top at zlo at the
wall's line; m its ends' mitres at a corner, back plane's depth from the face's), and may cut it deeper ("deep") or
with a flat floor ("flat"); its ramps fill the shared "ramp" and "ramp_hole" slots (relief_style.Style.fill)."""
from mathutils import Vector

from .. import wall3d as T
from ..relief_style import Design
from .parts import LINE, PAINT, PZ, prism

BAST_R = 3 / 32                     # how far the recess is cut in behind the lip (three of the shell's cells)


def bast_r():
    """The recess's depth behind the lip: BAST_R, more for a top design that cuts deeper ("deep")."""
    return BAST_R + T.fill("deep", 0.0)


def _cells(k, ax, plane, u0, u1, z0, z1, d, nu, nz, cols):
    """A block of nu x nz lit cells over [u0, u1] x [z0, z1], a px apart, coloured cols[(i + j) % len(cols)]."""
    from ..wall3d_variants import lamp
    w, h = (u1 - u0) / nu, (z1 - z0) / nz
    for i in range(nu):
        for j in range(nz):
            lamp(k, ax, plane, u0 + i * w, u0 + (i + 1) * w - LINE, z0 + j * h, z0 + (j + 1) * h - 0.02, d,
                 cols[(i + j) % len(cols)])


def _frame(k, ax, plane, u0, u1, z0, z1, d, F, lvl, t=0.03):
    """A raised frame t wide round [u0, u1] x [z0, z1], standing d proud."""
    for q in ((u0 - t, u1 + t, z1, z1 + t), (u0 - t, u1 + t, z0 - t, z0), (u0 - t, u0, z0, z1), (u1, u1 + t, z0, z1)):
        T.slab(k, ax, plane, *q, d, F, lvl, ends=(True, True))


def bastion_hood(k, ax, plane, f0, f1, zlo, z0, z1, top, F, m=(0.0, 0.0), back=0.0):
    """The base: a hood under the cornice, two slats across the back (set from the bottom, so they line up where a
    partition meets the taller hull). Returns the hood's and slats' profiles, face-relative, for the corner to carry
    round."""
    R = bast_r()
    # the hood and slats (on the face's own plane, so at a corner their mitres pull back to meet its chamfer)
    profs = [[(0.0, z1 - 0.13), (0.5 * R, z1 - 0.13), (R, z1 - 0.07), (R, z1), (0.0, z1)]]
    profs += [[(0.0, za), (0.7 * R, za), (0.7 * R, za + 0.07), (0.0, za + 0.1)] for za in (z0 + 0.49, z0 + 0.33)]
    profs = [[(d + back, z) for d, z in pr] for pr in profs]
    for i, pr in enumerate(profs):                      # (the slats subdued, as the recess)
        prism(k, ax, plane - back, f0, f1, pr, F, 3 if i == 0 else 2, mitre=m)
    return [(pr, 3 if i == 0 else 2) for i, pr in enumerate(profs)]


def bastion_readout(k, ax, plane, f0, f1, zlo, z0, z1, top, F, m=(0.0, 0.0), back=0.0):
    """T1-2 (a deeper cut): its angled floor raised and flattened, controls on it, an LED readout on the back over
    them, a sloped face from the readout's top out to the cut's top edge, a red strip on the lower wall."""
    from ..wall3d_variants import lamp
    R = bast_r()
    uc, w = (f0 + f1) / 2, f1 - f0
    dl = 2 * PAINT                                      # (lamps stand on the glass)
    T.paint(k, ax, plane, f0, f1, zlo, z1, 0.0, F, 1)                                          # (a dark cut)
    zf = zlo + 0.1                                  # the angled floor, raised: zf at the wall's line, rising
    zb = zf + 0.55 * R                              # gently to the back
    prism(k, ax, plane, f0, f1, [(0.0, zlo), (R, zlo), (R, zf), (0.0, zb)], F, 3, cap=False)   # (its ends the posts')
    a, b = uc - 0.36 * w, uc + 0.36 * w
    va, vb = f0, f1 - R                             # (what shows of the back: it sits as far right on screen as
    rc = (va + vb) / 2                              # the cut is deep, its right end behind the far post)
    hw = min(0.4 * w, (vb - va) / 2)               # (its frame's edge may tuck behind the posts)
    ra, rb = rc - hw, rc + hw                       # the readout, centred on it
    q0 = zb + 0.05                                  # the readout: a dark frame snug round its digits
    d0, d1 = q0 + 0.05, q0 + 0.05 + 5 * PZ          # (the digits 5 px tall)
    q1 = d1 + 0.05
    T.paint(k, ax, plane, ra - LINE, rb + LINE, q0, q1, PAINT / 2, F, 0)    # (over the dark cut, under the digits)
    nd = min(4, int((rb - ra + LINE) / (5 * LINE) + 1e-6))                                            # digits: each an
    u0 = T.snap(rc - (5 * nd - 1) * LINE / 2)       # outline 4 px wide, a px apart, on the px grid (read as 0s), in
    for i in range(nd):                             # a dim red that does not glow (a glow filled them in)
        u, v = u0 + 5 * i * LINE, u0 + (5 * i + 4) * LINE
        for q in ((u, v, d0, d0 + PZ), (u, v, d1 - PZ, d1), (u, u + LINE, d0, d1), (v - LINE, v, d0, d1)):
            lamp(k, ax, plane, *q, dl, "lvR2")
    zr = q1 + 0.04                                  # over it, a face sloping out to the cut's top edge from a
    prism(k, ax, plane, f0, f1, [(0.0, zr), (1 / 32, zr), (R, z1), (0.0, z1)], F, 3, cap=False)  # px lip
    o, up = T.OUT(ax), Vector((0, 0, 1))
    n = (o * (zb - zf) + up * R).normalized()

    def key(u0, u1, g0, g1, col):                   # (on the angled floor; g: the way out it, 0 at its back)
        Q = lambda u, g: T.P(ax, plane, u, zb + g * (zf - zb), g * R) + n * PAINT            # noqa: E731
        k.poly([Q(u0, g0), Q(u1, g0), Q(u1, g1), Q(u0, g1)], F, 0, n, fixed=col)
    for u0, col in ((a, "flameY"), (a + 0.04, "red"), (b - 0.075, "flameY"), (b - 0.035, "red")):
        key(u0, u0 + 0.035, 0.3, 0.7, col)
    key(uc - 0.08, uc + 0.08, 0.2, 0.8, "green")
    lamp(k, ax, plane, uc - 0.22 * w, uc + 0.22 * w, zlo - 0.055, zlo - 0.03, R, "emR")          # the strip


def bastion_equipment(k, ax, plane, f0, f1, zlo, z0, z1, top, F, m=(0.0, 0.0), back=0.0):
    """T1-3 (the cut's floor flat): a piece of equipment from the floor to the wall's top (through the cornice, top)
    in two tiers: the lower standing out past the wall's line, a keypad and a small readout on it, sloping out from
    its top to the upper tier's foot, further out, two readouts on that."""
    from ..wall3d_variants import lamp
    R = bast_r()
    uc, w = (f0 + f1) / 2, f1 - f0
    dl = 2 * PAINT                                      # (lamps stand on the glass)
    A, B = R + 3.5 / 32, R + 7.5 / 32               # the tiers' fronts (past the wall's line by 3.5 and 7.5 px)
    z1 = top - 0.02                                 # (up to the cornice's top: it hides the cornice there)
    H2 = z1 - zlo
    zt, zu = zlo + 0.5 * H2, zlo + 0.5 * H2 + (B - A)                                            # tier 1's top,
    prism(k, ax, plane, f0, f1, [(0.0, zlo), (A, zlo), (A, zt), (0.0, zt)], F, 2)               # tier 2's foot
    prism(k, ax, plane, f0, f1, [(0.0, zt), (A, zt), (B, zu), (B, z1), (0.0, z1)], F, 2)
    fp = plane + A                                  # tier 1: a keypad and a small readout
    r0, r1 = zt - 0.36, zt - 0.08                    # (high on it, where hands reach)
    a, b = uc - 0.36 * w, uc + 0.36 * w
    _frame(k, ax, fp, a, uc - 0.03, r0, r1, 0.025, F, 3)
    T.paint(k, ax, fp, a, uc - 0.03, r0, r1, 0.0, F, 0)
    _cells(k, ax, fp, a + 0.02, uc - 0.05, r0 + 0.02, r1 - 0.02, dl, 3, 4, ("alG",))
    _frame(k, ax, fp, uc + 0.05, b, r0, r1, 0.025, F, 3)
    T.paint(k, ax, fp, uc + 0.05, b, r0, r1, 0.0, F, 0)
    _cells(k, ax, fp, uc + 0.07, b - 0.02, r0 + 0.02, r1 - 0.02, dl, 1, 3, ("green", "flameY"))
    fp = plane + B                                  # tier 2: an indicator readout and a green screen
    q0, q1 = zu + 0.06, z1 - 0.08
    _frame(k, ax, fp, a, a + 0.14, q0, q1, 0.025, F, 3)
    T.paint(k, ax, fp, a, a + 0.14, q0, q1, 0.0, F, 0)
    _cells(k, ax, fp, a + 0.02, a + 0.12, q0 + 0.03, q1 - 0.03, dl, 2, 4, ("flameY", "red"))
    _frame(k, ax, fp, a + 0.19, b, q0, q1, 0.025, F, 3)
    lamp(k, ax, fp, a + 0.19, b, q0, q1, PAINT, "green")


def bastion_module(k, ax, plane, f0, f1, zlo, z0, z1, top, F, m=(0.0, 0.0), back=0.0):
    """T1-4: a module filling the cut, two ribs over a framed indicator panel."""
    from ..wall3d_variants import lamp
    R = bast_r()
    uc, w, H = (f0 + f1) / 2, f1 - f0, z1 - z0
    dl = 2 * PAINT                                      # (lamps stand on the glass)
    prism(k, ax, plane, f0, f1, [(0.0, z0), (R, z0), (R, z1), (0.0, z1)], F, 2)                  # the module
    fp = plane + R
    q0, q1 = z0 + 0.3 * H, z0 + 0.72 * H
    for zz in (q1 + 0.08, q1 + 0.17):                                                            # its ribs
        T.slab(k, ax, fp, f0, f1, zz, zz + 0.05, 0.03, F, 3, ends=(False, False))
    a, b, c, e = uc - 0.36 * w, uc + 0.36 * w, q0 + 0.06, q1 - 0.06
    _frame(k, ax, fp, a, b, c, e, 0.025, F, 3)
    T.paint(k, ax, fp, a, b, c, e, 0.0, F, 0)
    _cells(k, ax, fp, a + 0.02, a + 0.12, c + 0.03, e - 0.03, dl, 2, 3, ("flameY", "red"))      # lit block
    for i, col in enumerate(("red", "flameY", "red", "flameY")):                                  # small lights
        u = a + 0.17 + i * 0.07
        lamp(k, ax, fp, u, u + 2 * LINE, e - 0.09, e - 0.04, dl, col)
    lamp(k, ax, fp, a + 0.19, a + 0.33, c + 0.04, c + 0.1, dl, "green")                           # buttons
    lamp(k, ax, fp, a + 0.36, b - 0.03, c + 0.03, c + 0.11, dl, "red")


BAST_PANEL = (0.15, 0.755)          # the ramp's panel (the base design's outline) and the slot cut where it lies:
                                    # its top and bottom down the run (fractions of it)


def bastion_hole():
    """Where a bastion ramp design opens the ramp (B1-2, B1-3): over its slot, from the slot's back to where its floor
    meets the slope; set in from the stretch's sides as the outlined panel (the cover the base design keeps on it)."""
    return (BAST_PANEL[0], BAST_PANEL[1], -0.08)


SLOT_TONE = {"wall": "fBW2", "blue": "fBH2"}    # the open slot's floor and back wall (step 2, the slope's before
                                                # bastion.SLOPE_LIFT),
SLOT_FOLD = {"wall": "fBW4", "blue": "fBH4"}    # a 2 px shadow along the fold between them (step 4), its sides
SLOT_SIDE = {"wall": "fBW4", "blue": "fBH4"}    # (step 4: the ramp's own cut faces there too,
                                                # bastion.Bastion's hole_tone)


def slot_tone(part, fam, ax, n):
    """The open slot's walls as the solid ramp cuts them (Style.hole_tone): its back and its sides."""
    return (SLOT_TONE if part == "back" else SLOT_SIDE).get(fam) or T.tone(fam, 1, n, ax)


def _slot(k, P, run_, zs, hole, fam):
    """The ramp's slot opened (the hole the shell leaves: o0..o1 along, d0..d1 out): its floor, back and sides."""
    o0, o1, d0, d1 = hole
    ft = T.style().foot
    zat = lambda d: ft + (zs - ft) * (1 - d / run_)    # noqa: E731   the slope's height d out (over its foot)
    zb = zat(d1)                                       # (the floor level, meeting the slope where the slot ends)
    up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    R = T.RAMPS[fam][0]                                 # (SLOT_TONE)
    c = SLOT_TONE.get(fam, R[2])
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zb, d1), P(o0, zb, d1)], fam, 2, up, fixed=c)          # floor,
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zat(d0), d0), P(o0, zat(d0), d0)], fam, 1, out_, fixed=c)  # back
    zf = zb + 2 * PZ                                                        # (2 px of shadow along their fold)
    k.poly([P(o0, zb, d0 + PAINT), P(o1, zb, d0 + PAINT), P(o1, zf, d0 + PAINT), P(o0, zf, d0 + PAINT)],
           fam, 1, out_, fixed=SLOT_FOLD.get(fam, R[0]))
    for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
        k.poly([P(u, zb, d0), P(u, zat(d0), d0), P(u, zb, d1)], fam, 1, along * sg, fixed=SLOT_SIDE.get(fam))


def bastion_open(plate, u0, u1, run_, k=None, P=None, zs=0.0, hole=None, fam="wall", **_):
    """B1-2: the ramp's slot open (the base design covers it with the outlined panel). (A ramp fill's arguments,
    wall3d.skirt: P(u, z, d) is a point d out from the wall.)"""
    if hole:
        _slot(k, P, run_, zs, hole, fam)


def bastion_machinery(plate, u0, u1, run_, k=None, P=None, zs=0.0, hole=None, fam="wall", ax=0, plane=0.0, **_):
    """B1-3: a box of machinery slotted into the open slot (as deep as its floor, as tall as its back), a screen on
    its upright front."""
    if not hole:
        return
    from ..wall3d_variants import lamp
    _slot(k, P, run_, zs, hole, fam)
    o0, o1, d0, d1 = hole
    ft = T.style().foot
    zat = lambda d: ft + (zs - ft) * (1 - d / run_)    # noqa: E731
    zb = zat(d1)
    df, zt = d1, zat(d0)                            # the box: the slot's floor deep, its back's height
    a, b = o0 + 0.02, o1 - 0.02
    prism(k, ax, plane, a, b, [(d0, zb), (df, zb), (df, zt), (d0, zt)], fam, 3)
    c, e = zb + 0.03, zt - 0.03                                                                  # its screen
    T.slab(k, ax, plane + df, a + 0.03, b - 0.03, c, e, PAINT, fam, 0)
    fp, dl = plane + df, 2 * PAINT
    h = (e - c - 0.04) / 3
    for i in range(2):                                                                           # a lit block
        for j in range(3):
            q = c + 0.02 + j * h
            lamp(k, ax, fp, a + 0.06 + i * 0.05, a + 0.06 + (i + 1) * 0.05 - LINE, q, q + h - 0.015, dl,
                 "flameY" if (i + j) % 2 else "red")
    for i, col in enumerate(("red", "flameY", "red", "flameY")):                                 # small lights
        u = a + 0.2 + i * 0.07
        lamp(k, ax, fp, u, u + 2 * LINE, e - 0.06, e - 0.03, dl, col)
    lamp(k, ax, fp, a + 0.2, a + 0.33, c + 0.03, c + 0.08, dl, "green")                          # buttons
    lamp(k, ax, fp, a + 0.36, a + 0.45, c + 0.03, c + 0.1, dl, "red")
    lamp(k, ax, fp, a + 0.47, a + 0.51, c + 0.03, c + 0.08, dl, "blueN")


BAST_TOPS = (Design("hood", cut=bastion_hood), Design("readout", cut=bastion_readout, deep=2 / 32),
             Design("equipment", cut=bastion_equipment, flat=True), Design("module", cut=bastion_module))
BAST_RAMPS = (Design("cover"), Design("open slot", ramp=bastion_open, ramp_hole=bastion_hole),
              Design("machinery", ramp=bastion_machinery, ramp_hole=bastion_hole))
