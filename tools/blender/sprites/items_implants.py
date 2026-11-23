"""Implant items (#626, family `items`): each implant line on a small surgical tray, one model per line, the tier shown
by the tray's trim and the implant's lights: Mk I plain steel, Mk II cyan, Mk III violet. Named cyberware has a gold
trim. Neural chips add a stripe in their skill's colour. Colours are the "implant" palette set (palette_extra.json).

Models in the tray's frame: u along it, v across, z up from its top; k the unit scale (items_kit.place)."""
import bmesh
from mathutils import Matrix

from .items_kit import emit, jobs, place, rot, tube

TIERS = {1: ("imSteel", "imSteelD"), 2: ("imCyan", "imCyanD"), 3: ("imViolet", "imVioletD"), "named": ("imGold", "imGoldD")}
SKILLS = {"gunnery": "imRed", "piloting": "imBlue", "engineering": "imOrange", "medical": "imGreen", "science": "imWhite"}
CHROME, CHROME_D, DARK = "c3W2", "c3W0", "xnK"
TRAY = (0.25, 0.15, 0.02)
GROW = 1.3                      # the whole item drawn this much bigger than the shared item unit: implants are small


class Tray:
    """One tray at c (turned rz, floor z, scale k): local points, and the parts built on its top."""

    def __init__(self, m, c, z, rz, k, tier):
        self.m, self.c, self.z, self.rz, self.k = m, c, z, rz, k
        self.lit, self.trim = TIERS[tier]
        w, d, h = (s * k for s in TRAY)
        m.box((c[0], c[1], z), (w, d, h), DARK, top="black", rz=rz, base=True, bevel=0.006 * k)
        for v in (-d / 2, d / 2):                                                       # the tier trim, both long edges
            m.box((*rot(c, rz, 0, v * 0.96), z + h * 0.55), (w * 0.92, 0.01 * k, 0.014 * k), self.trim, rz=rz, base=True)
        self.top = z + h

    def p(self, u, v, zz=0.0):
        return (*rot(self.c, self.rz, u * self.k, v * self.k), self.top + zz * self.k)

    def box(self, u, v, zz, s, col, top=None, rz=0.0, bevel=0.004):
        self.m.box(self.p(u, v, zz), tuple(x * self.k for x in s), col, top=top, rz=self.rz + rz, base=True, bevel=bevel * self.k)

    def tube(self, a, b, r, col, cap=None, r1=None, sides=10):
        tube(self.m, self.p(*a), self.p(*b), r * self.k, col, cap=cap, sides=sides, r1=None if r1 is None else r1 * self.k)

    def ball(self, u, v, zz, r, col, sz=1.0, sx=1.0):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=r * self.k)
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((sx, 1.0, sz, 1.0)), verts=bm.verts)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(self.rz, 3, "Z"))
        bmesh.ops.translate(bm, verts=bm.verts, vec=self.p(u, v, zz + r * sz))
        emit(self.m, bm, lambda n, c: col)


# ---- the lines -------------------------------------------------------------------------------------------------------

def arm(t):
    """A cyber arm lying along the tray: upper arm, a lit elbow, forearm, a three-fingered hand."""
    t.tube((-0.105, 0, 0.026), (-0.01, 0, 0.026), 0.024, CHROME, cap=CHROME_D)
    t.ball(-0.01, 0, 0.004, 0.024, CHROME_D)
    t.tube((-0.01, 0, 0.026), (0.06, 0.04, 0.022), 0.02, CHROME, cap=CHROME_D, r1=0.017)
    t.box(-0.01, 0, 0.046, (0.016, 0.034, 0.006), t.lit)
    t.box(0.08, 0.05, 0.006, (0.04, 0.045, 0.026), CHROME_D, top=CHROME, rz=0.5)
    for i in (-1, 0, 1):
        t.box(0.105 + i * 0.007, 0.065 + i * 0.014, 0.008, (0.03, 0.009, 0.012), CHROME, rz=0.5)
    t.box(0.07, 0.077, 0.01, (0.02, 0.009, 0.012), CHROME, rz=1.5)


def leg(t):
    """A cyber leg: thigh, a lit knee, shin, and a flat foot turned up at the end."""
    t.tube((-0.11, 0, 0.026), (-0.02, 0, 0.026), 0.027, CHROME, cap=CHROME_D)
    t.ball(-0.02, 0, 0.0, 0.026, CHROME_D)
    t.tube((-0.02, 0, 0.026), (0.07, 0, 0.02), 0.019, CHROME, cap=CHROME_D, r1=0.016)
    t.box(-0.02, 0, 0.048, (0.014, 0.032, 0.006), t.lit)
    t.box(0.085, 0.02, 0.0, (0.03, 0.065, 0.026), CHROME_D, top=CHROME)


def eye(t):
    """A cyber eye on a stand: a white ball, a big lit lens toward the viewer, the optic cable behind."""
    t.box(0, 0, 0, (0.07, 0.07, 0.012), CHROME_D)
    t.ball(0, 0, 0.01, 0.046, CHROME)
    t.tube((0.0, -0.046, 0.052), (0.0, -0.06, 0.052), 0.032, t.trim, cap=t.lit)
    t.tube((-0.03, 0.03, 0.04), (-0.09, 0.05, 0.016), 0.01, DARK)


def heart(t):
    """A cyber heart: two chrome chambers, a lit band, three vessels out of the top."""
    t.ball(-0.02, 0.0, 0.0, 0.042, CHROME, sz=1.1)
    t.ball(0.03, 0.01, 0.0, 0.034, CHROME_D, sz=1.0)
    t.tube((-0.06, 0, 0.042), (0.07, 0, 0.042), 0.008, t.lit, sides=8)
    for u, h in ((-0.03, 0.12), (0.0, 0.13), (0.025, 0.11)):
        t.tube((u, 0.0, 0.07), (u, 0.0, h), 0.011, CHROME_D, cap=CHROME)


def lungs(t):
    """Cyber lungs: two long lobes side by side, a windpipe forking between them, lit seams."""
    for v in (-0.033, 0.033):
        t.ball(0.0, v, 0.0, 0.032, CHROME, sx=1.9)
        t.box(0.0, v, 0.062, (0.09, 0.006, 0.004), t.lit, bevel=0)
    t.tube((-0.1, 0, 0.03), (-0.05, 0, 0.03), 0.011, CHROME_D, cap=CHROME)


def spine(t):
    """A spinal frame: a column of chrome vertebrae with lit discs between."""
    for i in range(6):
        u = (i - 2.5) * 0.036
        t.box(u, 0, 0, (0.026, 0.055, 0.03), CHROME, top=CHROME, bevel=0.004)
        t.box(u, 0, 0.03, (0.012, 0.016, 0.016), CHROME_D)
        if i < 5:
            t.box(u + 0.018, 0, 0.006, (0.008, 0.04, 0.02), t.lit)


def booster(t):
    """A reflex booster: a canister wound with lit coils, a spine clip at one end."""
    t.tube((-0.07, 0, 0.03), (0.06, 0, 0.03), 0.03, CHROME_D, cap=CHROME)
    for u in (-0.035, 0.025):
        t.tube((u - 0.004, 0, 0.03), (u + 0.004, 0, 0.03), 0.034, t.lit)
    t.box(0.085, 0, 0.0, (0.03, 0.05, 0.05), CHROME, top=CHROME_D)


def dermal(t):
    """Dermal armour: a sheet of hexagonal scales with lit seams."""
    t.box(0, 0, 0, (0.2, 0.12, 0.006), DARK, bevel=0)
    t.box(0, 0, 0.006, (0.19, 0.004, 0.003), t.lit, bevel=0)
    for i in range(5):
        for j in range(3):
            u, v = (i - 2) * 0.04 + (0.02 if j % 2 else 0.0), (j - 1) * 0.036
            if abs(u) < 0.1:
                t.m.cyl(t.p(u, v, 0.006), 0.017 * t.k, 0.01 * t.k, CHROME_D, sides=6, top=t.trim, rz=t.rz)


def chip(skill):
    """A neural chip: a small board with gold pins, a black die and its skill's lit stripe."""
    def build(t):
        t.box(0, 0, 0, (0.13, 0.09, 0.012), "pcb")
        t.box(-0.055, 0, 0.012, (0.012, 0.08, 0.004), "brass", bevel=0)
        t.box(0.01, 0, 0.012, (0.07, 0.06, 0.016), "black", top=DARK)
        t.box(0.01, 0, 0.028, (0.07, 0.014, 0.003), SKILLS[skill], bevel=0)
    return build


def coprocessor(t):
    """The neural co-processor (named): a larger board under a finned heatsink, lit in gold."""
    t.box(0, 0, 0, (0.17, 0.11, 0.014), "pcb")
    t.box(0, 0, 0.014, (0.12, 0.09, 0.012), CHROME_D)
    for i in range(6):
        t.box(-0.05 + i * 0.02, 0, 0.026, (0.006, 0.08, 0.03), CHROME)
    t.box(0.075, 0, 0.014, (0.012, 0.06, 0.008), t.lit, bevel=0)


LINES = {"cyber_arm": arm, "cyber_leg": leg, "cyber_eye": eye, "cyber_heart": heart, "cyber_lungs": lungs,
         "spinal_frame": spine, "reflex_booster": booster, "dermal_armor": dermal}


def unit(build, tier):
    return lambda m, c, z, rz, k: build(Tray(m, c, z, rz, k * GROW, tier))


# Stacks of 4 (itemView.stackClass): s one tray, m two side by side, l three.
LAYOUT = {"held": [(0.0, 0.0, 0.0, 0.3)], "s": [(0.0, 0.0, 0.0, 0.3)],
          "m": [(-0.07, 0.11, 0.0, 0.3), (0.07, -0.11, 0.0, 0.3)],
          "l": [(-0.12, 0.2, 0.0, 0.3), (0.0, 0.0, 0.0, 0.3), (0.12, -0.2, 0.0, 0.3)]}


def stack(build, tier):
    return lambda m, size: place(m, size, unit(build, tier), LAYOUT)


def table(tiers=(1, 2, 3)):
    """item id (no "item.") -> stack builder, for every line and tier, the chips per skill, and the named pieces."""
    out = {f"{line}_{n}": stack(fn, n) for line, fn in LINES.items() for n in tiers}
    out.update({f"chip_{s}_{n}": stack(chip(s), n) for s in SKILLS for n in tiers})
    out["chip_coprocessor"] = stack(coprocessor, "named")
    return out


def sprite_jobs(only=None):
    return [j for k, fn in table().items() if not only or k in only for j in jobs(k, fn)]


def palette(sid):
    """Palette selection for the items family: implant sprites add the "implant" set, the rest keep theirs."""
    return "implant" if any(sid.startswith(f"item.{k}.") for k in table()) else None

