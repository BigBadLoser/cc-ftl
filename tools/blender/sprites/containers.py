"""Cargo containers (family `containers`): sealed exterior shells, no interior, clamped by a short end to a truss spine
and detachable, so every side is finished. modkit local frame (u across the width, v along the length, z up), turned
and anchored at the front-most footprint tile like every module. HEIGHT per size, hung centred on the truss's mid height
(ZC): half the box is below the beam line, in open space.

Shell: a reinforced corner frame (posts, rails, corner castings), corrugated long sides with a smooth livery band, a
ribbed roof with four lifting eyes, a ribbed blank end and the door end (twin doors, locking bars, hinges, the clamp
socket); a small status light on the roof by the door end (glow layer).

Ids (the renderer's chain, render/moduleArt.containerChain; the game mirrors the sides not rendered):
  container.<W>x<H>.r<N>.<end>[.v1|.v2][.damaged|.destroyed|.patched]   end: the door (clamped) end; per size and
      rotation one with the doors toward the camera (r0 .s, r1 .e) and one away (r0 .n, r1 .w)
  <shell id>.paint                     paint overlay: the painted plating alone (sides, ends, doors, roof) in its lit
      neutral greys, the rest a holdout. The game tints it with the livery's primary colour P, keeping the shading:
      out = P * lum(px) / lum(plate #6f7b87), drawn over the shell
  <shell id>.lv                        livery mask (key colours mkP / mkS) over the trim bands, recoloured per faction
      (S the band, P its pinstripe), drawn over the paint
  <shell id>.logo.<company>            then a company logo (containers_logo.py), picked by hash; intact and damaged
      shells only (patched: the scrappers' X replaces the brand; destroyed: burnt off)
  Every overlay is rendered from its shell's own build, so dents, holes and welded plates cover it as on the shell.
  Destroyed shells have no overlays at all: the paint is burnt off, the wreck is bare char.
  container.<W>x<H>[.paint|.lv]        fallback: r0, doors toward the camera
  container.clamp.<n|e|s|w>, container.clamp   the clamp at the middle tile of the clamped side, gripping the door end
Variants v0 (no suffix), v1 (stencil code on the roof, hazard roof edge), v2 (flat panelled sides and roof, rust),
picked by a hash. States: damaged / destroyed by the damage pass (no sparks, no debris: in space; destroyed has no
light), patched: a scrapper box (containers_scrap.py), welded shut, salvage plates, their tags."""
import random

from . import damage
from .modkit import K

H, M = 2.0, 0.06                          # height (per size, set by _size); gap to the footprint edge
PAINT, BANDS, LOGO = "_paint", ("_bandS", "_bandP"), "_logo"   # name tags: painted plating, the trim, a logo panel
MODE = {"company": None}                  # set while building a logo overlay: shell() adds that company's panels
HEIGHT = {"2x4": 2.0, "3x6": 3.0}
ZC = 0.34                                 # the truss's mid height (struct: chords 0.1 .. 0.58): containers hang
Z_OFF = ZC - H / 2                        # centred on it, half below the beam line in open space
FR, FRD, CAST = "gm", "gmD", "dark"       # frame, its darker face, corner castings
SH, SHL, SHD = "plate", "sole", "steelL"  # shell plating: body, rib crests, seams
BAND = ("sole", "steelD")                 # the neutral default trim under the livery (S, its P pinstripe)
SIZES = {"2x4": (2, 4), "3x6": (3, 6)}
ENDS = {0: ("s", "n"), 1: ("e", "w")}     # per rotation: doors toward the camera, doors away
BAND_Z = (0.42 * H, 0.62 * H)
LOGOS = True                              # families.py turns the logo overlays off with CONT_LOGOS=0


def _size(size):
    """Set the height and what follows from it for one size (the builders read these module values)."""
    global H, Z_OFF, BAND_Z
    H = HEIGHT[size]
    Z_OFF, BAND_Z = ZC - H / 2, (0.42 * H, 0.62 * H)


def _door_sign(rot, end):
    """+1 when the door end is the local +v end, -1 the local -v end (modkit.K: r0 +v = +y, r1 +v = -x)."""
    return {(0, "s"): 1, (0, "n"): -1, (1, "w"): 1, (1, "e"): -1}[(rot, end)]


def _frame(k, u0, v0):
    for su in (-1, 1):                                                               # rails, posts
        for z in (0.0, H - 0.09):
            k.box(su * (u0 - 0.045), 0, z, 0.09, 2 * v0, 0.09, FR, top=SHD)
    for sv in (-1, 1):
        for z in (0.0, H - 0.09):
            k.box(0, sv * (v0 - 0.045), z, 2 * u0, 0.09, 0.09, FR, top=SHD)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (u0 - 0.045), sv * (v0 - 0.045), 0.0, 0.09, 0.09, H, FR, top=SHD)
            for z in (-0.005, H - 0.105):
                k.box(su * (u0 - 0.05), sv * (v0 - 0.05), z, 0.12, 0.12, 0.11, CAST, top=FRD)


def _side(k, su, u0, v0, panelled):
    """A long side at u = su * u0: corrugation (or flat panels), the livery band across its middle. k is the painted
    mesh here (the whole side takes the livery's primary colour), the band the trim."""
    k.box(su * (u0 - 0.04), 0, 0.09, 0.05, 2 * v0 - 0.18, H - 0.18, SH, top=SH)
    span = 2 * v0 - 0.24
    if panelled:                                                                     # flat panels, recessed seams
        n = max(2, round(span / 0.5))
        for i in range(n + 1):
            k.box(su * (u0 - 0.012), -span / 2 + i * span / n, 0.1, 0.02, 0.025, H - 0.2, SHD)
    else:
        n = int(span / 0.13)
        for i in range(n):
            v = -span / 2 + (i + 0.5) * span / n
            for z0, z1 in ((0.1, BAND_Z[0]), (BAND_Z[1], H - 0.1)):
                k.box(su * (u0 - 0.015), v, z0, 0.03, 0.06, z1 - z0, SHL, top=SHL)


def _band(kb, kq, su, u0, v0):
    """The trim band (kb, the livery's secondary colour) with a pinstripe in the primary (kq)."""
    b, pin = BAND
    kb.box(su * (u0 - 0.004), 0, BAND_Z[0], 0.012, 2 * v0 - 0.5, BAND_Z[1] - BAND_Z[0], b, top=b)
    kq.box(su * (u0 + 0.002), 0, BAND_Z[0] + 0.03, 0.012, 2 * v0 - 0.5, 0.04, pin, top=pin)


def _end(k, kp, sv, u0, v0, doors, patched=False, panelled=False):
    """An end: its panel (and the door leaves) painted (kp), the door hardware bare (k)."""
    v = sv * (v0 - 0.04)
    kp.box(0, v, 0.09, 2 * u0 - 0.18, 0.05, H - 0.18, SH, top=SH)
    ve = sv * (v0 - 0.012)
    if not doors and panelled:                                                       # blank end: flat panels, as
        span = 2 * u0 - 0.24                                                         # the sides
        n = max(2, round(span / 0.5))
        for i in range(n + 1):
            kp.box(-span / 2 + i * span / n, ve, 0.1, 0.025, 0.02, H - 0.2, SHD)
        return
    if not doors:                                                                    # blank end: ribs across
        n = int((2 * u0 - 0.24) / 0.13)
        for i in range(n):
            kp.box(-u0 + 0.12 + (i + 0.5) * (2 * u0 - 0.24) / n, ve, 0.1, 0.06, 0.03, H - 0.2, SHL, top=SHL)
        return
    kp.box(0, ve, 0.1, 0.02, 0.02, H - 0.2, SHD)                                      # the split between the leaves
    for su in (-1, 1):
        for x in (0.3, 0.7):                                                         # locking bars, cam handles
            u = su * x * (u0 - 0.1)
            k.box(u, sv * (v0 - 0.0), 0.12, 0.03, 0.03, H - 0.24, SHD)
            k.box(u + su * 0.04, sv * (v0 + 0.005), 0.45 * H, 0.1, 0.02, 0.03, FRD)
        for z in (0.2, H / 2 - 0.04, H - 0.26):                                      # hinges at the outer edges
            k.box(su * (u0 - 0.13), sv * (v0 + 0.0), z, 0.05, 0.03, 0.08, FRD)
    k.box(0, sv * (v0 + 0.01), H / 2 - 0.1, 0.34, 0.05, 0.2, FRD, top=FR)              # clamp socket at mid height
    k.box(0, sv * (v0 + 0.035), H / 2 - 0.03, 0.12, 0.02, 0.06, SHD)                    # (the beam's), its pin
    if patched:
        from .containers_scrap import welded
        welded(k, sv, u0, v0)


def _roof(k, kp, u0, v0, door_sv, light, variant):
    kp.box(0, 0, H - 0.07, 2 * u0 - 0.16, 2 * v0 - 0.16, 0.05, SH, top=SH)
    if variant == 2:                                                                 # panelled roof: seams across
        n = max(2, round((2 * v0 - 0.3) / 0.7))
        for i in range(1, n):
            kp.box(0, -v0 + 0.15 + i * (2 * v0 - 0.3) / n, H - 0.024, 2 * u0 - 0.3, 0.03, 0.006, SHD)
    else:
        n = int((2 * v0 - 0.3) / 0.22)
        for i in range(n):                                                           # roof ribs across
            kp.box(0, -v0 + 0.15 + (i + 0.5) * (2 * v0 - 0.3) / n, H - 0.03, 2 * u0 - 0.3, 0.05, 0.015, SHL,
                   top=SHL)
    for su in (-1, 1):                                                               # lifting eyes on the castings
        for sv in (-1, 1):
            k.box(su * (u0 - 0.05), sv * (v0 - 0.05), H, 0.07, 0.03, 0.05, SHD)
    if light:                                                                        # status light by the door end
        k.box(u0 - 0.24, door_sv * (v0 - 0.22), H - 0.03, 0.08, 0.08, 0.04, FRD)
        k.box(u0 - 0.24, door_sv * (v0 - 0.22), H + 0.01, 0.05, 0.05, 0.03, light)
    if variant == 1:                                                                 # hazard edge at the blank end
        for i in range(int((2 * u0 - 0.3) / 0.1)):
            k.box(-u0 + 0.2 + i * 0.1, -door_sv * (v0 - 0.12), H - 0.025, 0.06, 0.06, 0.012,
                  "hazY" if i % 2 else "hazK")


def _stencil(k, sv, u0, v0, rnd):
    """A stencilled code on the roof by the blank end (always in view): white glyph blocks and a bar."""
    v = sv * (v0 - 0.42)
    x = -u0 + 0.28
    for _ in range(4 if u0 > 1 else 3):
        for dv, w in ((-0.08, 0.08), (0.0, 0.03 + 0.05 * rnd.random()), (0.08, 0.08)):
            k.box(x, v + dv, H - 0.018, w, 0.04, 0.01, "medWhite")
        x += 0.14
    k.box(0, v - sv * 0.18, H - 0.018, 2 * u0 - 0.5, 0.05, 0.01, "medWhite")


def shell(size, rot, end, variant=0, state=""):
    _size(size)
    W, L = SIZES[size]
    k = K(f"container_{size}_{rot}_{end}_{variant}_{state}", (W, L), rot)
    name = f"container_{size}_{rot}_{end}_{variant}_{state}"
    kp = K(name + PAINT, (W, L), rot)                                                # the painted surfaces
    kb, kq = (K(name + t, (W, L), rot) for t in BANDS)                               # the trim
    u0, v0 = W / 2 - M, L / 2 - M
    ds = _door_sign(rot, end)
    rnd = random.Random(f"{size}.{variant}")                                         # stable run to run
    _frame(k, u0, v0)
    for su in (-1, 1):
        _side(kp, su, u0, v0, panelled=variant == 2)
        _band(kb, kq, su, u0, v0)
    _end(k, kp, ds, u0, v0, True, patched=state == "patched")
    _end(k, kp, -ds, u0, v0, False, panelled=variant == 2)
    light = None if state == "destroyed" else ("orange" if state in ("damaged", "patched") else "green")
    _roof(k, kp, u0, v0, ds, light, variant)
    if variant == 1:
        _stencil(k, -ds, u0, v0, rnd)
    if variant == 2:
        from .containers_scrap import weathered
        weathered(k, ds, u0, v0, random.Random(f"{size}.{end}.wear"), amt=0.5, welded=False)
    if state == "patched":
        from .containers_scrap import patches
        patches(k, ds, u0, v0, random.Random(f"{size}.{end}.{variant}"))                  # each box its own
    objs = k.build() + kp.build() + kb.build() + kq.build()
    if MODE["company"]:
        from .containers_logo import panels
        objs += panels(size, rot, MODE["company"])
    return _hang(objs)


def painted(build):
    """The paint overlay of a shell build: the painted surfaces alone (lit, in their neutral greys), everything else a
    holdout. The game multiplies it by the livery's primary colour (see the module docstring)."""
    objs = build()
    for o in objs:
        if PAINT not in o.name:
            o.is_holdout = True
    return objs


def _hang(objs):
    for o in objs:
        o.location.z += Z_OFF
    return objs


def keyed(build):
    """The livery mask of a shell build: the trim alone in flat key colours (mkS band, mkP pinstripe; repainted after
    any damage pass, its dents kept), everything else a holdout."""
    from . import core
    objs = build()
    for o in objs:
        tag = next((t for t in BANDS if t in o.name), None)
        if tag is None:
            o.is_holdout = True
            continue
        n = len(o.data.polygons)
        core.set_attr(o.data, "Col", [(0, 0, 0)] * n)
        core.set_attr(o.data, "Self", [core.lin("mkS" if tag == BANDS[0] else "mkP")] * n)
        core.set_attr(o.data, "Glow", [(0, 0, 0)] * n)
    return objs


def branded(build, company):
    """A company logo overlay of a shell build: its panels alone (flat, damaged with the shell), the rest a holdout."""
    MODE["company"] = company
    try:
        objs = build()
    finally:
        MODE["company"] = None
    for o in objs:
        if LOGO not in o.name:
            o.is_holdout = True
    return objs


def clamp(side):
    """At the middle tile of the clamped side, level with the beam; built with the spine at local -v (r0 n, r1 e, r2 s,
    r3 w), the truss's centre line one tile in. robot_kit parts (character x = -u, f = v): a dark static sleeve bolted
    round the truss; on hinge discs above and below it two pairs of hazard-yellow claws arching out round the sleeve
    and hooking back onto the door end's socket pin, worked by exposed rams (dark barrels, bright rods); a hose loop
    over the top; a small latch collar on the door end round the socket."""
    import math

    import bpy

    from .robot_kit import Rig
    rig = Rig(f"clamp_{side}")
    p = rig.part("root")
    e, vb = -0.5 + M, -1.0                                                           # door end face, truss centre
    p.rbox((0, vb, ZC), (0.56, 0.5, 0.56), FRD, r=0.04, top=FR)                       # the sleeve
    for f in (vb + 0.255, vb - 0.255):
        for x in (-0.2, 0.2):
            for z in (ZC - 0.17, ZC + 0.17):
                p.box((x, f, z), (0.06, 0.02, 0.06), SHD)                               # its bolts
    p.box((0, vb - 0.26, ZC - 0.04), (0.36, 0.012, 0.09), "hazY")                       # tag on the far face
    p.box((0.18, vb - 0.26, ZC + 0.16), (0.06, 0.02, 0.05), "green")                     # engaged light
    p.rbox((0, e - 0.03, ZC - 0.02), (0.56, 0.06, 0.6), FRD, r=0.03, top=FR)              # latch collar on the door
    for z in (ZC - 0.3, ZC + 0.26):                                                  # end, hazard edges
        for i in range(5):
            p.box((-0.2 + i * 0.1, e - 0.065, z), (0.05, 0.012, 0.05), "hazY" if i % 2 else "hazK")
    for sz in (1, -1):                                                               # claws over and under the
        hz = ZC + sz * 0.33                                                          # sleeve, onto the socket pin
        p.rbox((0, vb + 0.1, ZC + sz * 0.3), (0.5, 0.16, 0.08), FR, r=0.02)                # hinge bracket
        p.cyl((0, vb + 0.12, hz), 0.08, 0.52, FRD, axis="x", top=SHD)                    # hinge disc
        for x in (-0.16, 0.16):
            h, apex, tip = (x, vb + 0.12, hz), (x, -0.72, ZC + sz * 0.6), (x, -0.5, ZC + sz * 0.1)
            p.plate(h, apex, 0.12, 0.1, "hazY", taper=0.9, r=0.025)                     # the claw arching out,
            p.plate(apex, tip, 0.11, 0.09, "hazY", taper=0.65, r=0.02)                  # hooking back in
            p.box(tip, (0.1, 0.06, 0.05), CAST)                                          # its pad on the pin
            p.box(apex, (0.13, 0.05, 0.05), "hazK")                                      # a black knuckle band
        for x in (-0.3, 0.3):                                                        # its ram
            r0, r1 = (x, vb + 0.05, ZC + sz * 0.12), (x, -0.74, ZC + sz * 0.48)
            m = tuple(r0[i] + (r1[i] - r0[i]) * 0.55 for i in range(3))
            p.strut(r0, m, 0.04, FRD)
            p.strut(m, r1, 0.02, "steelL")
            p.cyl(r1, 0.035, 0.06, FRD, axis="x")
    pts = [(0.24, vb + 0.02, ZC + 0.28)] + [(0.24, vb + 0.2 + 0.18 * t, ZC + 0.3 + 0.2 * math.sin(math.pi * t))
                                          for t in (0.25, 0.5, 0.75)] + [(0.24, -0.66, ZC + 0.42)]
    for a, b in zip(pts, pts[1:]):                                                   # the hose loop
        p.strut(a, b, 0.025, CAST)
    p.box((0.24, vb + 0.29, ZC + 0.49), (0.06, 0.06, 0.03), "medRed")
    rig.build()
    rig.root.rotation_euler = (0, 0, -{"n": 0, "e": 1, "s": 2, "w": 3}[side] * math.pi / 2)   # turned like modkit.K
    bpy.context.view_layer.update()
    return rig.objects()


def _jobs_for(size, rot, end, variant, state):
    """The shell sprite and its overlays from the same build (damage included): <id>.paint and <id>.lv (not on
    destroyed boxes: the paint is burnt off) and <id>.logo.<company> (not on patched or destroyed ones)."""
    sid = f"container.{size}.r{rot}.{end}" + (f".v{variant}" if variant else "")
    sid += f".{state}" if state else ""
    W, L = SIZES[size]
    fp = (W, L) if rot % 2 == 0 else (L, W)
    build = lambda: shell(size, rot, end, variant, state)  # noqa: E731
    if state in ("damaged", "destroyed"):
        build = damage.wrap(build, state, sid, False, False)
    out = [(sid, fp, "prop", build)]
    if state != "destroyed":                                                         # its paint burnt off: bare char
        out += [(f"{sid}.paint", fp, "block", lambda: painted(build)), (f"{sid}.lv", fp, "block", lambda: keyed(build))]
    if LOGOS and state in ("", "damaged"):
        from .containers_logo import COMPANIES
        out += [(f"{sid}.logo.{co}", fp, "block", lambda c=co: branded(build, c)) for co in COMPANIES]
    return out


def jobs(sizes=tuple(SIZES), rots=(0, 1), states=("", "damaged", "destroyed", "patched"), variants=(0, 1, 2)):
    out = []
    for size in sizes:
        W, L = SIZES[size]
        for rot in rots:
            for end in ENDS[rot]:
                for v in variants:
                    for st in states:
                        if st in ("destroyed", "patched") and v:
                            continue                                                 # those don't vary
                        out += _jobs_for(size, rot, end, v, st)
        out.append((f"container.{size}", (W, L), "prop", lambda s=size: shell(s, 0, "s")))
        out.append((f"container.{size}.paint", (W, L), "block", lambda s=size: painted(lambda: shell(s, 0, "s"))))
        out.append((f"container.{size}.lv", (W, L), "block", lambda s=size: keyed(lambda: shell(s, 0, "s"))))
    for side in "nesw":
        out.append((f"container.clamp.{side}", (1, 1), "prop", lambda s=side: clamp(s)))
    out.append(("container.clamp", (1, 1), "prop", lambda: clamp("n")))
    return out
