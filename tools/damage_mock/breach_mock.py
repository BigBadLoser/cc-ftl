"""python3 breach_mock.py <inputs> <out.png>: hull battle damage, mocked in numpy on renders of a stretch of hull (the
reference look for the damage shader). Inputs (one canvas, as gen_mock NOCROP renders them): _intact_in (the hull),
_strip_in2 (its machinery: wall3d_ext_stripped), _strip_ns (the machinery without its struts), _frame_in2 (the frame
alone: only=FRAME), _main_in (its main members: only=MAIN), _behind (the room behind the hull).

Hits land one after another as damage climbs; each grows from a dent and soot into a jagged, stepped tear, and past
half damage the tears spread and merge. The layers go in order: the armour, the backing under it (a band round every
tear, broken into chunks, layered along the edge), the machinery (in the dark), and for a breach hit grown on, a
through-hole to the room where only the frame still stands (its struts snapped, stubs at the ribs). The output is a
row of damage levels; it prints each layer's share."""
import sys

import numpy as np
from PIL import Image

D = sys.argv[1].rstrip("/") + "/"
LEVELS = (0.15, 0.35, 0.6, 0.85, 1.0)
HITS = ((0.36, 0.72, 1.1, 0.0), (0.77, 0.5, 0.8, 0.08), (0.55, 0.52, 0.9, 0.28), (0.2, 0.48, 0.85, 0.42),
        (0.66, 0.8, 1.0, 0.55), (0.9, 0.68, 0.75, 0.68))   # impact points (fractions of the crop), size, the damage
                                                          # at which each lands (damage climbs as hits land)
BREACH = (2, 4)                                    # these hits go on to punch through to the room
SPREAD = 34                                        # px each tear spreads by at full damage (they merge)
THROUGH, CORE = 0.35, 0.75                         # a breach hit punches through once grown this far; its
                                                   # through-hole at full growth: this share of its tear
BREACH_SPREAD = 0.35                               # a breach spreads this share as far (a puncture, not a peel)
GROW = 0.32                                        # damage over which a hit grows from a dent to its full tear
BREACH_SHAPE = dict(teeth=(1.1, 1.25), notch=(0.6, 0.72), body=(0.78, 1.0))   # (a breach: blunt, no long spikes)
TEAR_SHAPE = dict(teeth=(1.2, 1.4), notch=(0.5, 0.65), body=(0.7, 1.0))   # (a tear: short teeth)
STEP_W, STEP_H = (2, 6), (2, 4)                    # px: a breach's edge runs in steps this wide, this tall (irregular)
BACK_W = (3, 9)                                    # px: the backing plate shows this far round a hole (by noise)
BACK_TONE, BACK_LIFT = 0.42, 34.0                  # the backing: the plating's own art this dark, lifted this much
CHUNK = (6, 14), (4, 8)                            # px: the backing's broken chunks (irregular, wider than tall)
CRACKED = 0.5                                      # share of chunks whose edges show as fractures (the rest: one plate)
CHUNK_TONES = (-10, -4, 0, 0, 6)                   # each chunk's tone step
FRACTURE = (12, -16)                               # a fracture's lit (upper, left) and shadowed (lower, right) sides
STRATA, STRATA_TONE = 2, 3                         # px per stratum along the hole's edge; its tone step either way
BACK_MORE = 9                                      # px: up to this much more in places (broad, uneven lobes: whole
                                                   # sheets of armour gone, others hardly peeled)
LOBE_STEP = (3, 8), (2, 5)                         # px: the lobes' edges' steps (coarser)
BACK_STEP = (2, 4), (2, 3)                         # px: its edge's steps (finer than a breach's)
LIP = 1.1                                          # the armour's cut: this much lighter than its plate
INSIDE = 0.85                                      # the room seen through a breach: this bright
FLOOR_SHADE = (0.75, 0.65, 0.52, 0.4, 0.28, 0.15)  # the wall's shadow on it, by px down from the top edge
SNAP = (0.15, 0.5)                                 # a strut span (a stringer between two ribs) is snapped in a tear
                                                   # once damage passes its own draw: below SNAP[0] + SNAP[1] * damage;
                                                   # one a breach reaches is always snapped
SCRAP = 400                                        # px: a plating patch smaller than this, cut off by tears, goes
NECK = 1                                           # opening passes on the backing before its islands go
TORN = 3                                           # px: how far each row of a break's end tears on
STUB = (1, 5)                                      # px: a snapped span's stubs at its ribs
FRAME_TONE = 0.85                                  # (in the hull's shade)
SEED = 11


def load(n):
    return np.asarray(Image.open(D + n).convert("RGB")).astype(float)


intact, strip, behind, frame, main, strip_ns = (load(n) for n in ("_intact_in.png", "_strip_in2.png", "_behind.png",
                                                                    "_frame_in2.png", "_main_in.png", "_strip_ns.png"))
ys, xs = np.where(np.abs(intact - intact[0, 0]).sum(2) > 6)
y0, y1, x0, x1 = ys.min() - 6, ys.max() + 7, xs.min() - 6, xs.max() + 7
intact, strip, behind, frame, main, strip_ns = (a[y0:y1, x0:x1] for a in (intact, strip, behind, frame, main, strip_ns))
h, w = intact.shape[:2]
hull = (np.abs(intact - behind).sum(2) > 0) & (np.abs(intact - intact[0, 0]).sum(2) > 6)   # (not the empty space
                                                                                       # below the foot)                              # (the hull: where it hides what is behind)
yy, xx = np.mgrid[0:h, 0:w]
standing = np.abs(frame - intact[0, 0]).sum(2) > 6                     # (the structure: still standing in a breach;
mains = np.abs(main - intact[0, 0]).sum(2) > 6                          # its main members, which never break)
rng = np.random.default_rng(SEED)


def value_noise(scale, octaves=3):
    """Smooth noise over the crop (bilinear value noise, summed octaves), about -1..1."""
    out, amp = np.zeros((h, w)), 1.0
    for o in range(octaves):
        s = scale / 2 ** o
        gh, gw = int(h / s) + 3, int(w / s) + 3
        g = rng.uniform(-1, 1, (gh, gw))
        fy, fx = yy / s, xx / s
        iy, ix = fy.astype(int), fx.astype(int)
        ty, tx = fy - iy, fx - ix
        ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
        v = (g[iy, ix] * (1 - tx) + g[iy, ix + 1] * tx) * (1 - ty) + (g[iy + 1, ix] * (1 - tx) + g[iy + 1, ix + 1] * tx) * ty
        out += v * amp
        amp *= 0.5
    return out / 1.75


warp = value_noise(10, 3)
back_noise = value_noise(6, 2)                          # (raggedness of every edge)
grain = value_noise(3, 2)


def jagged(cracks, n=14, rng=rng, teeth=(1.5, 1.9), notch=(0.3, 0.45), body=(0.62, 1.0)):
    """A torn hole's outline, as a radius by angle: straight edges between n corners at irregular angles, a few long
    teeth (two along the hit's cracks: the tear runs on into them), some deep notches."""
    ang = np.sort(np.r_[rng.uniform(0, 2 * np.pi, n - 2), [ca for ca, _ in cracks[:2]]]) % (2 * np.pi)
    ang = np.sort(ang)
    rad = rng.uniform(*body, len(ang))
    for i in rng.choice(len(ang), 3, replace=False):
        rad[i] = rng.uniform(*notch)                             # (notches)
    for ca, _ in cracks[:2]:
        rad[np.argmin(np.abs(np.angle(np.exp(1j * (ang - ca)))))] = rng.uniform(*teeth)   # (teeth into the cracks)
    pts = np.c_[np.cos(ang) * rad, np.sin(ang) * rad]

    def inside(x, y):
        """Whether points (in the hole's own units) are inside the polygon (even-odd)."""
        res = np.zeros(x.shape, bool)
        for (x0, y0), (x1, y1) in zip(pts, np.roll(pts, -1, 0)):
            cross = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / (y1 - y0 + 1e-12) + x0)
            res ^= cross
        return res
    return inside


holes = []
for i, (hx, hy, size, land) in enumerate(HITS):                  # (each hit its own draws: its shapes stay put)
    hr = np.random.default_rng(SEED * 100 + i)
    cracks = [(hr.uniform(0, 2 * np.pi), hr.uniform(0.9, 1.5)) for _ in range(hr.integers(1, 4))]
    tear = jagged(cracks, rng=hr, **TEAR_SHAPE)
    core = jagged(cracks, n=18, rng=np.random.default_rng(SEED * 100 + 50 + i), **BREACH_SHAPE)
    holes.append((hx * w, hy * h, size, tear, cracks, land, core))


def steps(rng, sw=STEP_W, sh=STEP_H):
    """An irregular grid over the crop: cell edges at random spacings (STEP_W across, STEP_H down)."""
    def cuts(n, rngw):
        c = np.cumsum(rng.integers(rngw[0], rngw[1] + 1, n)) - rng.integers(0, rngw[1])
        return np.searchsorted(c, np.arange(n), side="right")
    return cuts(h, sh)[:, None] * 10000 + cuts(w, sw)[None, :]


def stepped(m, cells):
    """A mask squared off onto the cells: a cell is in if over half of it is (stepped, pixel-art edges)."""
    ids, inv = np.unique(cells, return_inverse=True)
    inv = inv.reshape(cells.shape)
    frac = np.bincount(inv.ravel(), m.ravel().astype(float)) / np.bincount(inv.ravel())
    return frac[inv] > 0.5


back_grid = steps(np.random.default_rng(SEED * 100 + 99), *BACK_STEP)
grids = [steps(np.random.default_rng(SEED * 100 + 80 + i)) for i in range(len(HITS))]


def grown(dmg, land):
    """How far a hit has grown at this damage: 0 (not landed) .. 1."""
    return float(np.clip((dmg - land) / GROW, 0, 1)) if dmg >= land else -1.0


def fields(dmg):
    """(hole per hit, scorch amount 0..1, cracks) at this damage."""
    holes_, cores = [], []
    scorch = np.zeros((h, w))
    crack = np.zeros((h, w), bool)
    for i, (hx, hy, size, rf, cr, land, core) in enumerate(holes):
        g = grown(dmg, land)
        if g < 0:
            continue
        dx, dy = xx - hx, (yy - hy) * 1.35                          # (flattened: the iso view of the face)
        r, a = np.hypot(dx, dy), np.arctan2(dy, dx)
        R = max(0.0, g - 0.15) / 0.85 * 18 * size                  # (a fresh hit: a dent and soot, no hole yet)
        late = max(0.0, dmg - 0.5) / 0.5 if R > 0 else 0.0
        R0, R = R, R + SPREAD * size * late                        # (past half: the plating goes wholesale)
        m = rf(dx / max(R, 1e-6), dy / max(R, 1e-6)) & (R > 0) & hull
        holes_.append(stepped(m, grids[i]) & hull)             # (every hit tears to the machinery; a breach hit,
        if i in BREACH and g >= THROUGH:                           # grown on, punches through it too: the machinery
            Rc = CORE * R0 * (g - THROUGH) / (1 - THROUGH) + BREACH_SPREAD * SPREAD * size * late   # and inner wall
            c = core(dx / max(Rc, 1e-6), dy / max(Rc, 1e-6)) & (Rc > 0) & hull                   # gone, the frame
            cores.append(stepped(c, grids[i]) & m)                                                  # left)
        S = (6 + g * 20 + SPREAD * 0.8 * max(0.0, dmg - 0.5) / 0.5) * size
        scorch = np.maximum(scorch, np.clip(1.15 - r / (S * (1 + 0.35 * warp)), 0, 1))
        for ca, cl in cr:                                          # (cracks: thin, wandering, out from the hole)
            da = np.angle(np.exp(1j * (a - ca - 0.25 * warp)))
            reach = (R + 4) * cl * g ** 0.5
            crack |= (np.abs(da) * r < 0.6 + 0.15 * r / max(reach, 1)) & (r < reach) & (r > R * 0.8)
    return holes_, cores, scorch * hull, crack & hull


def shift(m, dy, dx):
    o = np.zeros_like(m)
    o[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return o


SOOT = np.array([30, 33, 37.])
DENT_N, DENT_R, PULL, STEPS = 7, (4.0, 8.0), 3.0, (0.6, 0.78, 1.0, 1.15, 1.3)
dents = []                                          # (bowls round each hit: x, y, radius, when it shows)
for hx, hy, size, land in HITS:
    for _ in range(DENT_N):
        a, r = rng.uniform(0, 2 * np.pi), abs(rng.normal(0, 9 * size))
        dents.append((hx * w + r * np.cos(a), hy * h + r * np.sin(a) / 1.35, rng.uniform(*DENT_R) * size,
                      land + GROW * min(0.8, r / (40 * size))))


def dent_field(dmg):
    """Depth of the dents shown at this damage (each grows in once the damage reaches it)."""
    d = np.zeros((h, w))
    for cx, cy, r, soon in dents:
        g = np.clip((dmg - soon) / 0.15, 0, 1)
        if g > 0:
            d += g * np.exp(-((xx - cx) ** 2 + ((yy - cy) * 1.35) ** 2) / (2 * r * r))
    return d * hull


def bend(img, d):
    """The art bent by the dents: each px sampled from nearer the dent's middle (whole px), and stepped light/dark by
    the dent's slope (lit where it faces up and left)."""
    gy, gx = np.gradient(d)
    sy = np.clip(np.round(yy + gy * PULL * 6), 0, h - 1).astype(int)
    sx = np.clip(np.round(xx + gx * PULL * 6), 0, w - 1).astype(int)
    src = hull[sy, sx]
    out = np.where((src & hull)[..., None], img[sy, sx], img)
    lit = -(gy * 0.8 + gx * 0.5) * 16
    step = np.clip(np.round(lit), -2, 2).astype(int) + 2
    return out * np.array(STEPS)[step][..., None]


SECTION = np.array([40, 46, 52.])
def in_dark(img):
    """The machinery in the dark: only its lit tops and edges catch the light."""
    return img * (0.62 + 0.38 * np.clip((img.mean(2, keepdims=True) - 115) / 55, 0, 1))


cavity, cavity_ns = in_dark(strip), in_dark(strip_ns)


def label(m):
    """Each 4-connected run of m its own number (1..n); 0 elsewhere."""
    lab, n = np.zeros(m.shape, int), 0
    for y0_, x0_ in zip(*np.nonzero(m)):
        if lab[y0_, x0_]:
            continue
        n += 1
        lab[y0_, x0_], todo = n, [(y0_, x0_)]
        while todo:
            cy, cx = todo.pop()
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    todo.append((ny, nx))
    return lab, n


spans, n_spans = label(standing & ~mains)                  # (the struts, split at the ribs in front of them: spans)
span_info = []
for k in range(1, n_spans + 1):
    sy, sx = np.nonzero(spans == k)
    sr = np.random.default_rng(SEED * 1000 + k)
    a, b = sr.integers(*STUB, endpoint=True), sr.integers(*STUB, endpoint=True)
    ja, jb = sr.integers(0, TORN + 1, h), sr.integers(0, TORN + 1, h)          # (each row torn off its own length:
    gap = (spans == k) & (xx > sx.min() + a + ja[yy]) & (xx < sx.max() - b - jb[yy])   # jagged ends)
    for d in (1, 2):                                                            # (and its soft edge above and below
        gap = gap | shift(gap, d, 0) | shift(gap, -d, 0)                          # with it)
    span_info.append((k, sr.random(), gap))


def snapped(dmg, hole, core):
    """The struts shot away at this damage: each snapped span's middle (its stubs kept)."""
    out = np.zeros((h, w), bool)
    for k, draw, gap in span_info:
        span = spans == k
        if (span & core).any() or ((span & hole).any() and draw < SNAP[0] + SNAP[1] * dmg):
            out |= gap
    return out   # (the machinery in the dark: only its lit tops and
                                                                  # edges catch the light)                   # (the hull's cut, seen inside a breach's rim)
chunks = steps(np.random.default_rng(SEED * 100 + 97), *CHUNK)
_ids, _inv = np.unique(chunks, return_inverse=True)
_cr = np.random.default_rng(SEED * 100 + 96)
chunk_jit = _cr.choice(CHUNK_TONES, len(_ids))[_inv.reshape(h, w)]
chunk_crack = (_cr.random(len(_ids)) < CRACKED)[_inv.reshape(h, w)]   # (a chunk whose edges show as fractures)


def plate_tone(dist):
    """The backing's own detail (added to its tone): each chunk a step lighter or darker, its fractures lit along their
    upper and left sides and shadowed along their lower and right ones; faint strata following the hole's edge."""
    t = chunk_jit.astype(float)
    lit = (chunks != shift(chunks, 1, 0)) | (chunks != shift(chunks, 0, 1))
    shade = (chunks != shift(chunks, -1, 0)) | (chunks != shift(chunks, 0, -1))
    t += np.where(lit & chunk_crack, FRACTURE[0], 0.0) + np.where(shade & chunk_crack, FRACTURE[1], 0.0)
    t += np.where((dist // STRATA) % 2 == 1, -STRATA_TONE, STRATA_TONE)
    return t


lobe_noise = value_noise(18, 2)                     # (made last: the draws before it stay as they were)
lobe_grid = steps(np.random.default_rng(SEED * 100 + 98), *LOBE_STEP)
panels = []
for dmg in LEVELS:
    hs, cs, scorch, crack = fields(dmg)
    s = np.clip(scorch * (0.75 + 0.25 * grain), 0, 1)
    s = np.select([s > 0.75, s > 0.45, s > 0.2], [0.7, 0.45, 0.22], 0.0)[..., None]
    out = bend(intact, dent_field(dmg))
    out = out * (1 - s) + SOOT * s
    for hole in hs:
        out[crack & ~hole] = out[crack & ~hole] * 0.35 + SOOT * 0.65
    hole = np.any(hs, axis=0) if hs else np.zeros((h, w), bool)   # (every tear as one region, every core as
    core = np.any(cs, axis=0) if cs else np.zeros((h, w), bool)   # one: edges only where the plating still is)
    plate = hull & ~hole                                           # (plating left in slivers under 3 px between
    ero = plate & shift(plate, 1, 0) & shift(plate, -1, 0) & shift(plate, 0, 1) & shift(plate, 0, -1)   # tears: torn
    kept = ero | shift(ero, 1, 0) | shift(ero, -1, 0) | shift(ero, 0, 1) | shift(ero, 0, -1)          # away too)
    near_tear = shift(hole, 2, 0) | shift(hole, -2, 0) | shift(hole, 0, 2) | shift(hole, 0, -2)
    hole = hole | (plate & ~kept & near_tear)
    pl, pn = label(hull & ~hole)                                   # (plating cut off inside a tear, a scrap with
    for q in range(1, pn + 1):                                     # nothing to hang on: torn away with it)
        if (pl == q).sum() < SCRAP:
            hole |= pl == q
    dist, reach = np.full((h, w), 99), hole.copy()                # (how far each px is from a hole, to BACK_W[1])
    for k in range(1, BACK_W[1] + BACK_MORE + 1):
        grown_ = reach | shift(reach, 1, 0) | shift(reach, -1, 0) | shift(reach, 0, 1) | shift(reach, 0, -1)
        dist[grown_ & ~reach] = k
        reach = grown_
    width = BACK_W[0] + (BACK_W[1] - BACK_W[0]) * (0.5 + 0.5 * back_noise)
    more = width + BACK_MORE * np.clip((lobe_noise + 0.05) / 0.6, 0, 1) ** 1.5
    back = (stepped(dist <= width, back_grid) | stepped(dist <= more, lobe_grid)
            | (dist <= BACK_W[0])) & hull & ~hole
    for _ in range(NECK):                                          # (no thin necks: a lobe joined by a px or two
        ero = back & shift(back, 1, 0) & shift(back, -1, 0) & shift(back, 0, 1) & shift(back, 0, -1)   # reads as
        back = (back & (ero | shift(ero, 1, 0) | shift(ero, -1, 0) | shift(ero, 0, 1) | shift(ero, 0, -1))   # an
                | ((dist <= BACK_W[0]) & hull & ~hole))                                                         # island)
    held = back & (shift(hole, 1, 0) | shift(hole, -1, 0) | shift(hole, 0, 1) | shift(hole, 0, -1))
    while True:                                                    # (only backing joined to a hole: no islands)
        more_ = back & (held | shift(held, 1, 0) | shift(held, -1, 0) | shift(held, 0, 1) | shift(held, 0, -1))
        if (more_ == held).all():
            break
        held = more_
    back = held   # (the backing plate: where the
    lone = ~back & ~hole & hull                                    # armour has gone; always hugging the hole, so no
    lone &= (shift(back | hole, 1, 0) | shift(back | hole, -1, 0)).astype(bool) & \
        (shift(back | hole, 0, 1) | shift(back | hole, 0, -1))   # armour crumbs between it and the hole)
    back |= lone & ~(shift(~(back | hole) & hull, 1, 0) & shift(~(back | hole) & hull, -1, 0))
    skin = out * BACK_TONE + BACK_LIFT + plate_tone(dist)[..., None]   # (the skin held under the armour, lifted so
    out = np.where(back[..., None], skin, out)                      # dark armour still clears the cavity: broken into
                                                                   # chunks, layered along the hole's edge)
    gone = hole | back
    bshade = np.zeros((h, w))                                      # (the armour's shadow on the backing)
    for k, f in ((1, 0.5), (2, 0.25)):
        bshade = np.maximum(bshade, (back & ~shift(gone, k, 0)) * f)
    out = out * (1 - bshade[..., None]) + SOOT * bshade[..., None]
    tear = hole & ~core
    gapm = snapped(dmg, hole, core)
    out = np.where(tear[..., None], np.where(gapm[..., None], cavity_ns, cavity), out)   # (a tear: the plating gone,
                                                                                          # the machinery)
    shade = np.zeros((h, w))
    for k, f in ((1, 0.75), (2, 0.55), (3, 0.35)):
        shade = np.maximum(shade, (tear & ~shift(hole, k, 0) & hull) * f)
    out = out * (1 - shade[..., None]) + SOOT * shade[..., None]
    if core.any():                                                 # (a breach: the machinery and inner wall gone too,
        out = np.where(core[..., None], behind * INSIDE, out)      # a little darker; the wall's shadow on its floor
        fshade = np.zeros((h, w))                                  # from the top edge)
        for k, f in enumerate(FLOOR_SHADE, 1):
            fshade = np.maximum(fshade, (core & ~shift(core, k, 0)) * f)
        out = out * (1 - fshade[..., None]) + SOOT * fshade[..., None]
        rim = core & ~(shift(core, 1, 0) & shift(core, 0, 1) & shift(core, 0, -1))   # (the machinery's cut round it:
        out[rim] = SECTION                                         # dark; its sill's top face a step lit)
        out[core & ~shift(core, -1, 0)] = SECTION * 1.6
        keep = core & (mains | (standing & ~gapm))                 # (the frame across it; no strut spans it: stubs
        out = np.where(keep[..., None], frame * FRAME_TONE, out)   # at most)
    thick = ~gone & shift(gone, -1, 0) & hull                    # (the armour's cut: lit)
    out[thick] = np.minimum(out[thick] * LIP, 240)                  # (a step lighter than the plate it cuts: sooted
                                                                   # plate keeps a sooted lip)
    thick = back & shift(hole, -1, 0)                              # (the backing's cut: a dim step, just above it)
    out[thick] = out[thick] * 1.25
    panels.append(out)
    tot = hull.sum()
    print(f"damage {dmg:.2f}: plating {100 * (hull & ~gone).sum() / tot:.0f}%, backing {100 * back.sum() / tot:.0f}%, machinery {100 * (hole & ~core).sum() / tot:.0f}%,"
          f" through {100 * core.sum() / tot:.0f}%")
o = np.full((h, (w + 6) * len(panels), 3), 20.0)
for i, p in enumerate(panels):
    o[:, i * (w + 6):i * (w + 6) + w] = p
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).resize((o.shape[1] * 3, h * 3), Image.NEAREST).save(sys.argv[2])
