"""Asteroid rock sprites (family `rock`). Ids:

  rock.mass.m<mask>[.c<cuts>].v<0-3>            rock mass by rock neighbours; cuts = SE1 SW2 NE4 open diagonals
  rock.ground.m<mask>[.c<cuts>].v<n>            levelled ground and its under-lip by solid neighbours (rock or ground);
                                                cuts = SE1 SW2 NE4 NW8; the interior (m15) has 8 variants, edges 3
  rock.ground.m<mask>[.c<cuts>].under           the plain ground under a rock tile (no craters, a shallow worn edge)
  rock.ore.<iron|ice|rare>.<rich|thin>.m<mask>[.c<cuts>]   rock tiles with ore veins, one variant each

The rock roof over a dug base reuses the rock mass tops. Modules: rock_base (frame, noise, strata), rock_crater,
rock_mass, rock_ore, rock_ground."""
from .rock_base import GROUND_CORNERS, MASS_CORNERS, Canvas, valid_corners
from .rock_ground import GroundTile, ground
from .rock_mass import MassTile, mass
from .rock_ore import Ore


def combos(mask, bits):
    v = valid_corners(mask, bits)
    return [sum(b for i, b in enumerate(v) if s >> i & 1) for s in range(1 << len(v))]


def _sid(base, mask, c):
    return f"{base}.m{mask}" + (f".c{c}" if c else "")


def _job(sid, draw):
    def build():
        k = Canvas(sid)
        draw(k)
        return k.build()
    return (sid, (1, 1), "block", build)


def jobs():
    out = []
    for mask in range(16):
        for c in combos(mask, MASS_CORNERS):
            for v in range(4):
                out.append(_job(_sid("rock.mass", mask, c) + f".v{v}",
                                lambda k, mask=mask, c=c, v=v: mass(k, MassTile(mask, v, c), 0, 0)))
            for kind in ("iron", "ice", "rare"):
                for rich in (True, False):
                    out.append(_job(_sid(f"rock.ore.{kind}.{'rich' if rich else 'thin'}", mask, c),
                                    lambda k, mask=mask, c=c, kind=kind, rich=rich: mass(
                                        k, MassTile(mask, 0, c, Ore(kind, rich)), 0, 0)))
        for c in combos(mask, GROUND_CORNERS):
            for v in range(8 if mask == 15 and c == 0 else 3):
                out.append(_job(_sid("rock.ground", mask, c) + f".v{v}",
                                lambda k, mask=mask, c=c, v=v: ground(k, GroundTile(v, mask, c), 0, 0)))
            out.append(_job(_sid("rock.ground", mask, c) + ".under",
                            lambda k, mask=mask, c=c: ground(k, GroundTile(0, mask, c, plain=True), 0, 0)))
    return out
