"""Restyle engine: re-skin finished sprite geometry without touching its builder.

`with restyled(look, key):` swaps `core.Mesh` for a subclass whose `poly()` repaints every polygon as it is made:
the polygon's palette name, its surface kind (top / y face / x face / slope) and its surface position go to `look.paint`,
which returns the new palette name. Geometry, masks, heights and cutaway rules are untouched, only surfaces change, so
any builder works: the wall, hull and floor tiles here, and later module sprites (whose box faces are coarser, so a look
paints them per face).

Colour roles: every default tile colour belongs to a ramp role (wallart.RAMP: H / L / S / T / M / D / K per family and
face, the ghost belly's rail / edge / body / seam). A look maps a role to its own 7-step ramp (t0 lightest .. t6 darkest),
so the light, seams and bevels of the default art carry over to any palette. Ramps are generated (`ramp()`) and synced
into palette_extra.json (`sync_palette()`).

Surface position (tile-local grid coords, origin = tile centre at floor level): a face toward +y has s = x + 0.5
(screen left to right) and height z; a face toward +x has s = 0.5 - y; tops use (x, y)."""
import colorsys
import contextlib
import json
import math
from pathlib import Path

from . import core
from . import wallart as A

PALETTE = Path(__file__).resolve().parents[1] / "palette_extra.json"

# default colour -> (family, role); families: wall, hull (wallart's blue), trim (ochre), belly (the ghost belly)
ROLE = {}
for (_fam, _face), _d in A.RAMP.items():
    for _role, _name in _d.items():
        ROLE.setdefault(_name, ({"blue": "hull", "ochre": "trim"}.get(_fam, _fam), _face, _role))
ROLE_X = {}                    # a name's role on a shade (x) face: some names serve both ramps in different roles
for (_fam, _face), _d in A.RAMP.items():     # (blue x: L is bM, T is bD), so the y-first ROLE alone collapsed them
    if _face == "x":
        for _role, _name in _d.items():
            ROLE_X.setdefault(_name, ({"blue": "hull", "ochre": "trim"}.get(_fam, _fam), "x", _role))
for _name, _role in (("gB3", "rail"), ("gB2", "edge"), ("gB1", "body"), ("gO", "trim")):
    ROLE[_name] = ("belly", "y", _role)
for _name, _role in (("gBX3", "rail"), ("gBX2", "edge"), ("gBX1", "body"), ("gOX", "trim")):
    ROLE[_name] = ("belly", "x", _role)

# role -> ramp step (0 lightest .. 6 darkest), per face: the x (shade) face sits two steps darker, its light lines (H, L:
# highlights, lit joints) one, so they stay light lines
STEP = {"y": {"H": 0, "L": 1, "S": 2, "T": 2, "M": 3, "D": 4, "K": 6, "rail": 3, "edge": 4, "body": 5, "trim": 2}}
STEP["x"] = {k: min(6, v + (1 if k in ("H", "L") else 2)) for k, v in STEP["y"].items()}
LIGHT = (0.27, 0.17, 0.08, 0.0, -0.09, -0.17, -0.26)          # lightness offsets of the 7 steps from the base colour


def ramp(prefix, base_hex, sat=1.0, offsets=LIGHT):
    """{name: hex} of a 7-step ramp `<prefix>0..6` around a base colour (HLS lightness steps, a touch of saturation)."""
    r, g, b = (int(base_hex[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = {}
    for k, o in enumerate(offsets):
        rr, gg, bb = colorsys.hls_to_rgb(h, max(0.02, min(0.95, l + o)), min(1.0, s * sat * (1 - 0.15 * (o > 0.2))))
        out[f"{prefix}{k}"] = "#%02x%02x%02x" % (round(rr * 255), round(gg * 255), round(bb * 255))
    return out


def sync_palette(entries):
    """Add or update ramp colours in palette_extra.json ({name: hex} or {name: {"hex", "emissive"}})."""
    p = json.loads(PALETTE.read_text())
    for k, v in entries.items():
        p[k] = v if isinstance(v, dict) else {"hex": v}
    PALETTE.write_text(json.dumps(p, indent=1) + "\n")


class Poly:
    """What a look sees of one polygon."""
    __slots__ = ("name", "fam", "face", "role", "kind", "s", "z", "x", "y", "sprite")

    def __init__(self, name, pts, sprite):
        self.name, self.sprite = name, sprite
        g = [(p[0], -p[1], p[2]) for p in pts]                               # Blender -> grid
        n = len(g)
        self.x, self.y, self.z = (sum(p[i] for p in g) / n for i in range(3))
        ux, uy, uz = (g[1][i] - g[0][i] for i in range(3))
        vx, vy, vz = (g[-1][i] - g[0][i] for i in range(3))
        nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        ax, ay, az = abs(nx), abs(ny), abs(nz)
        m = max(ax, ay, az) or 1.0
        if az >= 0.95 * m and ax < 0.2 * m and ay < 0.2 * m:
            self.kind = "top"
        elif az > 0.25 * m:                             # (a 45-degree face is lit: its triangles' normals
            self.kind = "slope_y" if ay >= ax - 1e-3 * m else "slope_x"     # differ in rounding, which dotted it)
        else:
            self.kind = "y" if ay >= ax - 1e-3 * m else "x"
        self.s = self.x + 0.5 if self.kind in ("y", "slope_y", "top") else 0.5 - self.y
        self.fam, self.face, self.role = ROLE.get(name, (None, "y", None))
        if self.kind in ("x", "slope_x"):
            self.fam, self.face, self.role = ROLE_X.get(name, (self.fam, "x", self.role))


class Look:
    """A faction look: ramps per family (`<prefix>0..6`), optional pattern overlays (override `overlay`)."""
    name = "default"
    ramps = {}                     # family -> ramp prefix (wall, hull, trim; belly defaults to the hull ramp)

    def tone(self, fam, face, role):
        pre = self.ramps.get(fam) or (self.ramps.get("hull") if fam == "belly" else None)
        if pre is None or role is None:
            return None
        return f"{pre}{STEP[face][role]}"

    def overlay(self, P):
        return None

    def paint(self, P):
        return self.overlay(P) or self.tone(P.fam, P.face, P.role) or P.name


_LOOK = []


class _Mesh(core.Mesh):
    def poly(self, pts, color, flip=False):
        look, key = _LOOK[-1]
        if not color.startswith("team.") and color not in ("void", "gW1", "gW2"):      # ghost lines stay as they are
            color = look.paint(Poly(color, pts, key))
        super().poly(pts, color, flip)


@contextlib.contextmanager
def restyled(look, key=""):
    """Build sprites inside this block with `look` (key: the sprite id, for per-sprite choices such as variants)."""
    old = core.Mesh
    _LOOK.append((look, key))
    core.Mesh = _Mesh
    try:
        yield
    finally:
        core.Mesh = old
        _LOOK.pop()


def hashf(*parts):
    """Deterministic 0..1 from strings / numbers (no random module, renders stay reproducible)."""
    h = 2166136261
    for c in "|".join(str(p) for p in parts):
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return (h % 100003) / 100003.0


def in_band(v, a, b):
    return a <= v < b


def hexgrid(s, z, R):
    """Distance to the nearest edge of a pointy-top hex grid of circumradius R (0 on an edge, R*cos30 at a centre)."""
    q, r = (math.sqrt(3) / 3 * s - z / 3) / R, (2 / 3 * z) / R
    x, zz, y = q, r, -q - r                                           # cube coords, rounded to the nearest centre
    rx, rz, ry = round(x), round(zz), round(y)
    dx, dz, dy = abs(rx - x), abs(rz - zz), abs(ry - y)
    if dx > dz and dx > dy:
        rx = -rz - ry
    elif dz > dy:
        rz = -rx - ry
    cx, cz = R * math.sqrt(3) * (rx + rz / 2), R * 1.5 * rz
    ox, oz = s - cx, z - cz
    m = max(abs(ox), abs(ox * 0.5 + oz * math.sqrt(3) / 2), abs(-ox * 0.5 + oz * math.sqrt(3) / 2))
    return R * math.sqrt(3) / 2 - m
