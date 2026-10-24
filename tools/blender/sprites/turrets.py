"""Production weapon art (approved picks, turret_concepts.PICKS / turret_bays.BAYS): burst laser = S Sponson laser,
mass driver = H Halo driver, point defence = R Revolver rotary.

  turret.<stem>.d<0..7>          deployed turret at aim d (clockwise from grid +x, like WeaponC.aim); accents dark
  turret.<stem>.d<n>.charged     accents lit (weapons only; point defence has no charge)
  turret.<stem>.stowed           closed roof hatch with the fixed coaming
  turret.<stem>.deploy.f<0..4>   hatch opening, turret rising, gun levelling (aim d0)
  module.<stem>.bay.r<0..3>      the floor bay (sim rotation, clockwise), anchored like every module
Turrets are modelled on the roof top (turret_concepts.ZR = walls.hull_top()) around the bay centre, so their anchor is
the bay centre at floor level: the renderer adds no roof lift for them. Bays are anchored at the front-most tile."""
from mathutils import Matrix

import os

from . import core
from . import turret_bays as TB
from . import turret_concepts as TC
from . import turret_mil  # noqa: F401  (registers the missile launcher, ion cannon and incendiary launcher)
from . import turret_bay_laser  # noqa: F401  (the burst laser bay)
from . import turret_bay_pd  # noqa: F401  (the point defence bay)
from . import turret_bay_ion  # noqa: F401  (the ion cannon bay)
from . import turret_bay_incendiary  # noqa: F401  (the incendiary launcher bay)
from . import turret_bay_missile  # noqa: F401  (the missile launcher bay)
from . import turret_bay_driver  # noqa: F401  (the mass driver bay)

# stem -> (bay key, turret builder, race radius in rig units, footprint side)
PICKS = {"burst_laser": ("laser", 0.62, 2), "mass_driver": ("driver", 0.92, 3), "point_defense": ("pd", 0.64, 2),
         "missile_launcher": ("missile", 0.92, 3), "ion_cannon": ("ion", 0.64, 2),
         "incendiary_launcher": ("incendiary", 0.64, 2)}
DESIGN = {"laser": ("S", "laser"), "driver": ("H", "driver"), "pd": ("R", "laser"), "missile": ("M", "missile"),
          "ion": ("M", "ion"), "incendiary": ("M", "incendiary")}
# Look iteration only, never for commits: WEAPONS_ONLY=stem,stem limits the stems; WEAPONS_QUICK=1 renders just the
# preview set (aims 1, 3, 6, aim 1 charged, stowed, bay r0).
ONLY = [s for s in os.environ.get("WEAPONS_ONLY", "").split(",") if s]
QUICK = bool(os.environ.get("WEAPONS_QUICK"))


def _shift(objs, n):
    """Move a model centred on its n x n footprint so the front-most tile centre is the origin."""
    d = (n - 1) / 2
    for ob in objs:
        ob.matrix_world = Matrix.Translation(core.G(-d, -d, 0)) @ ob.matrix_world
    return objs


def turret(key, hot, d):
    return TC.place(TC.PICKS[key](hot), d)


SPRITES = []
for _stem, (_key, _r, _n) in PICKS.items():
    if ONLY and _stem not in ONLY:
        continue
    _fp = (_n, _n)
    for _d in ((1, 3, 6) if QUICK else range(8)):
        SPRITES.append((f"turret.{_stem}.d{_d}", _fp, "prop", lambda k=_key, d=_d: turret(k, False, d)))
        if _key != "pd" and (not QUICK or _d == 1):
            SPRITES.append((f"turret.{_stem}.d{_d}.charged", _fp, "prop", lambda k=_key, d=_d: turret(k, True, d)))
    _des, _kind = DESIGN[_key]
    SPRITES.append((f"turret.{_stem}.stowed", _fp, "prop", lambda a=_des, b=_kind, r=_r: TB.deploy(a, -1, b, r)))
    for _f in (() if QUICK else range(5)):
        SPRITES.append((f"turret.{_stem}.deploy.f{_f}", _fp, "prop", lambda a=_des, b=_kind, r=_r, f=_f: TB.deploy(a, f, b, r)))
    for _rot in ((0,) if QUICK else range(4)):
        SPRITES.append((f"module.{_stem}.bay.r{_rot}", _fp, "prop", lambda k=_key, rot=_rot, n=_n: _shift(TB.BAYS[k](rot), n)))
