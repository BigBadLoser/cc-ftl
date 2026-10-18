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

from . import core
from . import turret_bays as TB
from . import turret_concepts as TC

# stem -> (bay key, turret builder, race radius in rig units, footprint side)
PICKS = {"burst_laser": ("laser", 0.62, 2), "mass_driver": ("driver", 0.92, 3), "point_defense": ("pd", 0.64, 2)}
DESIGN = {"laser": ("S", "laser"), "driver": ("H", "driver"), "pd": ("R", "laser")}


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
    _fp = (_n, _n)
    for _d in range(8):
        SPRITES.append((f"turret.{_stem}.d{_d}", _fp, "prop", lambda k=_key, d=_d: turret(k, False, d)))
        if _key != "pd":
            SPRITES.append((f"turret.{_stem}.d{_d}.charged", _fp, "prop", lambda k=_key, d=_d: turret(k, True, d)))
    _des, _kind = DESIGN[_key]
    SPRITES.append((f"turret.{_stem}.stowed", _fp, "prop", lambda a=_des, b=_kind, r=_r: TB.deploy(a, -1, b, r)))
    for _f in range(5):
        SPRITES.append((f"turret.{_stem}.deploy.f{_f}", _fp, "prop", lambda a=_des, b=_kind, r=_r, f=_f: TB.deploy(a, f, b, r)))
    for _rot in range(4):
        SPRITES.append((f"module.{_stem}.bay.r{_rot}", _fp, "prop", lambda k=_key, rot=_rot, n=_n: _shift(TB.BAYS[k](rot), n)))
