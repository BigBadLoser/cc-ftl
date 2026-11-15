"""Court landmarks (family `landmarks`): the banner post. Local frame and placement: modkit.K (front = +v). Four rotations.

- module.banner: a 1x1 banner post: the banner hangs from a crossbar on a post up the middle of its back, in the ship's
  livery with its roof emblem (roof_livery._emblem) on both faces. The livery is a key-colour mask overlay per emblem,
  module.banner.r{n}.lv.<dot | delta | cross | star | diamond | plain>, recoloured by the renderer like a container's trim.
  A row of them marks a drill hall; any faction's room can fly them."""
import math

from .modkit import K

EMBLEMS = ("dot", "delta", "cross", "star", "diamond")


def _banner_face(emblem, nu, nv, keyed):
    """A banner's face, cell (i, j) from its lower left: a field of livery P, a roundel of the ship's roof emblem near
    the top (roof_livery._emblem, the same shape as on the roof), two S bars below it, a swallow-tail hem. `keyed`:
    the key colours (mkP / mkS) of the livery mask; else the base sprite's neutral cloth under it."""
    from .roof_livery import _emblem
    P, S = ("mkP", "mkS") if keyed else ("plate", "steelL")
    sc = 66 / nu                                                                       # emblem cells per banner cell (the ring clears the hem)
    cy = nv - nu / 2 - 1

    def fn(i, j):
        if i in (0, nu - 1) or j == nv - 1:
            return None if keyed else "gmD"                                          # the hem and sides: not painted
        if j < 6 and abs(i - (nu - 1) / 2) < (6 - j) * nu / 12:
            return None                                                              # the swallow-tail notch
        if emblem:
            X, Y = (i + 0.5 - nu / 2) * sc, (cy - j - 0.5) * sc
            if X * X + Y * Y < 27 * 27:
                I, J = int(X + 32), int(Y + 32)
                c = _emblem(emblem, (I >= 32) + 2 * (J >= 32))(I % 32, J % 32)
                return {"P": P, "S": S}.get(c, P)
        lo = cy - nu / 2 - (4 if emblem else -nu / 2)
        if lo - 6 < j < lo - 3 or lo - 10 < j < lo - 8:
            return S
        return P
    return fn


def banner(rot, emblem=None, keyed=False):
    """A banner post (1x1): a post on a weighted foot up the middle of the banner's back, a crossbar at the top, the banner
    hung from it in the ship's livery with its roof emblem on both faces (livery mask <id>.lv.<emblem>; plain bars
    without one)."""
    k = K(f"banner_{rot}", (1, 1), rot)
    k.box(0, -0.06, 0.0, 0.34, 0.3, 0.07, "steelD", top="steel", bevel=0.02)             # weighted foot
    k.cyl(0, -0.06, 0.07, 0.04, 2.08, "steelL", top="steel", sides=8)                  # the post, behind the banner
    k.cyl(0, -0.06, 2.15, 0.065, 0.05, "ochD", top="ochM", sides=8)                    # finial
    k.box(0, -0.03, 2.0, 0.72, 0.04, 0.04, "steel", top="steelL")                        # crossbar
    for u in (-0.35, 0.35):                                                            # crossbar end caps
        k.box(u, -0.03, 1.99, 0.05, 0.06, 0.06, "ochD", top="ochM")
    objs = k.build()
    f = K(f"banner_{rot}_face{'_lv' if keyed else ''}", (1, 1), rot)
    f.m.flat = True
    w, h, z0 = 0.6, 1.1, 0.88
    nu, nv = round(w * 32), round(h * 32)
    fn = _banner_face(emblem, nu, nv, keyed)
    for sv in (1, -1):                                                                 # both faces
        a, b = f.p(-sv * w / 2, sv * 0.012), f.p(sv * w / 2, sv * 0.012)
        f.m.pattern((a[0], a[1], z0), (b[0] - a[0], b[1] - a[1], 0), (0, 0, h), nu, nv, fn)
    faces = f.build()
    if keyed:                                                                          # the mask: the face alone, the rest a holdout
        for o in objs:
            o.is_holdout = True
    return objs + faces


def _rots(name, fp, fn):
    out = []
    for r in range(4):
        f = (fp[1], fp[0]) if r % 2 == 1 else fp
        out.append((f"module.{name}.r{r}", f, "prop", lambda r=r: fn(r)))
    return out + [(f"module.{name}", fp, "prop", lambda: fn(0))]


# The family `landmarks`: the banner post, its livery masks (module.banner's livery masks (module.banner.r{n}.lv.<emblem | plain>).
SPRITES = [*_rots("banner", (1, 1), banner),
           *((f"module.banner.r{r}.lv.{e or 'plain'}", (1, 1), "prop", lambda r=r, e=e: banner(r, e, True))
             for r in range(4) for e in (*EMBLEMS, None))]
