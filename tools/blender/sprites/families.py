"""Sprite families: each one renders into its own sheet(s) (see pack.py), so families rebuild independently.

  env       props, economy modules, items, the particle sprites            (sheet env)
  walls     floors, walls, hull, doors (walls.LEVELS view levels)        (sheet walls)
  consoles  helm / weapons / shield consoles, 4 rotations, desk-front overlays for seated crew
  struct    structural beams (truss tiles by connection mask, caps, hull flanges), one set per faction look
  weapons   roof turrets (8 aims, charged, stowed, deploy frames) and their floor bays, 4 rotations
  airlock   the airlock: outer bulkhead + door, inner door, chamber walls per view level, cycle lights, docking collar
  roof      roof plating modules, edges, inset and patch plates, livery masks, cut plates (roof_cuts.py)
  vehicle_bay the shuttle bay (pit, doors, gangway, claws) and the shuttle parked in it, 4 rotations (vehicle_bay.py)
  shuttle   the flying shuttle: 8 fly headings and 4 docked poses (vehicle_bay.py craft_jobs)
  robot_bay the robot bay: 4 rotations x states (empty, charging, charging.drone, assembling.<robot type>)
  fx        combat fx v2 (fx3d.py): bolts, muzzle flashes, impacts, explosions as lit 3D clusters
  structure faction looks of the wall, hull and floor tiles: navy, drone, civil v1..v4, scrap p1..p4 (structure.py)
  galley    the food pack: galley (food printer), rations, mess table and chair (galley.py, mess.py)
  derelict  derelict dressing: breached walls, scorch, debris, dead lights, infestation, AI scrap (derelict*.py)
  damage    .damaged / .destroyed of the modules (damage.py: a pass over each module's own idle build)
  eggsac    the alien egg sacs, 1x1 and 2x2, every damage / hatch state (derelict_sac.py)
  storage_set lockers, racks, pallets, containers, tanks, cold stores, armories: 3 fills x 4 rotations (storage_set.py;
            MODPACK_ROTS=1 renders r0 only, for quick previews)
  sol       Sol's engine, AI core and shield packs (rendered by their own scripts, see sol_pack.py)
Crew layers are built separately (`crew`)."""


def jobs(name):
    """(jobs, extra) for a family rendered through env_build.render_jobs; `extra` = palette selection."""
    if name == "env":
        from . import props, logistics
        from . import items as itemart
        props_ = [s for s in props.SPRITES if not s[0].startswith("fx.fire.")]    # combat fx and tile fire: family fx
        return props_ + logistics.SPRITES + itemart.SPRITES, False
    if name == "walls":
        from . import envtiles
        return envtiles.SPRITES, lambda sid: not sid.startswith("tile.floor")
    if name == "consoles":
        from . import consoles
        return consoles.jobs(), True
    if name == "struct":
        from . import struct
        return struct.jobs(), True
    if name == "weapons":
        from . import turrets
        return turrets.SPRITES, True
    if name == "robot_bay":
        from . import robot_bay
        return robot_bay.jobs(), True
    if name == "vehicle_bay":
        from . import vehicle_bay
        return vehicle_bay.jobs(), True
    if name == "airlock":
        from . import airlock
        return airlock.jobs(), True
    if name == "shuttle":
        from . import vehicle_bay
        return vehicle_bay.craft_jobs(), True
    if name == "fx":
        from . import fx3d
        return fx3d.SPRITES, True
    if name == "structure":
        from . import structure
        return structure.jobs(), True
    if name == "galley":
        from . import galley, mess
        return galley.SPRITES + mess.SPRITES, True
    if name == "storage_set":
        import os
        from . import storage_set
        return storage_set.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "damage":
        import os
        from . import damage
        return damage.jobs(range(int(os.environ.get("MODPACK_ROTS", 4))))
    if name == "eggsac":
        from . import derelict_sac
        return derelict_sac.SPRITES, True
    if name == "derelict":
        from . import derelict
        return derelict.SPRITES, True
    if name == "roof":
        from . import roofs, roof_cuts
        return roofs.SPRITES + roof_cuts.SPRITES, True
    raise KeyError(name)


RENDERED = ("env", "walls", "consoles", "weapons", "roof", "robot_bay", "vehicle_bay", "shuttle", "airlock", "struct",
            "structure", "galley", "derelict", "eggsac")
ALL = RENDERED + ("sol",)
