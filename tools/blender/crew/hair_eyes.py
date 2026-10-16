"""Head slots: hair, eyes and the temple implant."""
from lib.kit import hair
from .registry import slot_item


def _cap(b, h, w, ht, dz, shade, y=0.27):
    b.ball("head", w, ht, h, hair(shade), (0, y, dz))


@slot_item("hair", "mohawk")
def mohawk(b):
    _cap(b, 0.315, 0.325, 0.2, -0.0, 0.5, y=0.255)  # shaved sides: dark stubble cap
    b.prism("head", "limb", 0.065, 0.1, 0.12, hair(), (0, 0.37, 0.08), taper=0.8)
    b.prism("head", "limb", 0.065, 0.16, 0.12, hair(), (0, 0.39, -0.03), taper=0.8)
    b.prism("head", "limb", 0.065, 0.11, 0.10, hair(), (0, 0.34, -0.13), taper=0.8)


@slot_item("hair", "short")
def short(b):
    _cap(b, 0.33, 0.335, 0.2, -0.01, 1.0)
    b.prism("head", "box", 0.26, 0.05, 0.06, hair(0.9), (0, 0.285, 0.13))
    b.prism("head", "box", 0.28, 0.13, 0.1, hair(0.9), (0, 0.2, -0.13))


@slot_item("hair", "ponytail")
def ponytail(b):
    _cap(b, 0.33, 0.335, 0.19, -0.01, 1.0)
    b.prism("head", "box", 0.08, 0.05, 0.07, "strap", (0, 0.22, -0.17))
    b.prism("head", "limb", 0.09, 0.2, 0.09, hair(), (0, 0.15, -0.21), r=(0.3, 0, 0), taper=0.9)
    b.prism("head", "limb", 0.07, 0.15, 0.07, hair(0.9), (0, -0.01, -0.25), r=(0.15, 0, 0), taper=0.6)


@slot_item("hair", "shaved")
def shaved(b):
    _cap(b, 0.318, 0.322, 0.17, -0.005, 0.38, y=0.258)


@slot_item("eyes", "organic")
def organic(b):
    for s in (1, -1):
        b.prism("head", "box", 0.06, 0.035, 0.02, "black", (s * 0.085, 0.2, 0.15))


@slot_item("eyes", "cyber")
def cyber(b):
    """Organic left eye, cyber right eye in a gunmetal housing with a cyan lens."""
    b.prism("head", "box", 0.06, 0.035, 0.02, "black", (0.085, 0.2, 0.15))
    b.plate("head", 0.1, 0.1, 0.06, "gm", (-0.085, 0.2, 0.145), bevel=0.012)
    b.ball("head", 0.065, 0.065, 0.05, "cyan", (-0.085, 0.2, 0.17))


@slot_item("implant.temple", "neural_jack")
def neural_jack(b):
    b.plate("head", 0.045, 0.09, 0.09, "gmD", (0.158, 0.2, 0), bevel=0.01)
    b.box("head", 0.03, 0.04, 0.05, "magenta", (0.18, 0.2, 0))
    b.plate("head", 0.02, 0.14, 0.03, "gmD", (0.162, 0.1, -0.035), bevel=0.006)
    b.box("head", 0.02, 0.025, 0.03, "magenta", (0.168, 0.04, -0.035))
