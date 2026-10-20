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
  container.<W>x<H>.r<N>.<end>.lv      livery mask (key colours mkP / mkS) over the bands, recoloured per faction
  container.<W>x<H>                    fallback: r0, doors toward the camera
  container.clamp.<n|e|s|w>, container.clamp   the clamp at the middle tile of the clamped side, gripping the door end
Variants v0 (no suffix), v1 (stencil code on the roof, hazard roof edge), v2 (flat panelled sides and roof, wear), picked
by a hash. States: damaged / destroyed by the damage pass (no sparks, no debris: in space; destroyed has no light),
patched: welded plates of mismatched stock, a bar welded across the doors."""
import random

from . import damage
from .modkit import K

H, M = 2.0, 0.06                          # height (per size, set by _size); gap to the footprint edge
HEIGHT = {"2x3": 2.0, "3x5": 3.0}
ZC = 0.34                                 # the truss's mid height (struct: chords 0.1 .. 0.58): containers hang
Z_OFF = ZC - H / 2                        # centred on it, half below the beam line in open space
FR, FRD, CAST = "gm", "gmD", "dark"       # frame, its darker face, corner castings
SH, SHL, SHD = "plate", "sole", "steelL"  # shell plating: body, rib crests, seams
BAND = ("sole", "steelD")                 # the neutral default under the livery (P, S)
SIZES = {"2x3": (2, 3), "3x5": (3, 5)}
ENDS = {0: ("s", "n"), 1: ("e", "w")}     # per rotation: doors toward the camera, doors away
BAND_Z = (0.42 * H, 0.62 * H)


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


def _side(k, su, u0, v0, panelled, band=True):
    """A long side at u = su * u0: corrugation (or flat panels), the livery band across its middle."""
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
    if band:
        _band(k, su, u0, v0, BAND)


def _band(k, su, u0, v0, cols):
    p, s = cols
    k.box(su * (u0 - 0.004), 0, BAND_Z[0], 0.012, 2 * v0 - 0.5, BAND_Z[1] - BAND_Z[0], p, top=p)
    k.box(su * (u0 + 0.002), 0, BAND_Z[0] + 0.02, 0.012, 2 * v0 - 0.5, 0.04, s, top=s)


def _end(k, sv, u0, v0, doors, patched=False):
    v = sv * (v0 - 0.04)
    k.box(0, v, 0.09, 2 * u0 - 0.18, 0.05, H - 0.18, SH, top=SH)
    ve = sv * (v0 - 0.012)
    if not doors:                                                                    # blank end: ribs across
        n = int((2 * u0 - 0.24) / 0.13)
        for i in range(n):
            k.box(-u0 + 0.12 + (i + 0.5) * (2 * u0 - 0.24) / n, ve, 0.1, 0.06, 0.03, H - 0.2, SHL, top=SHL)
        return
    k.box(0, ve, 0.1, 0.02, 0.02, H - 0.2, SHD)                                       # the split between the leaves
    for su in (-1, 1):
        for x in (0.3, 0.7):                                                         # locking bars, cam handles
            u = su * x * (u0 - 0.1)
            k.box(u, sv * (v0 - 0.0), 0.12, 0.03, 0.03, H - 0.24, SHD)
            k.box(u + su * 0.04, sv * (v0 + 0.005), 0.45 * H, 0.1, 0.02, 0.03, FRD)
        for z in (0.2, H / 2 - 0.04, H - 0.26):                                      # hinges at the outer edges
            k.box(su * (u0 - 0.13), sv * (v0 + 0.0), z, 0.05, 0.03, 0.08, FRD)
    k.box(0, sv * (v0 + 0.01), H / 2 - 0.1, 0.34, 0.05, 0.2, FRD, top=FR)              # clamp socket at mid height
    k.box(0, sv * (v0 + 0.035), H / 2 - 0.03, 0.12, 0.02, 0.06, SHD)                    # (the beam's), its pin
    if patched:                                                                      # welded shut
        k.box(0, sv * (v0 + 0.02), 0.3 * H, 2 * u0 - 0.3, 0.03, 0.06, "rust", top="rustD")
        k.box(0, sv * (v0 + 0.03), 0.3 * H - 0.03, 2 * u0 - 0.26, 0.012, 0.012, CAST)


def _roof(k, u0, v0, door_sv, light, variant):
    k.box(0, 0, H - 0.07, 2 * u0 - 0.16, 2 * v0 - 0.16, 0.05, SH, top=SH)
    if variant == 2:                                                                 # panelled roof: seams across
        n = max(2, round((2 * v0 - 0.3) / 0.7))
        for i in range(1, n):
            k.box(0, -v0 + 0.15 + i * (2 * v0 - 0.3) / n, H - 0.024, 2 * u0 - 0.3, 0.03, 0.006, SHD)
    else:
        n = int((2 * v0 - 0.3) / 0.22)
        for i in range(n):                                                           # roof ribs across
            k.box(0, -v0 + 0.15 + (i + 0.5) * (2 * v0 - 0.3) / n, H - 0.03, 2 * u0 - 0.3, 0.05, 0.015, SHL, top=SHL)
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


def _wear(k, u0, v0, rnd):
    for _ in range(8):
        su = rnd.choice((-1, 1))
        k.box(su * (u0 + 0.003), rnd.uniform(-v0 + 0.3, v0 - 0.3), 0.1, 0.008, rnd.uniform(0.1, 0.35),
              rnd.uniform(0.06, 0.2) * H / 0.8, "grime")


def _patches(k, u0, v0, rnd):
    stock = ("rust", "gm", "steelD", "navy")
    for i in range(4):
        su = rnd.choice((-1, 1))
        v, z = rnd.uniform(-v0 + 0.35, v0 - 0.35), rnd.uniform(0.15, 0.6) * H / 0.8
        w, h = rnd.uniform(0.25, 0.5), rnd.uniform(0.25, 0.45)
        k.box(su * (u0 + 0.008), v, z, 0.02, w + 0.03, h + 0.03, CAST)                   # weld bead
        k.box(su * (u0 + 0.016), v, z + 0.015, 0.02, w, h, stock[i % 4], top=stock[i % 4])
    k.box(0, rnd.uniform(-v0 + 0.4, v0 - 0.4), H - 0.02, 0.5, 0.4, 0.025, "rust", top="rustD")   # a roof patch


def shell(size, rot, end, variant=0, state=""):
    _size(size)
    W, L = SIZES[size]
    k = K(f"container_{size}_{rot}_{end}_{variant}_{state}", (W, L), rot)
    u0, v0 = W / 2 - M, L / 2 - M
    ds = _door_sign(rot, end)
    rnd = random.Random(hash((size, variant)) & 0xffff)
    _frame(k, u0, v0)
    for su in (-1, 1):
        _side(k, su, u0, v0, panelled=variant == 2)
    _end(k, ds, u0, v0, True, patched=state == "patched")
    _end(k, -ds, u0, v0, False)
    light = None if state == "destroyed" else ("orange" if state in ("damaged", "patched") else "green")
    _roof(k, u0, v0, ds, light, variant)
    if variant == 1:
        _stencil(k, -ds, u0, v0, rnd)
    if variant == 2:
        _wear(k, u0, v0, rnd)
    if state == "patched":
        _patches(k, u0, v0, random.Random(17 + variant))
    return _hang(k.build())


def _hang(objs):
    for o in objs:
        o.location.z += Z_OFF
    return objs


def livery(size, rot, end):
    """The mask: the bands in key colours, the shell itself a holdout (it hides the bands' far side, draws nothing)."""
    objs = shell(size, rot, end)
    _size(size)
    for o in objs:
        o.is_holdout = True
    W, L = SIZES[size]
    k = K(f"container_lv_{size}_{rot}_{end}", (W, L), rot)
    k.m.flat = True
    for su in (-1, 1):
        _band(k, su, W / 2 - M + 0.003, L / 2 - M, ("mkP", "mkS"))
    return objs + _hang(k.build())


def clamp(side):
    """At the middle tile of the clamped side, level with the beam; built with the spine at local -v (r0 n, r1 e, r2 s,
    r3 w): a mount on the truss, two rams across to a latch plate locked in the door end's socket, claws above and
    below the socket."""
    k = K(f"clamp_{side}", (1, 1), {"n": 0, "e": 1, "s": 2, "w": 3}[side])
    e = -0.5 + M                                                                     # the door end's face
    k.box(0, -0.62, ZC - 0.26, 0.5, 0.16, 0.52, FRD, top=FR)                           # mount on the truss
    k.box(0, -0.535, ZC - 0.2, 0.42, 0.012, 0.4, "hazY")
    for i in range(4):
        k.box(-0.15 + i * 0.1, -0.528, ZC - 0.18, 0.05, 0.012, 0.36, "hazK")
    for su in (-1, 1):                                                               # hydraulic rams across
        k.box(su * 0.16, -0.48, ZC - 0.05, 0.08, 0.16, 0.08, FR, top=SHD)
        k.box(su * 0.16, -0.4, ZC - 0.035, 0.05, 0.08, 0.05, "steelL")
    k.box(0, e - 0.03, ZC - 0.1, 0.3, 0.08, 0.2, FR, top=SHD)                           # latch plate in the socket
    for dz in (0.14, -0.2):                                                          # claws over and under it
        k.box(0, e - 0.02, ZC + dz, 0.4, 0.14, 0.06, "hazY", top="hazY")
        k.box(0, e + 0.05, ZC + dz - (0.03 if dz > 0 else -0.03), 0.4, 0.03, 0.06, CAST)
    k.box(0, -0.62, ZC + 0.26, 0.08, 0.08, 0.05, FRD)
    k.box(0, -0.62, ZC + 0.3, 0.045, 0.045, 0.03, "green")                                # engaged light
    return k.build()


def _jobs_for(size, rot, end, variant, state):
    sid = f"container.{size}.r{rot}.{end}" + (f".v{variant}" if variant else "")
    W, L = SIZES[size]
    fp = (W, L) if rot % 2 == 0 else (L, W)
    if state in ("damaged", "destroyed"):
        return (f"{sid}.{state}", fp, "prop",
                damage.wrap(lambda: shell(size, rot, end, variant, state), state, f"{sid}.{state}", False, False))
    return (sid + (f".{state}" if state else ""), fp, "prop", lambda: shell(size, rot, end, variant, state))


def jobs(sizes=tuple(SIZES), rots=(0, 1), states=("", "damaged", "destroyed", "patched"), variants=(0, 1, 2)):
    out = []
    for size in sizes:
        W, L = SIZES[size]
        for rot in rots:
            fp = (W, L) if rot % 2 == 0 else (L, W)
            for end in ENDS[rot]:
                for v in variants:
                    for st in states:
                        if st in ("destroyed", "patched") and v:
                            continue                                                 # those don't vary
                        out.append(_jobs_for(size, rot, end, v, st))
                out.append((f"container.{size}.r{rot}.{end}.lv", fp, "block",
                            lambda s=size, r=rot, e=end: livery(s, r, e)))
        out.append((f"container.{size}", (W, L), "prop", lambda s=size: shell(s, 0, "s")))
    for side in "nesw":
        out.append((f"container.clamp.{side}", (1, 1), "prop", lambda s=side: clamp(s)))
    out.append(("container.clamp", (1, 1), "prop", lambda: clamp("n")))
    return out
