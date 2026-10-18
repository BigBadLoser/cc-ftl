"""WEAPON TURRET CONCEPTS (round 2): three directions for the roof turrets, burst laser + mass driver. Not wired in.

  H  HALO      ring accelerator: the barrel runs through a train of heavy coil hoops held by tie rods; breech drum behind.
  S  SPONSON   a squat armoured drum carries two barrel carriages on side trunnions (wide twin-barrel silhouette).
  R  REVOLVER  mechanism-forward: a revolving chamber cluster (driver) or a six-barrel rotary (laser) on a pintle neck.

A turret is a Rig of three meshes: 'fixed' (the armoured coaming on the roof, never moves), 'head' (yaws with the aim) and
'gun' (yaws and pitches about the trunnion PIVOT). Everything is modelled at aim d0 (+u = grid +x) with z measured from
the roof plane; `place()` yaws by d * 45 deg clockwise, pitches the gun and lifts head + gun for the deploy frames.
Glow only on the colour-identity accents, dark when idle."""
import math
from mathutils import Matrix
from . import core, cmbkit, detail as D
from .cmbkit import Frame

ZR = 2.4   # LOCAL override: the roof is being raised to 2.4 (walls.HF / roofs.ZR) in a parallel branch


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def G(hot, col):
    return col if hot else "dark"


class Rig:
    def __init__(self, name, pivot, scale=1.0):
        self.name, self.pivot, self.scale, self.meshes = name, pivot, scale, {}

    def f(self, part):
        if part not in self.meshes:
            self.meshes[part] = core.Mesh(f"{self.name}_{part}")
        return Frame(self.meshes[part], 1, square=True)


def place(rig, d=0, pitch=0.0, lift=0.0, z0=ZR, parts=("fixed", "head", "gun")):
    """Build the rig's meshes as objects: yaw d (0..7, clockwise from grid +x), gun pitch (rad, nose up), lift (z)."""
    yaw = Matrix.Rotation(-d * math.pi / 4, 4, "Z")
    S = Matrix.Scale(rig.scale, 4)
    pu, pz = rig.pivot
    mats = {"fixed": Matrix.Translation((0, 0, z0)) @ S, "head": Matrix.Translation((0, 0, z0 + lift)) @ yaw @ S}
    mats["gun"] = mats["head"] @ Matrix.Translation((pu, 0, pz)) @ Matrix.Rotation(-pitch, 4, "Y")
    out = []
    for part in parts:
        m = rig.meshes.get(part)
        if m is None:
            continue
        if part == "gun":
            m.v = [(x - pu, y, z - pz) for x, y, z in m.v]
        ob = m.build()
        ob.matrix_world = mats[part]
        out.append(ob)
    return out


# ---- shared parts ------------------------------------------------------------------------------------------------

@cmbkit.prim
def vannulus(f, ro, ri, z0, z1, mat, top=None, sides=28):
    """Flat ring around the vertical axis (outer wall, inner wall, top): open in the middle."""
    P = lambda r, z, k: f.pt(r * math.cos(k * math.tau / sides), r * math.sin(k * math.tau / sides), z)  # noqa: E731
    if cmbkit.REC is not None and cmbkit.REC.depth == 1:            # register a true ring for overlap.py
        cmbkit.REC.custom = True
        c = f.pt(0, 0, 0)
        cmbkit.REC.add({"kind": "cyl", "axis": 2, "c": (c.x, c.y), "r": (ri, ro), "a": (z0, z1), "src": "vannulus"})
    for k in range(sides):
        j = (k + 1) % sides
        f.poly([P(ro, z0, k), P(ro, z0, j), P(ro, z1, j), P(ro, z1, k)], mat, flip=True)
        f.poly([P(ri, z0, j), P(ri, z0, k), P(ri, z1, k), P(ri, z1, j)], mat, flip=True)
        f.poly([P(ri, z1, k), P(ri, z1, j), P(ro, z1, j), P(ro, z1, k)], top or mat, flip=True)


def coaming(f, R):
    """Fixed armoured ring on the roof around the turret race (it is what the turret visibly comes up through). Open
    in the middle, so the same ring frames the roof hatch when the turret is stowed."""
    _g("deck")
    vannulus(f, R + 0.16, R + 0.06, -0.02, 0.06, "steelD", "steelL")
    vannulus(f, R + 0.06, R - 0.02, -0.02, 0.065, "dark", "dark")


def turntable(f, R, hot, col, ribs=16):
    """Race ring + dark armoured skirt with vertical ribs, a lit rim and a dark stepped deck (no glow band: the accents
    live on the weapon)."""
    _g("table")
    f.vcyl(0, 0, 0.04, R, 0.16, "dark", top="steelL", sides=28)
    for k in range(ribs):
        a = k * math.tau / ribs
        c, s = math.cos(a), math.sin(a)
        f.box(c * (R - 0.02), s * (R - 0.02), 0.04, 0.09, 0.09, 0.15, "steel", top="steelL")
    f.vcyl(0, 0, 0.2, R - 0.06, 0.03, "steelD", top="steelD", sides=28)
    f.vcyl(0, 0, 0.23, R - 0.2, 0.06, "dark", top="steelD", sides=28)


def hoop(f, u, z, w, ro, ri, hot, col, mat="steelD", cap="steelL", v=0.0):
    """Coil hoop around the barrel axis: thick annulus with a glowing inner face."""
    D.annulus(f, u - w / 2, u + w / 2, v, z, ro, ri, mat, cap, sides=24)
    f.hcyl(u - w / 2 + 0.01, u + w / 2 - 0.01, v, z, ri, G(hot, col), sides=24)


def split_hoop(f, u, z, ro, ri, hot, col, v=0.0, w=0.06, gap=0.05):
    """Open coil ring: two armoured discs with a glowing coil band between them and a glowing bore face, so it reads
    as a ring from the end (glow inside) and as steel-glow-steel stripes edge-on."""
    for s_ in (-1, 1):
        uc = u + s_ * (gap + w) / 2
        D.annulus(f, uc - w / 2, uc + w / 2, v, z, ro, ri, "steelD", "steelL", sides=24)
    f.hcyl(u - gap / 2, u + gap / 2, v, z, ro - 0.03, G(hot, col), sides=24)
    f.hcyl(u - gap / 2 - w + 0.01, u + gap / 2 + w - 0.01, v, z, ri, G(hot, col), sides=24)


def cheeks(h, u0, u1, vs, r, hot, col, z0=0.29):
    """Low round housings lying on the deck either side of the mount (fill the turntable, stay round)."""
    _g("cheek")
    for sv in (-1, 1):
        h.hcyl(u0, u1, sv * vs, z0 + r, r, "steelD", sides=16, cap="steel", capstart="steel")
        um = (u0 + u1) / 2
        h.hcyl(um - 0.05, um + 0.05, sv * vs, z0 + r, r + 0.025, "steel", sides=16, cap="steelL", capstart="steelL")
        h.hcyl(u1, u1 + 0.02, sv * vs, z0 + r, r * 0.45, G(hot, col), sides=12, cap=G(hot, col))


def brake(f, u0, v, z, r, rb, hot, col, baffles=2, gap=0.07, w=0.09):
    """Round baffle muzzle brake: discs on the barrel with dark gaps, glowing bore."""
    u = u0
    for k in range(baffles):
        f.hcyl(u, u + w, v, z, r, "steelL", sides=20, cap="steel", capstart="steel")
        u += w
        if k < baffles - 1:
            f.hcyl(u, u + gap, v, z, rb, "dark", sides=16)
            u += gap
    f.hcyl(u, u + 0.02, v, z, rb * 0.62, G(hot, col), sides=16, cap=G(hot, col))
    return u


# ---- H: HALO --------------------------------------------------------------------------------------------------

def halo_driver(hot):
    col, R, BZ, PU = "orange", 0.92, 0.9, -0.3
    rig = Rig("halo_driver", (PU, BZ), 1.3)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col)
    _g("neck")
    h.vcyl(0, 0, 0.29, 0.6, 0.07, "steelD", top="steel", sides=28)                               # raised deck ring
    for k in range(8):
        a = (k + 0.5) * math.tau / 8
        h.box(0.5 * math.cos(a), 0.5 * math.sin(a), 0.36, 0.1, 0.1, 0.012, "dark")
    h.vcyl(PU, 0, 0.36, 0.3, 0.1, "steel", top="steelL", sides=20)
    cheeks(h, -0.78, 0.3, 0.64, 0.12, hot, col, z0=0.29)
    g = rig.f("gun")
    _g("breech")
    g.hcyl(-1.08, -0.28, 0, BZ, 0.41, "steelD", sides=24, capstart="steel")
    for u in (-0.92, -0.5):
        g.hcyl(u - 0.04, u + 0.04, 0, BZ, 0.44, "steel", sides=24, cap="steelL", capstart="steelL")
    D.annulus(g, -1.12, -1.08, 0, BZ, 0.3, 0.19, "steelL", G(hot, col), sides=20)
    g.hcyl(-1.2, -1.08, 0, BZ, 0.17, "steelL", sides=16, capstart="plate")
    D.seg(g, (PU, -0.52, BZ), (PU, 0.52, BZ), 0.17, "steelL", 16, cap="plate", capstart="plate")    # trunnion bosses
    g.vcyl(-0.75, 0, BZ + 0.36, 0.11, 0.16, "steel", top="lens", sides=12)                         # sight
    for sv in (-1, 1):                                                                              # capacitor pods
        g.hcyl(-1.02, -0.36, sv * 0.4, BZ - 0.08, 0.15, "steel", sides=14, cap="steelL", capstart="steelL")
        g.hcyl(-0.86, -0.8, sv * 0.4, BZ - 0.08, 0.165, G(hot, col), sides=14)
        g.hcyl(-0.6, -0.54, sv * 0.4, BZ - 0.08, 0.165, G(hot, col), sides=14)
    _g("barrel")
    g.hcyl(-0.28, -0.18, 0, BZ, 0.34, "steel", sides=24, cap="steelL")
    g.hcyl(-0.18, 1.62, 0, BZ, 0.11, "gm", sides=16)
    _g("hoops")
    for u, ro, ri in ((0.1, 0.52, 0.37), (0.5, 0.5, 0.36), (0.9, 0.48, 0.35), (1.28, 0.46, 0.34)):
        split_hoop(g, u, BZ, ro, ri, hot, col)
    _g("rods")
    for a in (90, 210, 330):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        D.seg(g, (-0.3, 0.43 * c, BZ + 0.43 * s), (1.36, 0.4 * c, BZ + 0.4 * s), 0.04, "steelL", 8)
    _g("brake")
    brake(g, 1.6, 0, BZ, 0.2, 0.14, hot, col)
    return rig


def halo_laser(hot):
    col, R, BZ, PU = "cyan", 0.64, 0.7, -0.2
    rig = Rig("halo_laser", (PU, BZ), 1.25)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col, ribs=12)
    _g("neck")
    h.vcyl(PU, 0, 0.29, 0.22, 0.1, "steel", top="steelL", sides=16)
    g = rig.f("gun")
    _g("breech")
    g.hcyl(-0.78, -0.2, 0, BZ, 0.29, "steelD", sides=20, capstart="steel")
    g.hcyl(-0.52, -0.44, 0, BZ, 0.315, "steel", sides=20, cap="steelL", capstart="steelL")
    D.annulus(g, -0.82, -0.78, 0, BZ, 0.2, 0.11, "steelL", G(hot, col), sides=16)
    D.seg(g, (PU, -0.36, BZ), (PU, 0.36, BZ), 0.12, "steelL", 12, cap="plate", capstart="plate")
    _g("barrel")
    for dz in (-0.1, 0.1):                                                                         # over-under pair
        g.hcyl(-0.2, 1.12, 0, BZ + dz, 0.065, "gm", sides=12)
        g.hcyl(1.12, 1.27, 0, BZ + dz, 0.085, "steelL", sides=12, cap=G(hot, col))
    _g("hoops")
    for u, ro, ri in ((0.12, 0.34, 0.2), (0.44, 0.32, 0.195), (0.74, 0.3, 0.19)):
        hoop(g, u, BZ, 0.11, ro, ri, hot, col)
    _g("rods")
    for a in (90, 210, 330):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        D.seg(g, (-0.22, 0.255 * c, BZ + 0.255 * s), (0.79, 0.245 * c, BZ + 0.245 * s), 0.035, "steelL", 8)
    return rig


# ---- S: SPONSON -----------------------------------------------------------------------------------------------

def _drum(h, r, z0, z1, hot, col, ribs=10):
    _g("drum")
    h.vcyl(0, 0, z0, r, z1 - z0, "steelD", sides=28)
    h.vcyl(0, 0, z1, r, 0.1, "steel", rtop=r - 0.1, sides=28)
    h.vcyl(0, 0, z1 + 0.1, r - 0.1, 0.02, "blueGrey", sides=28)
    h.vcyl(0, 0, z0 + (z1 - z0) * 0.42, r + 0.012, 0.08, G(hot, col), sides=28)
    for k in range(ribs):
        a = (k + 0.5) * math.tau / ribs
        h.box(math.cos(a) * (r - 0.01), math.sin(a) * (r - 0.01), z0, 0.08, 0.08, z1 - z0, "steel", top="steelL")


def sponson_driver(hot):
    col, R, BZ, PU = "orange", 0.86, 0.62, 0.0
    rig = Rig("sponson_driver", (PU, BZ), 1.25)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col)
    _drum(h, 0.5, 0.29, 0.86, hot, col)
    h.vcyl(0.18, 0, 0.96, 0.12, 0.12, "steel", top="lens", sides=12)                              # sensor
    h.vcyl(-0.18, 0.16, 0.96, 0.07, 0.07, "steelL", top="plate", sides=10)
    g = rig.f("gun")
    for sv in (-1, 1):
        vc = sv * 0.84
        _g("trunnion")
        D.seg(g, (0, sv * 0.4, BZ), (0, sv * 0.6, BZ), 0.2, "steel", 16, cap="steelL")
        _g("carriage")
        g.hcyl(-0.86, 0.5, vc, BZ, 0.26, "steelD", sides=20, capstart="steel")
        for u in (-0.62, -0.1, 0.32):
            g.hcyl(u - 0.045, u + 0.045, vc, BZ, 0.285, "steel", sides=20, cap="steelL", capstart="steelL")
        g.hcyl(-0.4, -0.34, vc, BZ, 0.27, G(hot, col), sides=20)
        D.annulus(g, -0.9, -0.86, vc, BZ, 0.18, 0.1, "steelL", G(hot, col), sides=16)
        g.hcyl(0.5, 0.62, vc, BZ, 0.2, "steel", sides=16, cap="steelL")
        _g("barrel")
        g.hcyl(0.62, 1.86, vc, BZ, 0.115, "gm", sides=16)
        for u in (0.82, 1.14, 1.46):                                                                # coil collars
            g.hcyl(u - 0.06, u + 0.06, vc, BZ, 0.165, "steel", sides=16, cap="steelL", capstart="steelL")
        _g("brake")
        brake(g, 1.84, vc, BZ, 0.17, 0.115, hot, col)
    return rig


def sponson_laser(hot):
    col, R, BZ, PU = "cyan", 0.62, 0.52, 0.0
    rig = Rig("sponson_laser", (PU, BZ), 1.45)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col, ribs=12)
    _drum(h, 0.36, 0.29, 0.66, hot, col, ribs=8)
    h.vcyl(0.12, 0, 0.76, 0.08, 0.08, "steel", top="lens", sides=10)
    _g("cheek")
    D.seg(h, (-0.47, -0.24, 0.39), (-0.47, 0.24, 0.39), 0.1, "steelD", 14, cap="steel", capstart="steel")   # counterweight
    D.seg(h, (-0.47, -0.06, 0.39), (-0.47, 0.06, 0.39), 0.115, "steel", 14, cap="steelL", capstart="steelL")
    h.vcyl(0.44, 0, 0.29, 0.1, 0.1, "steelD", top="steel", sides=14)                                       # designator
    h.vcyl(0.44, 0, 0.39, 0.065, 0.05, "steel", top="lens", sides=12)
    g = rig.f("gun")
    for sv in (-1, 1):
        vc = sv * 0.6
        _g("trunnion")
        D.seg(g, (0, sv * 0.34, BZ), (0, sv * 0.44, BZ), 0.13, "steel", 12, cap="steelL")
        _g("carriage")
        g.hcyl(-0.5, 0.36, vc, BZ, 0.17, "steelD", sides=16, capstart="steel")
        g.hcyl(-0.27, -0.22, vc, BZ, 0.18, G(hot, col), sides=16)
        D.annulus(g, -0.54, -0.5, vc, BZ, 0.1, 0.05, "steelL", G(hot, col), sides=12)
        _g("barrel")
        g.hcyl(0.36, 1.25, vc, BZ, 0.06, "gm", sides=12)
        for k in range(4):                                                                          # cooling sleeve
            u = 0.42 + k * 0.1
            g.hcyl(u, u + 0.055, vc, BZ, 0.1, "steelL", sides=12, cap="steel", capstart="steel")
        g.hcyl(1.25, 1.36, vc, BZ, 0.08, "steelL", sides=12, cap=G(hot, col))
    return rig


# ---- R: REVOLVER / ROTARY -------------------------------------------------------------------------------------

def revolver_driver(hot):
    col, R, BZ, PU = "orange", 0.9, 0.96, -0.3
    rig = Rig("revolver_driver", (PU, BZ), 1.3)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col)
    _g("neck")
    h.vcyl(PU, 0, 0.29, 0.36, 0.17, "steel", top="steelL", sides=20)
    h.vcyl(PU, 0, 0.46, 0.26, 0.04, "steelD", sides=20)
    g = rig.f("gun")
    _g("cylinder")
    g.hcyl(-1.08, -0.2, 0, BZ, 0.2, G(hot, col), sides=16)                                        # glowing arbor core
    for k in range(6):
        a = k * math.tau / 6 + math.pi / 6
        g.hcyl(-1.02, -0.26, 0.3 * math.cos(a), BZ + 0.3 * math.sin(a), 0.125, "steelD", sides=14, cap="steel", capstart="steel")
    for u0 in (-1.1, -0.28):
        g.hcyl(u0, u0 + 0.08, 0, BZ, 0.45, "steelL", sides=24, cap="plate", capstart="plate")
    g.hcyl(-1.42, -1.1, 0, BZ, 0.2, "steelD", sides=16, capstart="steel")                            # rammer housing
    g.hcyl(-1.3, -1.24, 0, BZ, 0.22, "steel", sides=16, cap="steelL", capstart="steelL")
    _g("barrel")
    g.hcyl(-0.2, 0.06, 0, BZ, 0.3, "steel", sides=20, cap="steelL", capstart="steelL")             # forcing collar
    g.hcyl(0.06, 1.86, 0, BZ, 0.16, "gm", sides=16)
    for u0, u1 in ((0.1, 0.42), (0.5, 0.82), (0.9, 1.22)):                                         # jacket + coil gaps
        g.hcyl(u0, u1, 0, BZ, 0.235, "steelD", sides=20, cap="steel", capstart="steel")
        g.hcyl(u1, u1 + 0.05, 0, BZ, 0.2, G(hot, col), sides=16)
    _g("brake")
    brake(g, 1.84, 0, BZ, 0.26, 0.16, hot, col, gap=0.09, w=0.1)
    return rig


def rotary_laser(hot):
    col, R, BZ, PU = "cyan", 0.64, 0.72, -0.25
    rig = Rig("rotary_laser", (PU, BZ), 1.4)
    coaming(rig.f("fixed"), R)
    h = rig.f("head")
    turntable(h, R, hot, col, ribs=12)
    _g("neck")
    h.vcyl(PU, 0, 0.29, 0.26, 0.14, "steel", top="steelL", sides=16)
    cheeks(h, -0.5, 0.26, 0.42, 0.11, hot, col)
    g = rig.f("gun")
    _g("motor")
    g.hcyl(-0.78, -0.12, 0, BZ, 0.27, "steelD", sides=20, capstart="steel")
    for u in (-0.6, -0.32):
        g.hcyl(u - 0.035, u + 0.035, 0, BZ, 0.295, "steel", sides=20, cap="steelL", capstart="steelL")
    D.annulus(g, -0.82, -0.78, 0, BZ, 0.19, 0.1, "steelL", G(hot, col), sides=16)
    D.seg(g, (PU, -0.33, BZ), (PU, 0.33, BZ), 0.11, "steelL", 12, cap="plate", capstart="plate")
    _g("cluster")
    g.hcyl(-0.12, 1.2, 0, BZ, 0.06, "steel", sides=10)
    for k in range(6):
        a = k * math.tau / 6
        v, z = 0.135 * math.cos(a), BZ + 0.135 * math.sin(a)
        g.hcyl(-0.12, 1.16, v, z, 0.048, "gm", sides=10)
        g.hcyl(1.16, 1.19, v, z, 0.035, G(hot, col), sides=8, cap=G(hot, col))
    for u0, u1 in ((0.28, 0.36), (0.78, 0.86), (1.08, 1.16)):
        g.hcyl(u0, u1, 0, BZ, 0.215, "steelL", sides=20, cap="steel", capstart="steel")
    return rig


TURRETS = {("H", "driver"): halo_driver, ("H", "laser"): halo_laser, ("S", "driver"): sponson_driver,
           ("S", "laser"): sponson_laser, ("R", "driver"): revolver_driver, ("R", "laser"): rotary_laser}
NAMES = {"H": "HALO", "S": "SPONSON", "R": "REVOLVER"}
# the user's picks (round 3): burst laser = S laser, mass driver = H driver, point defence = R rotary laser
PICKS = {"laser": sponson_laser, "driver": halo_driver, "pd": rotary_laser}
for _k, _fn in PICKS.items():
    TURRETS[("P", _k)] = _fn
