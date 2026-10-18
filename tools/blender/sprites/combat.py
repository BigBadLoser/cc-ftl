"""Registry of the M4 combat art: hull weapons and engine, shield gens, consoles, AI core, roofs and fx."""
from . import weapons, support, roofs, cfx

SPRITES = list(weapons.SPRITES) + list(support.SPRITES) + list(roofs.SPRITES) + list(cfx.SPRITES)
