"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

The roof expresses the structure underneath. Every room is ONE flat blue-grey panel. A continuous dark steel-blue rib
runs along every interior wall line (a half rib on each side of the shared tile edge, so a rib is one girder when both
tiles are drawn); a door leaves a gap in the rib. The hull edge gets a heavier ochre-topped rim (ochre is used ONLY
there and on door hatches). Tile = f(roof mask, rib mask): `roof.frame.m<0-15>.r<0-15>` (bits N1 E2 S4 W8; roof mask
bit set = roof continues, rib bit set = interior wall on that side; the renderer derives both from the wall grid under
the roof). Details are separate overlay sprites: `roof.light.<n|e|s|w>` (every 3rd rim tile), `roof.hatch.<s|e>` (door,
centred on the shared edge), `roof.vent` (reactor / life-support rooms). No height steps, no random choices.
`roof.weapon / .shield / .engine` keep their hints on a plain panel."""
import math
from . import core

ZR = 2.4          # plating height: the top of a full-height wall (= walls.HF)
T = 0.14          # slab thickness shown on open sides
GN = 32
RIB_W, RIB_H = 0.07, 0.07      # half-width on each side of a wall line, height
RIM_W, RIM_H = 0.12, 0.10      # hull rim


def _strip(m, x0, x1, y0, y1, z, h, top, fy, fx):
    """Raised strip: flat top, lit +y face, shaded +x face."""
    m.poly([core.G(x0, y0, z + h), core.G(x1, y0, z + h), core.G(x1, y1, z + h), core.G(x0, y1, z + h)], top, flip=True)
    m.poly([core.G(x0, y1, z), core.G(x1, y1, z), core.G(x1, y1, z + h), core.G(x0, y1, z + h)], fy)
    m.poly([core.G(x1, y0, z), core.G(x1, y1, z), core.G(x1, y1, z + h), core.G(x1, y0, z + h)], fx)


def _edges(m, bits, w, h, top, fy, fx, z=ZR):
    if bits & 1:
        _strip(m, -0.5, 0.5, -0.5, -0.5 + w, z, h, top, fy, fx)
    if bits & 8:
        _strip(m, -0.5, -0.5 + w, -0.5, 0.5, z, h, top, fy, fx)
    if bits & 4:
        _strip(m, -0.5, 0.5, 0.5 - w, 0.5, z, h, top, fy, fx)
    if bits & 2:
        _strip(m, 0.5 - w, 0.5, -0.5, 0.5, z, h, top, fy, fx)


def _tile(m, mask, rib=0):
    z = ZR
    m.pattern((-0.5, -0.5, z), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: "rfP")
    z0 = z - T
    if not mask & 4:                                # +y edge (lit): hull slab side
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(-0.5, 0.5, z)], "rfRY")
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(-0.5, 0.5, z0 + 0.035)], "rfK")
    if not mask & 2:                                # +x edge (shaded)
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(0.5, -0.5, z)], "rfRX")
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(0.5, -0.5, z0 + 0.035)], "rfK")
    _edges(m, rib & mask, RIB_W, RIB_H, "rfRL", "rfRY", "rfRX")
    _edges(m, ~mask & 15, RIM_W, RIM_H, "ochM", "ochD", "ochK")


def frame(mask, rib=0):
    m = core.Mesh("roof_frame", flat=True)
    _tile(m, mask, rib)
    return [m.build()]


def light(side):
    """Running light on the rim of side n/e/s/w, at the tile edge centre."""
    m = core.Mesh("roof_light", flat=True)
    z = ZR + RIM_H
    cx, cy = {"n": (0, -0.5 + RIM_W / 2), "s": (0, 0.5 - RIM_W / 2), "w": (-0.5 + RIM_W / 2, 0), "e": (0.5 - RIM_W / 2, 0)}[side]
    m.box((cx, cy, z), (0.09, 0.09, 0.03), "green", base=True)
    return [m.build()]


def hatch(side):
    """Door hatch straddling the shared edge: side s = centre (0, 0.5), e = centre (0.5, 0)."""
    m = core.Mesh("roof_hatch", flat=True)
    cx, cy = (0, 0.5) if side == "s" else (0.5, 0)
    sx, sy = (0.5, 0.4) if side == "s" else (0.4, 0.5)
    z = ZR
    m.box((cx, cy, z), (sx, sy, 0.035), "ochM", top="ochL", base=True)
    m.box((cx, cy, z + 0.035), (sx - 0.14, sy - 0.14, 0.02), "rfRY", top="rfRL", base=True)
    return [m.build()]


def vent():
    m = core.Mesh("roof_vent", flat=True)
    z = ZR
    m.box((0, 0, z), (0.46, 0.34, 0.03), "rfK", top="rfK", base=True)
    for k in (-1, 0, 1):
        m.box((0, k * 0.1, z + 0.03), (0.38, 0.06, 0.04), "rfRY", top="rfRL", base=True)
    return [m.build()]


def generic(mask):
    m = core.Mesh(f"roof_generic_{mask}", flat=True)
    _tile(m, mask)
    return [m.build()]


def weapon(mask):
    m = core.Mesh(f"roof_weapon_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.34, 0.025, "steelD", sides=8, top="steelL")                  # turret ring
    m.cyl((0, 0, z + 0.025), 0.29, 0.02, "dark", sides=8)
    m.cyl((0, 0, z + 0.045), 0.25, 0.05, "gmD", sides=8, top="gm", rtop=0.22)        # armoured hatch
    m.box((0, 0, z + 0.095), (0.4, 0.07, 0.025), "dark", base=True)                  # shutter slit
    m.box((0, 0, z + 0.095), (0.07, 0.4, 0.025), "steelD", base=True)
    for sx in (-1, 1):
        m.box((sx * 0.17, 0, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)       # warning tabs
        m.box((0, sx * 0.17, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)
    return [m.build()]


def shield(mask):
    m = core.Mesh(f"roof_shield_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.33, 0.04, "steelD", sides=8, top="steelL")                    # collar
    m.cyl((0, 0, z + 0.04), 0.27, 0.07, "gm", sides=8, rtop=0.23)                    # dome, three stacked bands
    m.cyl((0, 0, z + 0.11), 0.23, 0.07, "plate", sides=8, rtop=0.16)
    m.cyl((0, 0, z + 0.18), 0.16, 0.06, "steelL", sides=8, rtop=0.07)
    m.cyl((0, 0, z + 0.24), 0.045, 0.06, "cyan", sides=8, rtop=0.02)                 # emitter tip (glows)
    for k in range(4):                                                               # emitter nodes
        sx, sy = (-1, 1)[k & 1], (-1, 1)[k >> 1]
        m.cyl((sx * 0.26, sy * 0.26, z), 0.035, 0.1, "gm", sides=4, top="cyan")
    return [m.build()]


def engine(mask):
    m = core.Mesh(f"roof_engine_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.box((0, 0, z), (0.7, 0.7, 0.05), "gmD", top="steel", base=True)                # vent frame
    m.box((0, 0, z + 0.05), (0.58, 0.58, 0.02), "dark", base=True)
    for k in range(5):                                                               # louvres
        m.box((0, -0.2 + k * 0.1, z + 0.065), (0.54, 0.05, 0.03), "steelD", top="gm", base=True)
    m.box((0, 0.27, z + 0.06), (0.5, 0.03, 0.02), "orange", base=True)               # heat leaking out (glows)
    for k in range(4):
        m.box((-0.3 + k * 0.2, -0.355, z + 0.05), (0.1, 0.02, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    return [m.build()]


SPRITES = []
for _name, _fn in (("generic", generic), ("weapon", weapon), ("shield", shield), ("engine", engine)):
    for _m in range(16):
        SPRITES.append((f"roof.{_name}.m{_m}", (1, 1), "block", lambda m=_m, f=_fn: f(m)))
    SPRITES.append((f"roof.{_name}", (1, 1), "block", lambda f=_fn: f(15)))
