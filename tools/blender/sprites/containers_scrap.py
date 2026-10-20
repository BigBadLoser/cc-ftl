"""The patched container (containers.shell state `patched`): a box the scrappers welded shut and patched up. The doors
under heavy straps; salvaged plates of every stock welded and riveted over both sides and the roof (sooty heat halos,
chunky beads, some proud with an edge sprung loose, one a hazard-striped offcut); their spray-painted tags over it all,
picked per side from TAGS, with drips. Reads the size-dependent values (H) from containers at call time."""
from . import containers as C

STOCK = ("plate", "steelL", "gm", "steel", "sole", "navy", "plate", "rust", "steelL", "gm")
ODD = ("hazY", "pcb", "polyB", "medWhite")                # one bright odd plate per side
INKS = ("medRed", "medWhite", "hazY", "alG", "polyB")
TAGS = {  # spray stencils, top row first ('#' paint)
    "x": ("#...#", ".#.#.", "..#..", ".#.#.", "#...#"),
    "skull": (".#####.", "#######", "#..#..#", "#######", ".##.##.", ".#.#.#."),
    "bolt": ("...##", "..##.", ".####", "..##.", ".##..", "##..."),
    "arrow": ("...#...", "..###..", ".#####.", "...#...", "...#...", "...#..."),
    "tally": ("#.#.#.#..", "#.#.#.##.", "#.#.###.#", "#.####.#.", "####.#.#.", "#.#.#.#.."),
    "teeth": ("#.#.#.#.#", "#########", ".#.#.#.#."),
    "nope": (".#####.", "##...##", "#.#...#", "#..#..#", "#...#.#", "##...##", ".#####."),
}


def _spray(put, name, px, ink, rnd):
    """A tag centred on (0, 0): put(a, z, size, col) places one blob (a along the face, z up); a drip or two."""
    rows = TAGS[name]
    n, m = len(rows), len(rows[0])
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == "#":
                put((c - (m - 1) / 2) * px, ((n - 1) / 2 - r) * px, px * 1.05, ink)
    for _ in range(rnd.randint(1, 3)):                                               # paint runs from the bottom row
        c = rnd.choice([i for i, ch in enumerate(rows[-1]) if ch == "#"])
        for d in range(1, rnd.randint(2, 4)):
            put((c - (m - 1) / 2) * px, ((n - 1) / 2 - n + 1 - d) * px, px * 0.5, ink)


def _streak(put, a, z, length, rnd):
    """A rust streak running down from (a, z): put(a, z, wide, tall, col) places one segment; it narrows and fades."""
    n = max(2, int(min(length, z - 0.14) / 0.06))                                    # stops at the bottom rail
    for i in range(n):
        if i > 1 and rnd.random() < 0.12:
            continue                                                                 # a break in the run
        t = i / n
        col = "c1T4" if t < 0.2 else ("rust" if t < 0.6 else "rustD")                 # fresh at the head
        put(a + rnd.uniform(-0.008, 0.008), z - i * 0.06, 0.075 - 0.045 * t, 0.065, col)


def _flake(put, a, z, r, rnd):
    """Flaked paint round (a, z): chips of bare steel, a rust core where it has gone furthest."""
    for i in range(rnd.randint(9, 16)):
        s = rnd.uniform(0.04, 0.09)
        col = ("c1T4", "rust", "rust")[i] if i < 3 else rnd.choice(("steelL", "steel", "steelL", "sole", "rustD"))
        put(a + rnd.uniform(-r, r), z + rnd.uniform(-r, r) * 0.7, s * rnd.uniform(0.8, 1.6), s, col)


def weathered(k, ds, u0, v0, rnd, amt=1.0, welded=True):
    """The box itself gone to rust: streaks from under the top rail and the castings, flaking along the rails and
    corners, blooms on the roof, runs down the doors (from the straps when welded). Flat on the plating, under any
    plates and tags. amt scales how much (the worn variant v2 takes a little)."""
    H = C.H
    q = lambda n: max(1, round(n * amt))  # noqa: E731
    for su in (-1, 1):
        def side(a, z, w, h, col, su=su):
            k.box(su * (u0 + 0.003), a, z, 0.006, w, h, col)
        for _ in range(q(v0 * 3)):
            _streak(side, rnd.uniform(-v0 + 0.2, v0 - 0.2), H - 0.16, rnd.uniform(0.25, 0.7) * H, rnd)
        for sv in (-1, 1):
            _streak(side, sv * (v0 - 0.16), 0.2, 0.18, rnd)                          # under the bottom castings
            _streak(side, sv * (v0 - 0.14), H - 0.16, rnd.uniform(0.3, 0.6) * H, rnd)
        for _ in range(q(v0 * 2.5)):
            z = rnd.choice((0.14, H - 0.2, rnd.uniform(0.15, 0.9) * H))
            _flake(side, rnd.uniform(-v0 + 0.2, v0 - 0.2), z, rnd.uniform(0.08, 0.16), rnd)
    for sv in (ds, -ds):                                                             # the ends
        def end(a, z, w, h, col, sv=sv):
            k.box(a, sv * (v0 + (0.075 if sv == ds and welded else 0.02)), z, w, 0.006, h, col)
        for z in ((0.2 * H, 0.52 * H, 0.8 * H) if sv == ds and welded else (H - 0.16,)):
            for _ in range(q(2)):
                _streak(end, rnd.uniform(-u0 + 0.2, u0 - 0.2), z - 0.08, rnd.uniform(0.12, 0.3) * H, rnd)
        for _ in range(q(3)):
            _flake(end, rnd.uniform(-u0 + 0.2, u0 - 0.2), rnd.uniform(0.15, 0.9) * H, 0.1, rnd)
    def top(a, b, w, h, col):                                                        # the roof: a along v, b along u
        k.box(b, a, H - 0.008, h, w, 0.006, col)
    for su in (-1, 1):                                                               # stains running in along the
        b0 = su * (u0 - 0.12)                                                        # ribs from both long edges
        for _ in range(q(v0 * 2.5)):
            _streak(lambda a, zz, ww, hh, col, su=su, b0=b0: top(a, b0 - su * (1.0 - zz), ww, hh, col),
                    rnd.uniform(-v0 + 0.2, v0 - 0.2), 1.0, rnd.uniform(0.25, 0.75) * u0, rnd)
        for sv in (-1, 1):                                                           # round the castings and eyes
            for _ in range(q(2)):
                _flake(top, sv * (v0 - rnd.uniform(0.12, 0.3)), su * (u0 - rnd.uniform(0.12, 0.25)), 0.12, rnd)
    for _ in range(q(v0 * 3)):                                                       # flaking across it
        _flake(top, rnd.uniform(-v0 + 0.2, v0 - 0.2), rnd.uniform(-u0 + 0.2, u0 - 0.2), rnd.uniform(0.1, 0.18), rnd)


def welded(k, sv, u0, v0):
    """Doors welded shut: three heavy straps across both leaves, a plate over the lock seam, beads and bolt heads."""
    H, ve = C.H, sv * (v0 + 0.03)
    for i, z in enumerate((0.2 * H, 0.52 * H, 0.8 * H)):
        col = ("steelD", "rust", "gm")[i]
        k.box(0, ve - sv * 0.012, z - 0.06, 2 * u0 - 0.02, 0.02, 0.24, "grime")                  # heat halo
        k.box(0, ve - sv * 0.01, z - 0.03, 2 * u0 - 0.06, 0.04, 0.18, C.CAST)                    # weld bead behind
        k.box(0, ve + sv * 0.01, z, 2 * u0 - 0.1, 0.04, 0.12, col, top=col)
        for su in (-1, 1):
            k.box(su * (u0 - 0.1), ve + sv * 0.035, z + 0.01, 0.08, 0.025, 0.1, C.CAST)             # end welds
            for x in (0.25, 0.55):
                k.box(su * x, ve + sv * 0.035, z + 0.04, 0.045, 0.02, 0.045, "sole")                # bolt heads
    w, h = 0.5 if u0 < 1.2 else 0.62, 0.32 * H
    k.box(0, ve - sv * 0.008, 0.3 * H - 0.05, w + 0.14, 0.02, h + 0.1, "grime")
    k.box(0, ve - sv * 0.005, 0.3 * H - 0.025, w + 0.07, 0.03, h + 0.05, C.CAST)
    k.box(0, ve + sv * 0.005, 0.3 * H, w, 0.03, h, "steel", top="steelL")                          # over the lock seam


def _plate(k, su, u, v, z, w, h, stock, rnd, sprung=0):
    """A salvaged plate welded on a long side at u = su * u (the roof when su is 0): a sooty halo, a chunky bead, the
    plate, rivet rows top and bottom; sprung = +-1 peels that end's edge strip away from the face."""
    if not su:                                                                       # on the roof: w across, h along
        k.box(u, v, z - 0.005, w + 0.14, h + 0.14, 0.015, "grime")
        k.box(u, v, z, w + 0.06, h + 0.06, 0.02, C.CAST)
        body = h - (0.14 if sprung else 0)
        vb = v - sprung * 0.07
        if stock == "salvage":
            n = max(3, round(w / 0.14))
            for i in range(n):
                col = "hazY" if i % 2 else "hazK"
                k.box(u - w / 2 + (i + 0.5) * w / n, vb, z + 0.01, w / n, body, 0.025, col, top=col)
        else:
            k.box(u, vb, z + 0.01, w, body, 0.025, stock, top=stock)
        if sprung:                                                                   # its loose end, lifted
            k.box(u, v + sprung * (h / 2 - 0.08), z + 0.05, w, 0.15, 0.02, "steelL" if stock == "salvage" else stock,
                  rx=sprung * 0.5)
        for i in range(max(2, int(w / 0.14))):
            for dv in (-body / 2 + 0.05, body / 2 - 0.05):
                k.box(u - w / 2 + 0.07 + i * 0.14, vb + dv, z + 0.035, 0.045, 0.045, 0.012, "sole")
        return
    k.box(su * (u + 0.0), v, z - 0.06, 0.012, w + 0.14, h + 0.12, "grime")
    k.box(su * (u + 0.006), v, z - 0.03, 0.02, w + 0.06, h + 0.06, C.CAST)
    body = w - (0.14 if sprung else 0)
    vb = v - sprung * 0.07
    if stock == "salvage":                                                           # a hazard-striped offcut
        n = max(3, round(body / 0.14))
        for i in range(n):
            col = "hazY" if i % 2 else "hazK"
            k.box(su * (u + 0.018), vb - body / 2 + (i + 0.5) * body / n, z, 0.02, body / n, h, col)
    else:
        k.box(su * (u + 0.018), vb, z, 0.02, body, h, stock, top=stock)
    if sprung:                                                                       # its loose end, bent out
        e = v + sprung * (w / 2 - 0.07)
        k.box(su * (u + 0.05), e, z + 0.02, 0.02, 0.15, h - 0.04, "steelL" if stock == "salvage" else stock,
              rz=su * sprung * 0.45)
    for zz in (z + 0.05, z + h - 0.08):
        for i in range(max(2, int(body / 0.14))):
            k.box(su * (u + 0.03), vb - body / 2 + 0.07 + i * 0.14, zz, 0.012, 0.045, 0.045, "sole")


def patches(k, ds, u0, v0, rnd):
    H = C.H
    weathered(k, ds, u0, v0, rnd)
    n = 0
    for side, su in enumerate((-1, 1)):
        cells = 3 if v0 < 2 else 4                                                   # big plates, one per stretch
        span = (2 * v0 - 0.5) / cells
        odd, salv = rnd.randrange(cells), rnd.randrange(cells)
        for c in range(cells):
            w, h = rnd.uniform(0.7, 1.0) * span, rnd.uniform(0.35, 0.55) * H
            v = -v0 + 0.25 + (c + 0.5) * span + rnd.uniform(-0.1, 0.1) * span
            z = rnd.uniform(0.1, H - 0.2 - h)
            stock = "salvage" if c == salv else (ODD[(side * 2 + c) % len(ODD)] if c == odd else STOCK[n % len(STOCK)])
            _plate(k, su, u0, v, z, w, h, stock, rnd, sprung=rnd.choice((0, 0, -1, 1)))
            for _ in range(rnd.randint(1, 3)):                                       # rust bleeding out from under it
                _streak(lambda a, zz, ww, hh, col, su=su: k.box(su * (u0 + 0.003), a, zz, 0.006, ww, hh, col),
                        v + rnd.uniform(-w / 2, w / 2), z - 0.06, rnd.uniform(0.15, 0.5) * H, rnd)
            n += 1
        for _ in range(2):                                                           # smaller ones lapped over them
            _plate(k, su, u0 + 0.025, rnd.uniform(-v0 + 0.5, v0 - 0.5), rnd.uniform(0.15, 0.6) * H,
                   rnd.uniform(0.35, 0.55), rnd.uniform(0.3, 0.45), STOCK[n % len(STOCK)], rnd)
            n += 1
        names = rnd.sample(sorted(TAGS), 3 if v0 > 2 else 2)                         # their tags, over everything
        for i, name in enumerate(names):
            v = -v0 + 0.5 + (i + 0.5) * (2 * v0 - 1.0) / len(names) + rnd.uniform(-0.2, 0.2)
            z = rnd.uniform(0.3, 0.75) * H
            px = rnd.uniform(0.08, 0.1) * (1.25 if H > 2.5 else 1.0)

            def put(a, dz, s, col, v=v, z=z):
                k.box(su * (u0 + 0.06), v + su * a, z + dz, 0.008, s, s, col)
            _spray(put, name, px, rnd.choice(INKS), rnd)
    sv = ds                                                                          # one on the doors, between straps
    name = rnd.choice(("skull", "x", "nope", "bolt"))
    _spray(lambda a, dz, s, col: k.box(a, sv * (v0 + 0.075), 0.66 * H + dz, s, 0.008, s, col), name,
           0.08 * (1.25 if H > 2.5 else 1.0), rnd.choice(INKS), rnd)
    roof(k, ds, u0, v0, rnd)


def roof(k, ds, u0, v0, rnd):
    """The roof, seen the most: weld seams across it, a run of plates down its length (a hazard offcut, an odd bright
    one, one with its end lifted), rust stains running along the ribs from them, their biggest tag."""
    H, zr = C.H, C.H - 0.03

    def flat(a, b, w, h, col, z=H - 0.016):                                         # a along v, b along u
        k.box(b, a, z, h, w, 0.006, col)
    for _ in range(2):                                                               # weld seams across
        v = rnd.uniform(-v0 + 0.4, v0 - 0.4)
        k.box(0, v, H - 0.02, 2 * u0 - 0.3, 0.05, 0.02, C.CAST)
        k.box(0, v, H - 0.02, 2 * u0 - 0.2, 0.16, 0.008, "grime")
    cells = 3 if v0 < 2 else 4
    span = (2 * v0 - 0.4) / cells
    odd, salv, lift, bare = rnd.sample(range(cells), 4) if cells > 3 else rnd.sample(range(cells), 3) + [None]
    for c in range(cells):
        if c == bare:
            continue                                                                 # a stretch left in the paint
        w, h = rnd.uniform(0.35, 0.6) * (2 * u0), rnd.uniform(0.45, 0.7) * span
        u = rnd.uniform(-1, 1) * (u0 - w / 2 - 0.15)
        v = -v0 + 0.2 + (c + 0.5) * span
        stock = "salvage" if c == salv else (rnd.choice(ODD) if c == odd else rnd.choice(STOCK))
        _plate(k, 0, u, v, zr, w, h, stock, rnd, sprung=rnd.choice((-1, 1)) if c == lift else 0)
        for _ in range(rnd.randint(2, 3)):                                           # rust run along the ribs
            sg = rnd.choice((-1, 1))
            b0 = u + sg * w / 2

            def along(a, zz, ww, hh, col, sg=sg, b0=b0):                           # _streak's fall, turned to run
                flat(a, b0 + sg * (1.0 - zz), ww, hh, col)                            # out across u to the edge
            _streak(along, v + rnd.uniform(-h / 2, h / 2), 1.0, max(0.15, u0 - 0.12 - sg * b0), rnd)
    for _ in range(int(v0 * 2)):                                                     # heavier blooms
        _flake(flat, rnd.uniform(-v0 + 0.3, v0 - 0.3),
               rnd.uniform(-u0 + 0.25, u0 - 0.25), 0.16, rnd)
    name = rnd.choice(("skull", "x", "nope", "arrow"))                                # the big tag
    v = rnd.uniform(-0.3, 0.3) * v0
    px = 0.13 * (1.2 if u0 > 1.2 else 1.0)
    _spray(lambda a, dz, sz, col: k.box(-dz, v + a, H + 0.02, sz, sz, 0.008, col), name, px, rnd.choice(INKS), rnd)
