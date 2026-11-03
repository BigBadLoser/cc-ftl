"""Shield fx (family `fx_shield`): the pieces the renderer composes into a ship's layered shield bubble, built from fxkit
like the combat fx (screen frame, self-lit `fxH*` shield ramp and `fxI*` ion ramp, which feed the glow sheet).

Rim pieces lie along +u, `EDGE_L` long, with the bubble's inside towards -v (the renderer lays copies round the
bubble's ellipse, turned to its tangent, inside towards the centre). Their patterns repeat every `EDGE_L`, so copies
laid end to end tile without a seam, and loops run in 4 frames.

  shield_edge.l1   the faint inner shell: a thin dim line, small hex tiles                                  4, loop
  shield_edge.l2   a middle shell: a brighter line, a pulse running along the tiles                        4, loop
  shield_edge.l3   the outer shell (the next to break): a bright line with a haze inside it, lit tiles      4, loop
  shield_ripple    a bulge in the rim the renderer runs along it away from a hit                           4, loop
  shield_break     the outer shell cracking into shards that drift out and flicker away                    8, once
  shield_regen     a shell forming: tiles gather, the line draws across, a flash, it settles to l3         8, once
  shield_down      the whole bubble sputtering out (vent, lockout): arcs, flicker, gone                     8, once

Hits, anchored at the point a shot meets the bubble (not rotated):

  shield_hit.ion   ion drain: the lattice lights purple and the ripple runs *into* the hit, dimming out      6, once
  shield_pierce    a mass-driver slug punching through one layer: a flash, the shell torn open with shards
                   flung out, the tear's lit edge closing                                                   6, once

(`fx.shield_hit`, the absorbed shot, is in the `fx` family: fx_env.py.)
Frames are ids `fx.<name>.<n>`; `fx.<name>` alone is frame 0. Shapes are seeded (numpy default_rng), so renders repeat."""
import math

import numpy as np

from .fxkit import N, P, Fx

LOOP = 4
EDGE_L = 0.48                                                                # rim piece length (about 22 px): 4 tiles of 0.12
TILE = EDGE_L / LOOP
HEX = 0.1


def hexagon(f, u, v, r, col):
    f.flat([P(u + r * math.cos(a), v + r * math.sin(a), 0.02) for a in (math.pi / 6 + m * math.pi / 3 for m in range(6))], col)


def band(f, v0, v1, col, u0=-EDGE_L / 2, u1=EDGE_L / 2):
    """A square-ended strip along the rim (square ends, so neighbours meet)."""
    f.flat([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], col)


# per shell: line (half width, colour), core line or None, haze under it or None, tile radius, tile colour, lit tile colour
SHELLS = {
    "l1": dict(line=(0.016, "fxH2"), core=None, haze=None, r=0.022, tile="fxH2", lit="fxH1"),
    "l2": dict(line=(0.022, "fxH1"), core=None, haze=(0.05, "fxH2"), r=0.028, tile="fxH2", lit="fxH1"),
    "l3": dict(line=(0.032, "fxH1"), core=(0.012, "fxH0"), haze=(0.07, "fxH2"), r=0.034, tile="fxH1", lit="fxH0"),
}


def shell(f, s, k, lift=0.0):
    """One shell's rim at frame k; lift moves it outward (+v)."""
    w, col = s["line"]
    if s["haze"]:
        band(f, lift - s["haze"][0], lift - w, s["haze"][1])
    band(f, lift - w, lift + w, col)
    if s["core"]:
        band(f, lift - s["core"][0], lift + s["core"][0], s["core"][1])
    for j in range(LOOP):                                                    # tiles just inside the line, a pulse running along
        u = -EDGE_L / 2 + TILE * (j + 0.5)
        on = (j - k) % LOOP == 0
        hexagon(f, u, lift - w - s["r"] * 1.2, s["r"] * (1.25 if on else 1.0), s["lit"] if on else s["tile"])


def edge(layer, k):
    f = Fx(f"shield_edge_{layer}_{k}")
    shell(f, SHELLS[layer], k)
    return f.build()


def ripple(k):
    """A bulge in the outer shell: the line lifted outward in a smooth hump, lit white at its crest, tiles flaring."""
    f = Fx(f"shield_ripple_{k}")
    n = 16
    wob = 0.004 * math.sin(k / LOOP * math.tau)
    pts = []
    for i in range(n + 1):
        u = -EDGE_L / 2 + EDGE_L * i / n
        x = u / (EDGE_L / 2)
        pts.append((u, (0.06 + wob) * (0.5 + 0.5 * math.cos(math.pi * x))))  # zero at both ends, so it sits on the rim
    for (u0, h0), (u1, h1) in zip(pts, pts[1:]):
        crest = max(h0, h1) > 0.04
        f.flat([P(u0, h0 - 0.05), P(u1, h1 - 0.05), P(u1, h1 - 0.03), P(u0, h0 - 0.03)], "fxH2")
        f.flat([P(u0, h0 - 0.03), P(u1, h1 - 0.03), P(u1, h1 + 0.03), P(u0, h0 + 0.03)], "fxH1")
        if crest:
            f.flat([P(u0, h0 - 0.012), P(u1, h1 - 0.012), P(u1, h1 + 0.012), P(u0, h0 + 0.012)], "fxH0")
    for j in (-1, 0, 1):
        u = j * TILE + (k % 2) * 0.02
        h = 0.06 * (0.5 + 0.5 * math.cos(math.pi * u / (EDGE_L / 2)))
        hexagon(f, u, h - 0.07, 0.03 if j else 0.038, "fxH0" if j == 0 else "fxH1")
    return f.build()


def shield_break(k):
    """The outer shell cracks: shards of the line drift outward, tilt and dim, hex sparks thrown off, then nothing."""
    f = Fx(f"shield_break_{k}")
    if k == 0:                                                               # the flash as it goes
        band(f, -0.07, -0.035, "fxH1")
        band(f, -0.035, 0.035, "fxH0")
        return f.build()
    rng = np.random.default_rng(41)
    cuts = sorted(rng.uniform(-EDGE_L / 2, EDGE_L / 2, 3).tolist())
    edges = [-EDGE_L / 2] + cuts + [EDGE_L / 2]
    t = k / 7
    col = "fxH0" if k <= 1 else "fxH1" if k <= 4 else "fxH2"
    for i, (a, b) in enumerate(zip(edges, edges[1:])):
        if k >= 6 and i % 2:                                                 # shards flicker out one by one
            continue
        if k == 7 and i:
            continue
        gap = 0.012 + 0.03 * t
        a, b = a + gap, b - gap
        if b - a < 0.02:
            continue
        lift = (0.03 + 0.05 * rng.uniform()) * t * 3
        tilt = rng.uniform(-0.12, 0.12) * t * 3
        m, h = (a + b) / 2, (b - a) / 2 * (1 - 0.35 * t)
        w = 0.026 * (1 - 0.5 * t)
        f.flat([P(m - h, lift - w - tilt * h), P(m + h, lift - w + tilt * h), P(m + h, lift + w + tilt * h), P(m - h, lift + w - tilt * h)], col)
    for j in range(5):                                                       # hex sparks thrown outward
        if k > 6:
            break
        u = rng.uniform(-EDGE_L / 2, EDGE_L / 2)
        v = (0.04 + 0.1 * rng.uniform()) * t * 2.5
        hexagon(f, u, v, 0.022 * (1 - t), "fxH0" if k <= 2 else "fxH1")
    if k == 7:                                                               # a last ember (a frame is never empty)
        hexagon(f, 0.05, 0.12, 0.014, "fxH2")
    return f.build()


def regen(k):
    """A shell forms: dim tiles gather onto the rim, the line draws across left to right, a flash, then it settles."""
    f = Fx(f"shield_regen_{k}")
    s = SHELLS["l3"]
    rng = np.random.default_rng(52)
    if k <= 3:
        reach = -EDGE_L / 2 + EDGE_L * (k + 1) / 4                           # the line drawing across
        if k >= 1:
            band(f, -0.016, 0.016, "fxH1", u1=reach)
            hexagon(f, reach, 0.0, 0.03, "fxH0")                             # the bright drawing head
        for j in range(LOOP):                                                # tiles gather from inside the bubble
            u = -EDGE_L / 2 + TILE * (j + 0.5)
            v = -0.07 - 0.12 * (1 - k / 3) * (0.6 + 0.4 * rng.uniform())
            hexagon(f, u, v, 0.022 + 0.004 * k, "fxH2" if k < 2 else "fxH1")
        return f.build()
    if k == 4:                                                               # the flash as it closes
        band(f, -0.08, -0.04, "fxH1")
        band(f, -0.04, 0.04, "fxH0")
        for j in range(LOOP):
            hexagon(f, -EDGE_L / 2 + TILE * (j + 0.5), -0.08, 0.04, "fxH0")
        return f.build()
    shell(f, dict(s, core=(0.018, "fxH0") if k == 5 else s["core"]), k)  # settling to the outer shell's look
    return f.build()


def down(k):
    """Shields failing (a vent or a lockout): the rim sputters, arcs crawl along it, it flickers and is gone."""
    f = Fx(f"shield_down_{k}")
    rng = np.random.default_rng(60 + k)
    lit = (1.0, 0.0, 0.7, 0.0, 0.4, 0.0, 0.15, 0.0)[k]
    if lit:
        col = "fxH0" if lit > 0.8 else "fxH1" if lit > 0.3 else "fxH2"
        # the line breaks into dashes as it fails
        dashes = 1 if k == 0 else 3 if k == 2 else 5
        seg = EDGE_L / dashes
        for i in range(dashes):
            a = -EDGE_L / 2 + i * seg + (0.0 if dashes == 1 else seg * 0.18)
            b = -EDGE_L / 2 + (i + 1) * seg - (0.0 if dashes == 1 else seg * 0.18)
            band(f, -0.02 * lit - 0.008, 0.02 * lit + 0.008, col, a, b)
    if k <= 5:                                                               # arcs crawling along the rim
        for _ in range(2 if k < 4 else 1):
            u0 = rng.uniform(-EDGE_L / 2, 0.0)
            f.arc(P(u0, 0.0, 0.03), P(u0 + rng.uniform(0.12, 0.24), rng.uniform(-0.03, 0.05), 0.03), rng,
                  "fxH0" if k < 3 else "fxH1", n=4, jag=0.035, w=0.02)
    if k == 7:                                                               # one last spark
        hexagon(f, rng.uniform(-0.1, 0.1), 0.0, 0.016, "fxH2")
    return f.build()


def ion_hit(k):
    """Ion drain at the hit point: purple lattice tiles light round it, the front runs inward to the hit (the layer is
    drawn off into it), the tiles dimming out behind; frame 0 is the bolt's flash."""
    f = Fx(f"shield_hit_ion_{k}")
    if k == 0:
        f.sphere(P(0, 0, 0.2), 0.15, lambda n: "fxI0" if n.dot(N) > 0.3 else "fxI1", segs=12, rings=7)
        return f.build()
    front = 0.62 - 0.11 * k                                                  # contracting toward the hit
    w = HEX * math.sqrt(3)
    for i in range(-6, 7):
        for j in range(-7, 8):
            cu, cv = w * (i + 0.5 * (j % 2)), HEX * 1.5 * j
            d = math.hypot(cu, cv / 0.72)
            if d > 0.62 or d < front - 0.06:
                continue
            on = abs(d - front) < 0.06
            if not on and (i + j + k) % 2:                                   # the drained tiles behind the front die off
                continue
            r = HEX * (0.5 if on else 0.36 - 0.05 * k)
            if r < 0.02:
                continue
            col = "fxI1" if on else "fxI2"
            f.flat([P(cu + r * math.cos(a), cv + r * math.sin(a), 0.05) for a in (math.pi / 6 + n * math.pi / 3 for n in range(6))], col)
    core = (0.04, 0.055, 0.07, 0.08, 0.06, 0.035)[k]                        # swells as it drinks the layer, then gutters out
    f.sphere(P(0, 0, 0.2), core, lambda n: ("fxI0" if k <= 3 else "fxI1") if n.dot(N) > 0.5 else ("fxI1" if k <= 3 else "fxI2"),
             segs=10, rings=6)
    if k >= 2:                                                               # crackle into the core
        rng = np.random.default_rng(70 + k)
        for _ in range(3):
            a = rng.uniform(0, math.tau)
            f.arc(P(front * math.cos(a), front * 0.72 * math.sin(a), 0.1), P(0, 0, 0.15), rng, "fxI1", n=4, jag=0.04, w=0.02)
    return f.build()


def pierce(k):
    """A mass-driver slug tearing through one layer: a white flash, the shell ripped open in a jagged star, shards flung
    out and spinning off, the tear's lit edge closing over the last frames."""
    f = Fx(f"shield_pierce_{k}")
    rng = np.random.default_rng(80)
    if k == 0:
        f.sphere(P(0, 0, 0.2), 0.12, lambda n: "fxW" if n.dot(N) > 0.4 else "fxH0", segs=12, rings=7)
        f.streak(P(-0.35, 0.0, 0.3), P(0.35, 0.0, 0.3), 0.0, 0.05, "fxH0")
        return f.build()
    t = (k - 1) / 4
    n = 9
    open_r = 0.16 * (1.2 - t)                                                # the hole closes as the layer above holds
    rim = [(i * math.tau / n + rng.uniform(-0.15, 0.15), rng.uniform(0.8, 1.3)) for i in range(n)]
    for i, (a, s) in enumerate(rim):                                         # the torn lip: jagged teeth round the hole
        b, sb = rim[(i + 1) % n]
        r0, r1 = open_r * s, open_r * sb
        mid = (a + b) / 2 + (math.tau / 2 if b < a else 0)
        tip = open_r * 0.8
        out = 1.0 + 0.6 * (1 - t)
        pa = P(r0 * out * math.cos(a), r0 * out * 0.72 * math.sin(a), 0.05)
        pb = P(r1 * out * math.cos(b), r1 * out * 0.72 * math.sin(b), 0.05)
        pt = P(tip * math.cos(mid), tip * 0.72 * math.sin(mid), 0.05)
        f.flat([pa, pb, pt], "fxH2")                                          # torn lip, the hole inside stays open
        f.streak(pa, pb, 0.03, 0.03, "fxH0" if k <= 3 else "fxH1")
    for j in range(7):                                                       # shards flung out
        if k > 4 and j % 2:
            continue
        a = j * math.tau / 7 + rng.uniform(-0.3, 0.3)
        d = 0.2 + 0.32 * t + 0.08 * rng.uniform()
        c = P(d * math.cos(a), d * 0.72 * math.sin(a), 0.08)
        s = 0.035 * (1 - 0.5 * t)
        spin = a + k * 0.9
        f.flat([c + P(s * math.cos(spin + q * math.tau / 3), s * math.sin(spin + q * math.tau / 3)) for q in range(3)],
               "fxH0" if k <= 2 else "fxH1")
    if k <= 2:                                                               # the slug's trail punching out the far side
        f.streak(P(-0.1, 0.0, 0.3), P(0.45 + 0.2 * k, 0.0, 0.3), 0.06, 0.0, "fxW" if k == 1 else "fxH0")
    return f.build()


SHIELD = (("shield_edge.l1", lambda k: edge("l1", k), LOOP), ("shield_edge.l2", lambda k: edge("l2", k), LOOP),
          ("shield_edge.l3", lambda k: edge("l3", k), LOOP), ("shield_ripple", ripple, LOOP),
          ("shield_break", shield_break, 8), ("shield_regen", regen, 8), ("shield_down", down, 8),
          ("shield_hit.ion", ion_hit, 6), ("shield_pierce", pierce, 6))
SPRITES = []
for _name, _fn, _n in SHIELD:
    SPRITES += [(f"fx.{_name}.{_k}", (1, 1), "fx", lambda f=_fn, k=_k: f(k)) for _k in range(_n)]
    SPRITES.append((f"fx.{_name}", (1, 1), "fx", lambda f=_fn: f(0)))
