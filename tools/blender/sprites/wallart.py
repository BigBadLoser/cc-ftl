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

def wall_face(face, s, z, top, zs, full):
    R = ramp("wall", face)
    if z < zs + 0.03:
        return R["D"]                                    # crease at the skirt
    if z > top - 0.05:
        return R["H"]                                    # bright lip under the black cap
    if z > top - 0.08:
        return R["D"]
    sm = _seam(s)
    if sm == 0:
        return R["D"]
    if not full:
        b = _box(s, z, 0.09, 0.41, zs + 0.06, top - 0.11, R)
        if b:
            return b
        return R["L"] if sm == 1 else R["M"]
    if 1.42 <= z < 1.46:
        return R["L"]                                    # rail: lit top
    if 1.33 <= z < 1.42:
        return R["S"]
    if 1.30 <= z < 1.33:
        return R["D"]                                    # rail shadow
    if sm == 1:
        return R["L"]
    if z >= 1.46:
        if abs(z - 1.95) < 0.015:
            return R["D"]                                # horizontal plate seam
        if abs(z - 1.92) < 0.015:
            return R["L"]
        if 0.62 <= s < 0.82 and top - 0.2 <= z < top - 0.15:
            return R["D"]                                # one vent slot per tile
        return R["M"]
    b = _box(s, z, 0.07, 0.43, zs + 0.13, 1.18, R) if cell(s) < 16 else None
    if b:
        if b == R["S"] and 0.17 <= s < 0.33 and 0.64 <= z < 0.68:
            return R["D"]                                # drawer slot
        return b
    if cell(s) >= 16 and 0.9 <= z < 0.94 and 0.6 <= s < 0.9:
        return R["D"]
    return R["M"]


def wall_skirt(face, s, d, run):
    """Sloped skirt. face y/x/h (hip); d = distance from the wall foot, run = skirt depth."""
    R = ramp("wall", "x" if face == "x" else "y")
    if d < C:
        return R["L"]                                    # lit crest
    if run - d < C:
        return R["D"]                                    # toe line on the floor
    if face != "h" and _seam(s) == 0:
        return R["D"]
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
    if z < 1.12:                                         # teal drawer course
        W = ramp("wall", face)
        if z > 1.08:
            return W["L"]
        if sm == 0:
            return W["D"]
        b = _box(s, z, 0.06, 0.44, zs + 0.1, 1.0, W)
        if b:
            p = s % 0.5
            if b == W["S"] and 0.15 <= p < 0.35 and 0.55 <= z < 0.59:
                return W["D"]
            return b
        return W["M"]
    if z < 1.18:
        return B["K"]
    if sm == 0 or abs(z - 1.8) < 0.015:
        return B["K"]                                    # plate seams
    if sm == 1 or abs(z - 1.77) < 0.015:
        return B["L"]
    p = s % 0.5
    if abs(z - 1.86) < 0.025 and cell(p) in (4, 11):
        return B["H"]                                    # bolts
    if z < 1.3:
        return B["D"]
    return B["M"]


def hull_cap(s, w, depth, variant, region="hull"):
    """Top of the far hull strip. s along the run, w = distance from the camera-side edge, depth = strip depth."""
    if region == "wall":
        return wall_cap()
    fam = _blk(s, variant)
    R = ramp(fam, "y")
    if w < C:
        return R["H"]                                    # camera-side lip
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
    """Outer armour face. f = 0 at the bevel foot down to 1 at the bottom of the below-deck band. Courses: lights band,
    vent band, big plates with bolts, lower vents, dark undercut. Ochre plates are raised: lit left / top edge."""
    if face == "d":
        s = (s * 2) % 1.0                                # the corner face is two tiles wide
    ochre = ochre_at(s, variant) and f < 0.86
    R = ramp("ochre" if ochre else "blue", face)
    c = cell(s)
    p = c % 16
    if f < 0.025:
        return R["H"]
    if ochre and f > 0.845:
        return R["K"]
    e = _blk_edge(s, variant) if f < 0.86 else 0
    if e:
        return R["H"] if e < 0 else R["K"]
    if 0.2 <= f < 0.215 or 0.375 <= f < 0.39 or 0.70 <= f < 0.715:
        return R["K"]                                    # course seams
    if 0.36 <= f < 0.375:
        return R["L"]
    if f < 0.2:
        if 0.08 <= f < 0.135 and c in (9, 10, 13, 14):
            return R["H"]                                # paired lights, once per tile
        return R["M"] if f > 0.05 else R["L"]
    if f < 0.36:
        if c == 0 and f > 0.22:
            return R["K"]
        if 0.24 <= f < 0.33 and 19 <= c <= 27 and c % 2 == 1:
            return R["D"]                                # vent group
        return R["M"]
    if f < 0.70:
        if c == 0 or (c == 16 and f < 0.62):
            return R["K"]                                # plate seams
        if c == 1 or c == 17 or 0.39 <= f < 0.405:
            return R["L"]                                # lit plate edges
        if 0.43 <= f < 0.46 and c in (4, 6, 26, 28):
            return R["H"]                                # bolt pairs
        return R["D"] if f > 0.62 else R["M"]
    if f < 0.86:
        if 0.74 <= f < 0.83 and 6 <= c <= 14 and c % 2 == 0:
            return R["K"]
        if c == 0:
            return R["K"]
        return R["D"]
    if f < 0.875:
        return R["M"]
    return R["K"]


def hull_out_top(kind, s, w, variant):
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
    if w > 1 - 8 / 32 - 1.5 * C:
        return R["K"]                                    # inner rim against the deck
    if cell(s) % 16 == 0:
        return R["D"]
    e = _blk_edge(s, variant)
    if e:
        return "oH" if e < 0 else "oK"
    return R["T"]
