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

    def blob(self, x, y, z, radii, col, tilt=(0.0, 0.0)):
        """An ellipsoid centred at (x, y, z) with radii (rx, ry, rz), tilted about grid x then y by tilt (radians)."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*(r * self.k for r in radii), 1.0)), verts=bm.verts)
        rot = Matrix.Rotation(self.rz, 3, "Z") @ Matrix.Rotation(tilt[1], 3, "Y") @ Matrix.Rotation(tilt[0], 3, "X")
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
        bmesh.ops.translate(bm, verts=bm.verts, vec=self.p(x, y, z))
        emit(self.m, bm, lambda n, c: col)

    def disc(self, x, y, z, r, h, col, top=None, sides=14):
        self.m.cyl(self.p(x, y, z), r * self.k, h * self.k, col, sides=sides, top=top or col, rz=self.rz)


def at(base, d, r):
    """The point r along direction d from base (3-tuples)."""
    return tuple(b + v * r for b, v in zip(base, d))


# ---- the lines -------------------------------------------------------------------------------------------------------

def arm(q):
    """A cyber arm lying on the deck: upper arm, a white elbow, forearm, and a big open hand, fingers spread apart."""
    q.tube((-0.28, -0.16, 0.045), (-0.14, -0.08, 0.045), 0.045, BODY)
    q.ball(-0.14, -0.08, 0.0, 0.05, q.joint)
    q.tube((-0.14, -0.08, 0.045), (-0.02, -0.01, 0.038), 0.037, BODY, r1=0.032)
    q.ball(-0.02, -0.01, 0.006, 0.033, q.joint)                                                 # the wrist
    q.blob(0.06, 0.04, 0.035, (0.095, 0.08, 0.032), BODY_D)                                     # the palm
    for a in (-0.6, -0.2, 0.2, 0.58):                                                           # four fingers, fanned wide
        d = (math.cos(0.5 + a), math.sin(0.5 + a))
        b = (0.06 + d[0] * 0.075, 0.04 + d[1] * 0.075)
        k = (b[0] + d[0] * 0.07, b[1] + d[1] * 0.07)
        q.tube((b[0], b[1], 0.04), (k[0], k[1], 0.04), 0.022, q.joint)
        q.tube((k[0], k[1], 0.04), (k[0] + d[0] * 0.06, k[1] + d[1] * 0.06, 0.03), 0.018, BODY)
    q.tube((0.02, 0.1, 0.035), (-0.02, 0.18, 0.035), 0.022, q.joint)                             # thumb
    q.tube((-0.02, 0.18, 0.035), (-0.06, 0.22, 0.03), 0.018, BODY)
    q.box(-0.22, -0.12, 0.085, (0.06, 0.03, 0.012), q.lit, rz=0.52, bevel=0)


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
    """A cyber heart, anatomical: a tapered red body with its point down toward the viewer, a darker atrium behind,
    a white aortic arch curving over the top, and a lit band round it."""
    q.blob(0.02, 0.02, 0.15, (0.11, 0.12, 0.12), HEART, tilt=(0.45, -0.45))                     # the ventricles
    q.blob(0.08, 0.08, 0.07, (0.05, 0.05, 0.08), HEART, tilt=(0.75, -0.75))                     # the apex, forward and down
    q.blob(-0.07, -0.02, 0.2, (0.06, 0.07, 0.06), HEART_D)                                      # the atrium, behind
    q.blob(0.02, 0.02, 0.13, (0.108, 0.128, 0.025), q.lit, tilt=(0.45, -0.45))                  # the band
    arch = [(-0.01, -0.03, 0.22), (-0.02, -0.04, 0.33), (0.02, -0.1, 0.38), (0.07, -0.15, 0.34), (0.08, -0.16, 0.26)]
    for a, b in zip(arch, arch[1:]):
        q.tube(a, b, 0.03, q.joint)
    for a, b in ((( -0.04, 0.05, 0.22), (-0.07, 0.08, 0.33)), ((-0.04, -0.09, 0.3), (-0.06, -0.12, 0.37))):
        q.tube(a, b, 0.018, q.joint)


def lungs(q):
    """Cyber lungs standing up: two tall pink lobes, a white windpipe rising between them and forking into each,
    a lit band across each lobe."""
    for y, col in ((-0.075, LUNG_D), (0.075, LUNG)):
        q.blob(0.0, y * 1.25, 0.16, (0.08, 0.075, 0.16), col, tilt=(0.18 if y > 0 else -0.18, 0.0))
        q.blob(0.0, y * 1.25, 0.13, (0.084, 0.079, 0.018), q.lit)
    q.tube((0.0, 0.0, 0.22), (0.0, 0.0, 0.4), 0.024, q.joint)
    for y in (-0.05, 0.05):
        q.tube((0.0, 0.0, 0.23), (0.0, y * 1.3, 0.19), 0.017, q.joint)
    for z in (0.29, 0.33, 0.37):
        q.tube((0.0, 0.0, z - 0.006), (0.0, 0.0, z + 0.006), 0.026, BODY_D)


def spine(q):
    """A spinal frame: six white vertebrae with gaps between, each with side wings and a spike up, lit discs between."""
    for i in range(6):
        x = (i - 2.5) * 0.085
        q.tube((x - 0.025, 0, 0.045), (x + 0.025, 0, 0.045), 0.04, q.joint, cap=EYE)               # the body
        q.box(x, 0, 0.05, (0.02, 0.17, 0.018), q.joint, bevel=0.004)                             # side wings
        q.tube((x, 0, 0.07), (x - 0.02, 0, 0.13), 0.013, q.joint)                                   # the spike
        if i < 5:
            q.tube((x + 0.03, 0, 0.045), (x + 0.055, 0, 0.045), 0.032, q.lit)


def booster(q):
    """A reflex booster: a gunmetal canister wound with lit coils, a white clamp at one end."""
    q.tube((-0.2, 0, 0.065), (0.16, 0, 0.065), 0.065, BODY, cap=BODY_D)
    for x in (-0.12, -0.04, 0.04):
        q.tube((x - 0.012, 0, 0.065), (x + 0.012, 0, 0.065), 0.072, q.lit)
    q.box(0.21, 0, 0.0, (0.07, 0.16, 0.11), q.joint, top=EYE, bevel=0.01)


def dermal(q):
    """Dermal armour: a skin-toned sheet half rolled up, its open part covered in gunmetal scales with lit seams."""
    q.box(0.04, 0, 0, (0.34, 0.28, 0.01), "skin", bevel=0)
    q.tube((-0.15, -0.14, 0.05), (-0.15, 0.14, 0.05), 0.05, "skin", cap="skinD")                # the rolled end
    q.tube((-0.15, -0.141, 0.05), (-0.15, 0.141, 0.05), 0.022, BODY_D)
    for i in range(5):
        for j in range(4):
            x, y = -0.07 + i * 0.058 + (0.029 if j % 2 else 0.0), (j - 1.5) * 0.062
            if x < 0.2:
                q.disc(x, y, 0.01, 0.026, 0.016, BODY_D, top=BODY, sides=6)
    q.box(0.04, 0, 0.01, (0.32, 0.006, 0.004), q.lit, bevel=0)


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
