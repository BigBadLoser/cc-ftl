"""Implant items (#626, family `items`): each implant on its own, big and in colour (user's pick, 2026-11-23: no tray or
case). The tier is the colour of its lights: Mk I plain steel, Mk II cyan, Mk III violet; named cyberware gold. Neural
chips add a stripe in their skill's colour. Colours are the "implant" palette set (palette_extra.json).

Models in the grid frame (x, y on the deck, z up; +x+y toward the viewer), about 0.5 long, then scaled per stack size."""
import math

import bmesh
from mathutils import Matrix

from .items_kit import emit, jobs, tube

LIGHTS = {1: "imSteel", 2: "imCyan", 3: "imViolet", "named": "imGold"}
SKILLS = {"gunnery": "imRed", "piloting": "imBlue", "engineering": "imOrange", "medical": "imGreen", "science": "imWhite"}
BODY, BODY_D, JOINT, DARK = "gm", "steelD", "c3W2", "xnK"
HEART, HEART_D, LUNG, LUNG_D, EYE = "medRed", "red", "imLung", "imLungD", "medWhite"
TO_CAM = (0.62, 0.62, 0.48)


class P:
    """Parts at c (grid x, y), floor z, turned rz and scaled k; lit = the tier's light colour, joint = the trim's (gold on named)."""

    def __init__(self, m, c, z, rz, k, lit, joint=JOINT):
        self.m, self.c, self.z, self.rz, self.k, self.lit, self.joint = m, c, z, rz, k, lit, joint

    def p(self, x, y, z):
        cs, sn = math.cos(self.rz), math.sin(self.rz)
        return (self.c[0] + (x * cs - y * sn) * self.k, self.c[1] + (x * sn + y * cs) * self.k, self.z + z * self.k)

    def box(self, x, y, z, s, col, top=None, rz=0.0, bevel=0.006):
        self.m.box(self.p(x, y, z), tuple(v * self.k for v in s), col, top=top, rz=self.rz + rz, base=True, bevel=bevel * self.k)

    def tube(self, a, b, r, col, cap=None, r1=None, sides=12):
        tube(self.m, self.p(*a), self.p(*b), r * self.k, col, cap=cap or col, r1=None if r1 is None else r1 * self.k, sides=sides)

    def ball(self, x, y, z, r, col, sx=1.0, sz=1.0):
        """A ball (stretched sx along x, sz up) resting at height z."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r * self.k)
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((sx, 1.0, sz, 1.0)), verts=bm.verts)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(self.rz, 3, "Z"))
        bmesh.ops.translate(bm, verts=bm.verts, vec=self.p(x, y, z + r * sz))
        emit(self.m, bm, lambda n, c: col)

    def disc(self, x, y, z, r, h, col, top=None, sides=14):
        self.m.cyl(self.p(x, y, z), r * self.k, h * self.k, col, sides=sides, top=top or col, rz=self.rz)


def at(base, d, r):
    """The point r along direction d from base (3-tuples)."""
    return tuple(b + v * r for b, v in zip(base, d))


# ---- the lines -------------------------------------------------------------------------------------------------------

def arm(q):
    """A cyber arm lying on the deck: upper arm, a white elbow, forearm, an open hand."""
    q.tube((-0.26, -0.1, 0.05), (-0.04, 0.0, 0.05), 0.05, BODY)
    q.ball(-0.04, 0.0, 0.0, 0.055, q.joint)
    q.tube((-0.04, 0.0, 0.05), (0.14, 0.1, 0.04), 0.04, BODY, r1=0.034)
    q.ball(0.14, 0.1, 0.004, 0.038, q.joint)
    q.box(0.2, 0.14, 0.0, (0.1, 0.09, 0.05), BODY_D, top=BODY, rz=0.5)
    for i, a in enumerate((-0.5, -0.15, 0.15, 0.45)):
        y0 = 0.14 + i * 0.02
        q.tube((0.24, y0, 0.03), (0.24 + 0.1 * math.cos(0.27 + a), y0 + 0.1 * math.sin(0.27 + a) + 0.06 * a, 0.03), 0.014, q.joint)
    q.tube((0.17, 0.2, 0.03), (0.15, 0.28, 0.03), 0.015, q.joint)                                  # thumb
    q.box(-0.15, -0.05, 0.095, (0.06, 0.03, 0.012), q.lit, rz=0.42, bevel=0)


def leg(q):
    """A cyber leg lying on the deck: thigh, a white knee, shin, a flat foot."""
    q.tube((-0.27, -0.06, 0.055), (-0.06, 0.0, 0.055), 0.055, BODY)
    q.ball(-0.06, 0.0, 0.0, 0.058, q.joint)
    q.tube((-0.06, 0.0, 0.05), (0.15, 0.06, 0.04), 0.042, BODY, r1=0.034)
    q.ball(0.15, 0.06, 0.004, 0.036, q.joint)
    q.box(0.2, 0.075, 0.0, (0.07, 0.11, 0.15), BODY_D, top=BODY, rz=0.28, bevel=0.012)         # the foot, standing up
    q.box(-0.17, -0.03, 0.105, (0.07, 0.03, 0.012), q.lit, rz=0.28, bevel=0)


def eye(q):
    """A cyber eye: a white ball looking at the viewer, a lit iris, a cable behind."""
    q.ball(0.0, 0.0, 0.0, 0.14, EYE)
    c = (0.0, 0.0, 0.14)
    q.tube(at(c, TO_CAM, 0.1), at(c, TO_CAM, 0.135), 0.075, q.lit)
    q.tube(at(c, TO_CAM, 0.13), at(c, TO_CAM, 0.15), 0.032, "black")
    q.tube((-0.1, -0.1, 0.08), (-0.26, -0.18, 0.02), 0.024, BODY)


def heart(q):
    """A cyber heart: two red chambers, a lit band round them, three vessels out of the top."""
    q.ball(-0.04, 0.03, 0.0, 0.12, HEART, sz=0.8)
    q.ball(0.07, -0.03, 0.0, 0.1, HEART_D, sz=0.8)
    q.tube((0.0, 0.0, 0.085), (0.0, 0.0, 0.115), 0.135, q.lit, sides=16)
    for x, y, h in ((-0.06, 0.08, 0.3), (0.0, 0.04, 0.32), (0.05, 0.0, 0.27)):
        q.tube((x, y, 0.14), (x, y, h), 0.026, q.joint)


def lungs(q):
    """Cyber lungs: two pink lobes side by side, a steel windpipe forking between them, a lit band on each."""
    for y, col in ((-0.08, LUNG_D), (0.08, LUNG)):
        q.ball(0.02, y, 0.0, 0.085, col, sx=1.6, sz=0.9)
        q.tube((-0.03, y - 0.09, 0.1), (-0.03, y + 0.09, 0.1), 0.012, q.lit)
    q.tube((-0.27, 0.0, 0.08), (-0.12, 0.0, 0.08), 0.026, q.joint)
    for y in (-0.06, 0.06):
        q.tube((-0.12, 0.0, 0.08), (-0.06, y, 0.08), 0.02, q.joint)


def spine(q):
    """A spinal frame: a chain of white vertebrae with spines up and lit discs between."""
    for i in range(7):
        x = (i - 3) * 0.075
        q.box(x, 0, 0, (0.05, 0.1, 0.06), q.joint, top=EYE, bevel=0.01)
        q.box(x, 0, 0.06, (0.022, 0.03, 0.05), q.joint, bevel=0.006)
        if i < 6:
            q.box(x + 0.0375, 0, 0.012, (0.016, 0.07, 0.036), q.lit, bevel=0)


def booster(q):
    """A reflex booster: a gunmetal canister wound with lit coils, a white clamp at one end."""
    q.tube((-0.2, 0, 0.065), (0.16, 0, 0.065), 0.065, BODY, cap=BODY_D)
    for x in (-0.12, -0.04, 0.04):
        q.tube((x - 0.012, 0, 0.065), (x + 0.012, 0, 0.065), 0.072, q.lit)
    q.box(0.21, 0, 0.0, (0.07, 0.16, 0.11), q.joint, top=EYE, bevel=0.01)


def dermal(q):
    """Dermal armour: a bowed patch of gunmetal hexagonal scales with lit seams between."""
    q.box(0, 0, 0, (0.42, 0.3, 0.012), q.lit, bevel=0)
    for i in range(6):
        for j in range(4):
            x, y = (i - 2.5) * 0.068 + (0.034 if j % 2 else 0.0), (j - 1.5) * 0.068
            if abs(x) < 0.2:
                q.disc(x, y, 0.012 + 0.04 * (1 - (y / 0.15) ** 2), 0.034, 0.02, BODY_D, top=BODY, sides=6)


def chip(skill):
    """A neural chip: a green board with gold pins, a black die with its skill's lit stripe, the tier's light in a corner."""
    def build(q):
        q.box(0, 0, 0, (0.34, 0.24, 0.025), "pcb")
        for y in (-0.08, -0.04, 0.0, 0.04, 0.08):
            q.box(-0.17, y, 0.0, (0.04, 0.02, 0.018), "brass", bevel=0)
        q.box(0.03, 0, 0.025, (0.18, 0.16, 0.04), "black", top=DARK)
        q.box(0.03, 0, 0.065, (0.18, 0.04, 0.006), SKILLS[skill], bevel=0)
        q.box(0.15, 0.09, 0.025, (0.03, 0.03, 0.012), q.lit, bevel=0)
    return build


def coprocessor(q):
    """The neural co-processor (named): a larger board under a finned heatsink."""
    q.box(0, 0, 0, (0.4, 0.28, 0.03), "pcb")
    q.box(0, 0, 0.03, (0.3, 0.22, 0.03), BODY_D)
    for i in range(7):
        q.box(-0.12 + i * 0.04, 0, 0.06, (0.014, 0.2, 0.07), q.joint)
    q.box(0.18, 0, 0.03, (0.03, 0.16, 0.02), q.lit, bevel=0)


LINES = {"cyber_arm": arm, "cyber_leg": leg, "cyber_eye": eye, "cyber_heart": heart, "cyber_lungs": lungs,
         "spinal_frame": spine, "reflex_booster": booster, "dermal_armor": dermal}
# Named cyberware (#626): its line's model, lit and trimmed in gold.
NAMED = {"chip_coprocessor": coprocessor, "halcyon_heart": heart, "hawkeye_lens": eye, "titan_arm": arm, "strider_leg": leg,
         "abyss_lungs": lungs, "atlas_frame": spine, "quicksilver": booster, "carapace_weave": dermal}

# Stacks of 4 (itemView.stackClass): s one, m two side by side, l three; the carried one a little smaller.
LAYOUT = {"held": [(0.0, 0.0)], "s": [(0.0, 0.0)], "m": [(-0.1, 0.14), (0.1, -0.14)],
          "l": [(-0.16, 0.24), (0.0, 0.0), (0.16, -0.24)]}
SCALE = {"held": 0.7, "s": 1.0, "m": 0.78, "l": 0.66}


def stack(build, tier):
    def fn(m, size):
        for x, y in LAYOUT[size]:
            build(P(m, (x, y), 0.0, 0.0, SCALE[size], LIGHTS[tier], "imGoldD" if tier == "named" else JOINT))
    return fn


def table():
    """item id (no "item.") -> stack builder: every line and Mk, the chips per skill and Mk, and the named pieces."""
    out = {f"{line}_{n}": stack(fn, n) for line, fn in LINES.items() for n in (1, 2, 3)}
    out.update({f"chip_{s}_{n}": stack(chip(s), n) for s in SKILLS for n in (1, 2, 3)})
    out.update({k: stack(fn, "named") for k, fn in NAMED.items()})
    return out


def sprite_jobs():
    return [j for k, fn in table().items() for j in jobs(k, fn)]


def palette(sid):
    """Palette selection for the items family: implant sprites add the "implant" set, the rest keep theirs."""
    return "implant" if any(sid.startswith(f"item.{k}.") for k in table()) else None
