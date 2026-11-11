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
  drones    the drones (3 types x 8 headings: fly, work frames, inert, docked; the medic's beam, the shadow) and the
            drone bay (2x2, 4 rotations, .front overlays, roof hatch frames) (drone_family.py)
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
  arcade    arcade cabinet look study, preview only (arcade_study.py)
  gametable holo game table look study, preview only (gametable_study.py)
  bar       bar look study, preview only (bar_study.py)
  exercise  exercise machine look study, preview only (exercise_study.py)
  pod       recovery pod look study, preview only (pod_study.py 1x1, pod2_study.py 2x2 lying, pod3-6_study.py 2x2 upright)
  gametable_module  the holo game table module.gametable (2x1, study r1 + s4): idle, .unpowered, .active frames (hologram
            baked in), seated-crew front overlays, four rotations (gametable.py; MODPACK_ROTS as storage_set)
  arcade_cabinet  the arcade module.arcade (1x1, study j2): idle, .unpowered, .active frames (hologram baked in), four
            rotations (arcade.py; MODPACK_ROTS as storage_set)
  research_bench  the research bench module.research (3x2, c1), idle and .active (hologram baked in), four rotations (research_bench.py)
  medbay    the med bed and the med console, idle and .active (medbay.py; MODPACK_ROTS as storage_set)
  battery   the battery bank, .charge0 .. .charge3 (battery.py; MODPACK_ROTS as storage_set)
  hydroponics  the hydroponics beds (small and large), lit and .unpowered, and their crop layers (hydroponics.py; MODPACK_ROTS as storage_set)
  workbench the workbench, idle and .active (workbench.py; MODPACK_ROTS as storage_set)
  storage_ore   ore storage: the hydraulic tip bin, 2x2 and 3x2, 4 rotations, empty and iron / ice / rare fills (tip_bin.py)
  scrapper      the scrapper module: 4x2, 4 rotations; idle, unpowered, 4 active frames (scrapper.py)
  storage_scrap scrap storage: the barred cage full of salvage, 2x2 and 2x3, 4 rotations, 4 fills (ore_cage.py, scrap.py)
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
  escape_pod the escape pod: 8 fly headings, 8 adrift x 2 beacon frames, 4 docked poses, parked in a pod bay
             (escape_pod_family.py)
  fx_mining the mining laser's beam segment, its hit on the rock, rock chips, the dust of a tile mined out (fx_mining.py)
  fx_shield the shield dome's sprite pieces: hit flashes (shield, ion) and the mass-driver tear; the dome is a shader (fx_shield.py)
  starmap   the starmap's pictures: sector bodies, structure icons, fleet icons (8 headings), a backdrop tile (starmap.py)
  backdrop  the node's central body drawn large behind the main view: backdrop.body.<kind>.v<n>, 320 px frame (backdrop_bodies.py,
            backdrop_pulsar.py)
  cargo     a delivery job's sealed hard case: item.cargo_crate.l on the deck and .held (cargo.py)
  items     the item pack: .s/.m/.l floor stacks and .held for the items env (items.py) does not draw (items_now.py), and
            for planned items (items_tech.py, items_materials.py, items_parts.py, items_goods.py)
  salvage   the scrap crates of derelict salvage and cloth: .unit (the game stacks units on a slot grid) and .held
            (items_salvage.py)
  upgrades  the weapon upgrade parts: ten item.upg_* with .s/.m/.l floor stacks and .held (items_upgrades.py)
  hull      the hull from outside by hull key (run set, generic pieces, their roofs) and its belly in six bay looks,
            each piece with its tint mask (hulltiles.py)
  marks     the overhead crew icons: social cues, break symbols in their bubbles, fight marks; 2D, no render (crew_marks.py)
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
        return envtiles.SPRITES, lambda sid: False if sid.startswith("tile.floor") else "walls+hull"   # (palette sets
        #   "walls" and "hull": the relief walls', hull's, doors' and faction looks' colours, no other family's)
    if name == "consoles":
        from . import consoles
        return consoles.jobs(), True
    if name == "struct":
        from . import struct
        return struct.jobs(), True
    if name == "weapons":
        from . import turrets
        return turrets.SPRITES, True
    if name == "drones":
        from . import drone_family
        return drone_family.jobs(), True
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
        return structure.jobs(), "walls+hull"
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
        return hydroponics.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), "hydro"
    if name == "arcade":        # look study, preview only (not in RENDERED): arcade cabinet blockouts, r0
        from . import arcade_study
        return arcade_study.jobs(), "arcade"
    if name == "gametable":     # look study, preview only (not in RENDERED): holo game table designs, r0
        from . import gametable_study
        return gametable_study.jobs(), "arcade"
    if name == "bar":           # look study, preview only (not in RENDERED): bar designs, r0
        from . import bar_study
        return bar_study.jobs(), "arcade"
    if name == "exercise":      # look study, preview only (not in RENDERED): exercise machine designs, r0
        from . import exercise_study
        return exercise_study.jobs(), "arcade"
    if name == "pod":           # look study, preview only (not in RENDERED): recovery pod designs, r0
        from . import pod2_study, pod3_study, pod4_study, pod5_study, pod6_study, pod_study
        return (pod_study.jobs() + pod2_study.jobs() + pod3_study.jobs() + pod4_study.jobs() + pod5_study.jobs()
                + pod6_study.jobs(), "arcade")
    if name == "gametable_module":
        import os
        from . import gametable
        return gametable.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), "arcade"
    if name == "arcade_cabinet":
        import os
        from . import arcade
        return arcade.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), "arcade"
    if name == "research":      # look study, preview only (not in RENDERED): three bench designs, r0 .on
        from . import research
        return research.jobs(), "research"
    if name == "research_bench":
        import os
        from . import research_bench
        return research_bench.jobs(range(int(os.environ.get("MODPACK_ROTS", 4)))), "research"
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
        return derelict.SPRITES, lambda sid: "walls+hull" if sid.startswith("tile.") else True   # (breached walls)
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
    if name == "escape_pod":
        from . import escape_pod_family
        return escape_pod_family.jobs(), True
    if name == "fx_mining":
        from . import fx_mining
        return fx_mining.SPRITES, True
    if name == "fx_shield":
        from . import fx_shield
        return fx_shield.SPRITES, True
    if name == "starmap":
        from . import starmap
        return starmap.jobs(), True
    if name == "backdrop":
        from . import backdrop_bodies
        return backdrop_bodies.jobs(), True
    if name == "cargo":
        from . import cargo
        return cargo.SPRITES, True
    if name == "items":
        from . import items_goods, items_materials, items_now, items_parts, items_tech
        from .items_kit import jobs as item_jobs
        planned = {**items_tech.ITEMS, **items_materials.ITEMS, **items_parts.ITEMS, **items_goods.ITEMS}
        return items_now.SPRITES + [j for k, fn in planned.items() for j in item_jobs(k, fn)], True
    if name == "salvage":
        from . import items_salvage
        return items_salvage.jobs(), items_salvage.palette
    if name == "upgrades":
        from . import items_upgrades
        return items_upgrades.jobs(), items_upgrades.PALETTE
    if name == "storage_ore":
        from . import tip_bin
        return tip_bin.jobs(), True
    if name == "scrapper":      # the scrapper module (scrapper.py): its own palette set
        from . import scrapper
        return scrapper.jobs(), "scrapper"
    if name == "storage_scrap":
        from . import scrap
        return scrap.jobs(), True
    if name == "hull":
        from . import hulltiles
        return hulltiles.jobs(), "hull"                 # (its own palette set: palette_extra "set": "hull")
    raise KeyError(name)


# `structure` is preview-only (no full build yet): build it by name, it is not part of `all`.
RENDERED = ("env", "walls", "consoles", "weapons", "roof", "robot_bay", "drones", "vehicle_bay", "shuttle", "airlock", "struct",
            "fx", "galley", "derelict", "eggsac", "storage_set", "medbay", "battery", "hydroponics", "workbench",
            "ops_consoles", "cryo", "wallprops", "hazards", "clutter", "decay", "corpse", "damage", "rock", "rockwall",
            "pod_bay", "mining_pod", "escape_pod", "fx_mining", "fx_shield", "starmap", "backdrop", "cargo", "items", "salvage", "storage_ore",
            "hull", "scrapper", "upgrades", "research_bench")
ALL = RENDERED + ("sol", "damage_sol", "marks")
