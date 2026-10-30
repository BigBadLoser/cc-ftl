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
  containers  cargo containers 2x4 / 3x6: shells per rotation and door end, variants, damaged / destroyed / patched,
            paint overlays, livery masks, company logos, clamps (containers.py; CONT_SIZES / CONT_ROTS / CONT_STATES / CONT_VARIANTS narrow it)
  structure faction looks of the wall, hull and floor tiles: navy, drone, civil v1..v4, scrap p1..p4 (structure.py)
  galley    the food pack: galley (food printer), rations, mess table and chair (galley.py, mess.py)
  derelict  derelict dressing: breached walls, scorch, debris, dead lights, infestation, AI scrap (derelict*.py)
  damage    .damaged / .destroyed of the modules (damage.py: a pass over each module's own idle build)
  damage_sol  the same for Sol's packs (engine, AI core, shield generators), in a Blender job per pack (sol_damage.py)
  decay     more derelict dressing: fallen ceiling, glass, parts; frost, blood, oil, scratch decals (derelict_more.py)
  corpse    dead crew lying on the deck, 2 poses x 4 rotations, from the real crew rig (corpse.py)
  eggsac    the alien egg sacs, 1x1 and 2x2, every damage / hatch state (derelict_sac.py)
  storage_set lockers, racks, pallets, containers, tanks, cold stores, armories: 3 fills x 4 rotations (storage_set.py;
            MODPACK_ROTS=1 renders r0 only, for quick previews)
  medbay    the med bed and the med console, idle and .active (medbay.py; MODPACK_ROTS as storage_set)
  battery   the battery bank, .charge0 .. .charge3 (battery.py; MODPACK_ROTS as storage_set)
  hydroponics  the hydroponics bay, .grow0 .. .grow3, each also .active (hydroponics.py; MODPACK_ROTS as storage_set)
  workbench the workbench, idle and .active (workbench.py; MODPACK_ROTS as storage_set)
  storage_ore   ore storage: the hydraulic tip bin, 2x2 and 3x2, 4 rotations, empty and iron / ice / rare fills (tip_bin.py)
  ops_consoles  comms and sensor consoles, seated 2x2, with desk-front overlays (console_ops.py; MODPACK_ROTS as above)
  wallprops pieces on a wall run's face: pipes, cable tray, conduit, vents, panels, signs, a terminal (wallprops.py)
  hazards   looping hazards (.f0 .. .f3): sparking cables (wall and floor), a steam leak, an emergency beacon (hazards.py)
  clutter   floor clutter props: barrels, crates, potted plants, a toppled chair, a tool cart (clutter.py)
  cryo      the cryo pod, idle / .active (frozen, occupied) / .empty (open) (cryo.py; MODPACK_ROTS as above)
  sol       Sol's engine, AI core and shield packs (rendered by their own scripts, see sol_pack.py)
  rock      asteroid rock: rock mass by neighbour mask, levelled ground with its worn edge and under-lip, ore tiles (rock.py)
  rockwall  finished rock walls: dressed stone, the metal wall set mirrored piece for piece (rockwall.py)
  pod_bay   the mining pod's 3x3 bay (pit, iris, clamp arms) and the pod parked in it, 4 rotations (pod_family.py)
  mining_pod the mining pod: 8 fly headings, 8 mining headings x 2 frames, 4 docked poses (pod_family.py craft_jobs)
  fx_mining the mining laser's beam segment, its hit on the rock, rock chips, the dust of a tile mined out (fx_mining.py)
  starmap   the starmap's pictures: sector bodies, structure icons, fleet icons (8 headings), a backdrop tile (starmap.py)
  cargo     a delivery job's sealed hard case: item.cargo_crate.l on the deck and .held (cargo.py)
  decor     station dressing: planters, a bench, deck marks (decor.py)
  landmarks court landmarks: the holo column, the big tree, the banner post and its livery masks (landmarks.py)
  court_floors  the floor finishes the station generator paints courts with: walk, soil, market, tread (floors.py COURT)
  lights    the lamps: tall mast, short cage lamp, floor grate, 4 rotations x lit / unpowered / damage states (lights.py)
  items     the item pack: .s/.m/.l floor stacks and .held for the items env (items.py) does not draw (items_now.py), and
            for planned items (items_tech.py, items_materials.py, items_parts.py, items_goods.py)
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
    if name == "containers":
        import os
        from . import containers
        sel = lambda var, d: tuple(os.environ[var].split(",")) if os.environ.get(var) else d  # noqa: E731
        containers.LOGOS = os.environ.get("CONT_LOGOS", "1") == "1"
        sizes, rots = sel("CONT_SIZES", tuple(containers.SIZES)), tuple(int(r) for r in sel("CONT_ROTS", ("0", "1")))
        jobs = containers.jobs(sizes=sizes, rots=rots,
                               states=tuple("" if s == "intact" else s for s in
                                            sel("CONT_STATES", ("intact", "damaged", "destroyed", "patched"))),
                               variants=tuple(int(v) for v in sel("CONT_VARIANTS", ("0", "1", "2"))))
        return jobs, True
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
    if name == "medbay":
        import os
        from . import medbay
        return medbay.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "battery":
        import os
        from . import battery
        return battery.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "hydroponics":
        import os
        from . import hydroponics
        return hydroponics.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "workbench":
        import os
        from . import workbench
        return workbench.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "ops_consoles":
        import os
        from . import consoles
        return consoles.jobs(("comms", "sensor"), range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "cryo":
        import os
        from . import cryo
        return cryo.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), True
    if name == "wallprops":
        import os
        from . import wallprops
        fams = os.environ.get("WALLPROP_FAMS", "wall,hull").split(",")
        return [j for j in wallprops.SPRITES if j[0].split(".")[-2] in fams], True
    if name == "hazards":
        import os
        from . import hazards
        fams = os.environ.get("WALLPROP_FAMS", "wall,hull").split(",")
        return [j for j in hazards.SPRITES if not j[0].startswith("wallprop.") or j[0].split(".")[-3] in fams
                or j[0].split(".")[-2] in fams], True
    if name == "clutter":
        from . import clutter
        return clutter.SPRITES, True
    if name == "damage":
        import os
        from . import damage
        return damage.jobs(range(int(os.environ.get("MODPACK_ROTS", 4))))
    if name == "corpse":
        from . import corpse
        return corpse.SPRITES, True
    if name == "eggsac":
        from . import derelict_sac
        return derelict_sac.SPRITES, True
    if name == "derelict":
        from . import derelict
        return derelict.SPRITES, True
    if name == "decay":
        from . import derelict_more
        return derelict_more.SPRITES, True
    if name == "roof":
        from . import roofs, roof_cuts
        return roofs.SPRITES + roof_cuts.SPRITES, True
    if name == "rock":
        from . import rock
        return rock.jobs(), True
    if name == "rockwall":
        from . import rockwall
        return rockwall.jobs(), True
    if name == "pod_bay":
        from . import pod_family
        return pod_family.jobs(), True
    if name == "mining_pod":
        from . import pod_family
        return pod_family.craft_jobs(), True
    if name == "fx_mining":
        from . import fx_mining
        return fx_mining.SPRITES, True
    if name == "starmap":
        from . import starmap
        return starmap.jobs(), True
    if name == "cargo":
        from . import cargo
        return cargo.SPRITES, True
    if name == "items":
        from . import items_goods, items_materials, items_now, items_parts, items_tech
        from .items_kit import jobs as item_jobs
        planned = {**items_tech.ITEMS, **items_materials.ITEMS, **items_parts.ITEMS, **items_goods.ITEMS}
        return items_now.SPRITES + [j for k, fn in planned.items() for j in item_jobs(k, fn)], True
    if name == "lamp_concepts":
        from . import lamp_concepts
        return lamp_concepts.SPRITES, True
    if name == "court_floors":
        from . import floors
        return floors.SPRITES, False
    if name == "decor":
        from . import decor
        return decor.SPRITES, True
    if name == "landmarks":
        from . import landmarks
        return landmarks.SPRITES, True
    if name == "lights":
        from . import lights
        return lights.SPRITES, True
    if name == "storage_ore":
        from . import tip_bin
        return tip_bin.jobs(), True
    raise KeyError(name)


# `structure` is preview-only (no full build yet): build it by name, it is not part of `all`.
RENDERED = ("env", "walls", "consoles", "weapons", "roof", "robot_bay", "vehicle_bay", "shuttle", "airlock", "struct",
            "fx", "galley", "derelict", "eggsac", "storage_set", "medbay", "battery", "hydroponics", "workbench",
            "ops_consoles", "cryo", "wallprops", "hazards", "clutter", "decay", "corpse", "damage", "rock", "rockwall",
            "pod_bay", "mining_pod", "fx_mining", "starmap", "cargo", "items", "storage_ore", "decor",
            "lights", "court_floors", "landmarks")
ALL = RENDERED + ("sol", "damage_sol")
