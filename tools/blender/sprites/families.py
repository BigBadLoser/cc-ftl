"""Sprite families: each one renders into its own sheet(s) (see pack.py), so families rebuild independently.

  env       props, economy modules, items, combat fx and projectiles      (sheet env)
  walls     floors, walls, hull, doors (walls.LEVELS view levels)        (sheet walls)
  consoles  helm / weapons / shield consoles, 4 rotations, desk-front overlays for seated crew
  struct    structural beams (truss tiles by connection mask, caps, hull flanges), one set per faction look
  weapons   roof turrets (8 aims, charged, stowed, deploy frames) and their floor bays, 4 rotations
  roof      roof plating modules, edges, inset and patch plates, livery masks
  sol       Sol's engine, AI core and shield packs (rendered by their own scripts, see sol_pack.py)
Crew layers are built separately (`crew`)."""


def jobs(name):
    """(jobs, extra) for a family rendered through env_build.render_jobs; `extra` = palette selection."""
    if name == "env":
        from . import props, logistics, cfx
        from . import items as itemart
        fx = {s[0] for s in cfx.SPRITES}
        return props.SPRITES + logistics.SPRITES + itemart.SPRITES + cfx.SPRITES, lambda sid: sid in fx
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
    if name == "roof":
        from . import roofs
        return roofs.SPRITES, True
    raise KeyError(name)


RENDERED = ("env", "walls", "consoles", "weapons", "roof", "struct")
ALL = RENDERED + ("sol",)
