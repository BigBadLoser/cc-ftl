"""Surface art of walls, hull and their caps: pure functions from a surface position to a palette name.

Light comes from the upper left: up-facing surfaces are lightest, +y faces (screen left) take the lit ramp and +x faces
(screen right) the shade ramp. Every surface uses four or five clearly separated values: a near-black cut (interior wall
caps), a dark seam value, the body, a raised / lit value and a bright edge highlight. Positions: s runs along the face
from screen left (0) to screen right (1) inside the tile, z is height in tiles."""

C = 1 / 32                                   # one grid cell (one screen px across a face)

# role -> palette name, per surface family and face (y = lit, x = shade)
RAMP = {
    ("wall", "y"): dict(H="wH", L="wL", S="wS", M="wM", D="wD", K="wK"),
    ("wall", "x"): dict(H="wL", L="wXL", S="wXS", M="wXM", D="wXD", K="wK"),
    ("blue", "y"): dict(H="bH", L="bL", T="bT", M="bM", D="bD", K="bK"),
    ("blue", "x"): dict(H="bXH", L="bM", T="bD", M="bXM", D="bXD", K="bXK"),
    ("ochre", "y"): dict(H="oH", L="oL", T="oT", M="oM", D="oD", K="oK"),
    ("ochre", "x"): dict(H="oXH", L="oD", T="oXD", M="oXM", D="oXD", K="oXK"),
    ("rose", "y"): dict(H="rH", L="rL", M="rM", D="rD", K="rK"),
    ("rose", "x"): dict(H="rL", L="rXL", M="rXM", D="rXD", K="rK"),
}


def ramp(fam, face):
    return RAMP[(fam, "x" if face == "x" else "y")]


def cell(s):
    return int(s * 32 + 1e-6)


def _seam(s):
    """0 = panel seam column (dark), 1 = lit column right of it, None = panel body. Panels are half a tile wide."""
    c = cell(s) % 16
    return 0 if c == 0 else (1 if c == 1 else None)


def _box(s, z, s0, s1, z0, z1, R, raised=True, body=None):
    """Inset rectangle in each half-tile panel: raised = lit top/left, dark bottom/right (recessed swaps them)."""
    p = s % 0.5
    if not (s0 <= p < s1 and z0 <= z < z1):
        return None
    lit, dark = (R["L"], R["D"]) if raised else (R["D"], R["L"])
    if z1 - z < 0.035 or p - s0 < C:
        return lit
    if z - z0 < 0.03 or s1 - p < C:
        return dark
    return body or (R["S"] if raised else R["M"])


# ---- interior partition walls ---------------------------------------------------------------------------------

def _tseam(s):
    """Tile-level seam: 0 = dark seam column at the tile edge, 1 = lit column right of it, None = body."""
    c = cell(s)
    return 0 if c == 0 else (1 if c == 1 else None)


def wall_face(face, s, z, top, zs, full):
    """Vertical face of an interior wall. Full: a lower course of two raised panels per tile, a chest-high rail and an
    upper course of one wide recessed panel per tile; seams only at tile edges, so the run reads as long panels."""
    R = ramp("wall", face)
    if z < zs + 0.03:
        return R["D"]                                    # crease at the skirt
    if z > top - 0.05:
        return R["H"]                                    # bright lip under the black cap
    if z > top - 0.08:
        return R["D"]
    if not full:
        sm = _seam(s)
        if sm == 0:
            return R["D"]
        b = _box(s, z, 0.09, 0.41, zs + 0.06, top - 0.11, R)
        if b:
            return b
        return R["L"] if sm == 1 else R["M"]
    sm = _tseam(s)
    if sm == 0:
        return R["D"]
    zr = zs + 0.42 * (top - zs)                          # rail splits the face into two courses
    if zr + 0.08 <= z < zr + 0.11:
        return R["L"]                                    # rail: lit top
    if zr <= z < zr + 0.08:
        return R["S"]
    if zr - 0.03 <= z < zr:
        return R["D"]                                    # rail shadow
    if sm == 1:
        return R["L"]
    if z >= zr + 0.11:                                   # upper course: one wide recessed panel
        z0, z1 = zr + 0.2, top - 0.17
        if 0.08 <= s < 0.92 and z0 <= z < z1:
            if z1 - z < 0.03 or s < 0.08 + C:
                return R["D"]                            # recess: dark top / left
            if z - z0 < 0.03 or s >= 0.92 - C:
                return R["L"]                            # lit bottom / right lip
            if 0.66 <= s < 0.84 and abs(z - (z0 + 0.12)) < 0.02:
                return R["D"]                            # vent slot
            return R["M"]
        return R["S"]
    b = _box(s, z, 0.06, 0.44, zs + 0.1, zr - 0.1, R)
    if b:
        p = s % 0.5
        if b == R["S"] and 0.18 <= p < 0.32 and abs(z - (zs + zr) / 2 - 0.08) < 0.02:
            return R["D"]                                # handle slot
        return b
    return R["M"]


def wall_skirt(face, s, d, run, full=True):
    """Sloped skirt. face y/x/h (hip); d = distance from the wall foot, run = skirt depth. Half-tile plates with a
    raised inset panel each, like the reference's big skirt panels."""
    R = ramp("wall", "x" if face == "x" else "y")
    if d < C:
        return R["L"]                                    # lit crest
    if run - d < C:
        return R["D"]                                    # toe line on the floor
    if face == "h":
        return R["S"]
    if _seam(s) == 0:
        return R["D"]
    p = s % 0.5
    if full and 0.07 <= p < 0.43 and 0.22 * run <= d < 0.8 * run:
        if d < 0.22 * run + 1.2 * C or p < 0.07 + C:
            return R["L"]                                # lit upper / left edge of the inset
        if d >= 0.8 * run - 1.2 * C or p >= 0.43 - C:
            return R["D"]
        return R["S"]
    if d < 2 * C:
        return R["S"]
    return R["M"]


def wall_cap():
    return "wK"


# ---- hull: plate colour blocks --------------------------------------------------------------------------------

def ochre_at(s, variant):
    """Variant 1 carries an ochre plate across the middle of the tile (the colour blocks are vertical stripes)."""
    return bool(variant) and 0.16 <= s < 0.84


def _blk(s, variant):
    return "ochre" if ochre_at(s, variant) else "blue"


def _blk_edge(s, variant):
    """-1 at the ochre plate's left (lit) edge column, +1 at its right (shaded) edge column, else 0."""
    if not variant:
        return 0
    c = cell(s)
    return -1 if c == 5 else (1 if c == 26 else 0)


def hull_inner_face(face, s, z, top, zs, full, variant):
    """Camera-facing inner face of the far hull: blue-grey ribbed upper course with ochre tags, teal drawer course."""
    B = ramp("blue", face)
    if z < zs + 0.03:
        return B["K"]
    if z > top - 0.05:
        return B["H"]
    if z > top - 0.09:
        return B["K"]                                    # shadow under the thick cap
    sm = _seam(s)
    if not full:
        if sm == 0:
            return B["K"]
        if sm == 1:
            return B["L"]
        p = s % 0.5
        if 0.12 <= p < 0.38 and top - 0.2 <= z < top - 0.15:
            return B["D"]
        return B["M"]
    zd = zs + 0.37 * (top - zs)
    if z < zd:                                           # teal drawer course
        W = ramp("wall", face)
        if z > zd - 0.04:
            return W["L"]
        if sm == 0:
            return W["D"]
        b = _box(s, z, 0.06, 0.44, zs + 0.1, zd - 0.12, W)
        if b:
            p = s % 0.5
            if b == W["S"] and 0.15 <= p < 0.35 and abs(z - (zs + zd) / 2) < 0.02:
                return W["D"]
            return b
        return W["M"]
    if z < zd + 0.06:
        return B["K"]
    zp = (zd + top) / 2
    tm = _tseam(s)
    if tm == 0 or abs(z - zp) < 0.015:
        return B["K"]                                    # plate seams (tile edges and one course line)
    if tm == 1 or abs(z - zp + 0.03) < 0.015:
        return B["L"]
    p = s % 0.5
    if abs(z - zp - 0.06) < 0.025 and cell(p) in (4, 11):
        return B["H"]                                    # bolts
    if z < zd + 0.18:
        return B["D"]
    return B["M"]


def hull_cap(s, w, depth, variant, region="hull"):
    """Top of the far hull strip. s along the run, w = distance from the camera-side edge, depth = strip depth."""
    if region == "wall":
        return wall_cap()
    fam = _blk(s, variant)
    R = ramp(fam, "y")
    if w < 0.2:
        return "wK"                                      # inner cut band, like the partitions' caps
    w -= 0.2
    depth -= 0.2
    if w < C:
        return R["H"]                                    # lit edge of the armour top
    if depth - w < C:
        return R["M"]                                    # outer rim
    if cell(s) % 16 == 0:
        return R["K"]
    e = _blk_edge(s, variant)
    if e:
        return "oH" if e < 0 else "oK"
    return R["L"] if w < depth * 0.5 else R["T"]


def hull_skirt(face, s, d, run, variant):
    R = ramp("blue", "x" if face == "x" else "y")
    if d < C:
        return R["H"] if face != "x" else R["L"]
    if run - d < C:
        return R["K"]
    if face != "h" and _seam(s) == 0:
        return R["D"]
    if d < 2 * C:
        return R["L"]
    return R["M"]


# ---- near (outer) hull ------------------------------------------------------------------------------------------

def hull_out_face(face, s, f, variant):
    """Outer armour face of the ghost footing (about 22 px tall). f = 0 at the chamfer foot down to 1 at the bottom of
    the deck edge. A lit crest, an upper course with paired lights, a seam at deck level, a lower course of half-tile
    plates (alternately raised and recessed) with vent slots, and a dark undercut. Ochre blocks (variant 1) are raised."""
    if face == "d":
        s = (s * 2) % 1.0                                # the corner face is two tiles wide
    ochre = ochre_at(s, variant) and f < 0.9
    R = ramp("ochre" if ochre else "blue", face)
    c = cell(s)
    p = c % 16
    if f < 0.06:
        return R["H"]                                    # crest
    if f > 0.9:
        return R["K"]                                    # undercut
    e = _blk_edge(s, variant)
    if e:
        return R["H"] if e < 0 else R["K"]
    if 0.36 <= f < 0.42:
        return R["K"]                                    # seam at deck level
    if 0.42 <= f < 0.48:
        return R["L"]
    if p == 0:
        return R["K"]
    if f < 0.36:                                         # upper course
        if 0.14 <= f < 0.26 and c in (6, 7, 9, 10, 22, 23, 25, 26):
            return R["H"]                                # paired lights
        return R["L"] if f < 0.12 else R["M"]
    raised = (c // 16) % 2 == 0 or ochre
    if 0.62 <= f < 0.8 and 4 <= p <= 11 and p % 2 == 1:
        return R["K"]                                    # vent slots
    if raised:
        return R["L"] if p == 1 else (R["D"] if p == 15 else R["T"])
    return R["D"] if p == 1 else (R["L"] if p == 15 else R["M"])


def hull_out_top(kind, s, w, variant, wmax=1.0):
    """Top of the near hull. kind: 'bevel' (the 45 degree slope) or 'flat'; w = distance from the bevel crest
    (flat) or from the outer foot (bevel)."""
    fam = _blk(s, variant)
    R = ramp(fam, "y")
    if kind == "bevel":
        if cell(s) % 16 == 0:
            return R["M"]
        e = _blk_edge(s, variant)
        if e:
            return "oH" if e < 0 else "oD"
        return R["L"]
    if w < C:
        return R["H"]                                    # crest line
    if w < 2 * C:
        return R["M"]
    if w > wmax - 1.5 * C:
        return R["M"]                                    # faint rim against the deck
    if cell(s) % 16 == 0:
        return R["D"]
    return R["K"]                                        # dark cut top: the ghost reads as a cut, not a pavement
