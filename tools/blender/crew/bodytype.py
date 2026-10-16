"""Body types. Only AVERAGE is built today.

Every builder reads its proportions from `current` (never from literals for widths), and parts are emitted in a
fixed order, so building the body and each clothing layer with another BodyType yields meshes with identical
topology. A shape-key pass can then build SLIM/BROAD/ATHLETIC variants, diff vertex positions against AVERAGE
and write the differences as shape keys (named after the body type) on the body and on every clothing layer.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class BodyType:
    name: str = "average"
    chest: float = 1.0     # torso / shoulder width multiplier
    hips: float = 1.0      # pelvis width multiplier
    limb: float = 1.0      # arm / leg girth multiplier
    belly: float = 1.0     # torso depth multiplier


AVERAGE = BodyType()
current = AVERAGE
