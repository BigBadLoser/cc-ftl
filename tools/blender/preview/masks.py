"""Tint mask jobs for a jobs file's pieces: `<id>.deco` (rendered under core.TINT: the tinted tones white, the rest
black) and, for the exterior, `<id>.seam` (its seam pass, wall3d.SEAM_PASS: seams, panel outlines and painted
shading white). A piece's mask is its .deco less its .seam (belly_mock TINT=...)."""
from sprites import core
from sprites import wall3d as T


def _under(fn, tint=None, seam=False):
    def build():
        core.TINT, T.SEAM_PASS = tint, "tintW" if seam else None
        try:
            return fn()
        finally:
            core.TINT, T.SEAM_PASS = None, None
    return build


def jobs(base, tint, seams=True):
    """Mask jobs for base's jobs ({id: (kind, build)}), tint the tinted palette names."""
    out = {k + ".deco": (kind, _under(fn, tint)) for k, (kind, fn) in base.items()}
    if seams:
        out.update({k + ".seam": (kind, _under(fn, seam=True)) for k, (kind, fn) in base.items()})
    return out
