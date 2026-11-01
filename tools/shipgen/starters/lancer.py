"""Lancer variants, round 4: new concepts only (#241). Run: python3 tools/shipgen/starters/lancer.py"""
import math
from common import *  # noqa: F401,F403

CREW = ['role.gunner', 'role.gunner', 'role.pilot', 'role.engineer']
HOLD = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 60}, {'item': 'item.ice', 'count': 10}, {'item': 'item.missile', 'count': 16}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]


def stores(s, pts):
    for (x, y), st in zip(pts, HOLD): s.m('storage', x, y, 0, stock=st)


def twin_boom():
    s = Ship('TWIN BOOM', 34, 27, CREW, 'two long gun booms (a laser forward, an engine aft in each) joined by a central command pod with the missile')
    s.room(3, 2, 31, 7); s.room(3, 19, 31, 24); s.room(10, 7, 24, 19)
    vline(s, 17, 7, 19)
    for d in [(16, 7), (23, 7), (13, 19), (21, 19), (17, 13)]: s.door(*d)
    s.section('North boom: a laser in the nose, four bunks, life support, an engine in the tail')
    s.m('burstLaser', 4, 3); s.m('lifeSupport', 7, 3)
    for x in (9, 10, 15, 16): s.m('bed', x, 3)
    s.m('engine', 27, 3, 1)
    s.lights((4, 6), (8, 6), (13, 4), (18, 5), (23, 4), (26, 6))
    s.section('South boom: a laser in the nose, galley and mess, life support, an engine in the tail')
    s.m('burstLaser', 4, 22); s.m('galley', 8, 20, **GALLEY); s.m('mess_table', 11, 22); s.m('chair', 11, 21, 2); s.m('chair', 12, 21, 2)
    s.m('lifeSupport', 16, 20); s.m('airlock', 18, 21, 2); s.m('engine', 27, 20, 1)
    s.lights((4, 20), (9, 23), (14, 22), (22, 21), (26, 23))
    s.section('Pod (fore): the missile launcher, helm, gun and shield consoles')
    s.m('missileLauncher', 11, 12); s.m('helm', 13, 8); s.m('weaponsConsole', 14, 12); s.m('weaponsConsole', 15, 15); s.m('shieldConsole', 11, 16)
    s.lights((11, 10), (16, 11), (16, 17), (11, 15))
    s.section('Pod (aft): reactors, the Mk II shield, the hold')
    s.m('reactor', 18, 8); s.m('reactor', 20, 8); s.m('reactor', 18, 16); s.m('shieldGen.mk2', 22, 13)
    stores(s, [(19, 10), (20, 10), (21, 10)])
    s.lights((23, 11), (18, 12), (23, 17), (20, 15))
    return s


def monitor():
    s = Ship('MONITOR', 31, 27, CREW, 'a squat armoured block with chamfered corners and a gun battery bulging from the bow')
    cols = []
    for x in range(4, 30):
        c = max(0, 7 - (x - 4)) if x < 11 else max(0, x - 26)
        cols.append((x, 3 + c, 23 - c))
    cols += [(x, 8, 18) for x in range(1, 5)]
    hull(s, cols)
    vline(s, 8, 0, 26); vline(s, 17, 0, 26); vline(s, 23, 0, 26); hline(s, 8, 17, 13); hline(s, 17, 23, 9); hline(s, 17, 23, 17)
    for d in [(8, 10), (8, 16), (12, 13), (17, 11), (17, 15), (20, 9), (20, 17), (23, 13)]: s.door(*d)
    s.section('Battery (the bow bulge): the missile launcher between two lasers')
    s.m('burstLaser', 2, 9); s.m('missileLauncher', 2, 12); s.m('burstLaser', 2, 16)
    s.lights((5, 10), (5, 16), (6, 13))
    s.section('Gun deck (north): both gun consoles and the helm; shield deck (south): shield console, the Mk II shield')
    s.m('helm', 10, 9); s.m('weaponsConsole', 11, 5); s.m('weaponsConsole', 14, 5)
    s.m('shieldConsole', 10, 15); s.m('shieldGen.mk2', 14, 17); s.m('lifeSupport', 9, 18)
    s.lights((15, 8), (12, 11), (15, 15), (11, 19), (16, 11))
    s.section('Crew (centre): bunks and the dorsal airlock north, galley south, the hold between')
    for x, y in ((21, 5), (22, 5), (21, 7), (22, 7)): s.m('bed', x, y)
    s.m('airlock', 18, 3)
    s.m('galley', 18, 18, **GALLEY); s.m('mess_table', 20, 20); s.m('chair', 20, 19, 2); s.m('chair', 21, 19, 2)
    stores(s, [(20, 11), (21, 11), (22, 11)])
    s.m('lifeSupport', 22, 14)
    s.lights((20, 8), (20, 13), (18, 16), (22, 21))
    s.section('Engine room: two engines, three reactors, the airlock')
    s.m('engine', 25, 7, 1); s.m('engine', 25, 16, 1); s.m('reactor', 25, 12); s.m('reactor', 27, 12); s.m('reactor', 27, 14)
    s.m('airlock', 24, 23, 2) if False else None
    s.lights((24, 6), (24, 11), (26, 15), (24, 20), (27, 6))
    return s



def sword():
    s = Ship('SWORD', 40, 23, CREW, 'a long blade with the missile in its point, a crossguard with a laser at each end, engines in the pommel')
    cols = [(2, 9, 13), (3, 9, 13)] + [(x, 8, 14) for x in range(4, 26)]
    cols += [(x, 1, 21) for x in range(25, 30)] + [(x, 8, 14) for x in range(29, 35)] + [(x, 5, 17) for x in range(34, 40)]
    hull(s, cols)
    vline(s, 14, 8, 14); vline(s, 25, 8, 14); vline(s, 29, 8, 14); vline(s, 34, 8, 14)
    for d in [(14, 11), (25, 11), (29, 11), (34, 11)]: s.door(*d)
    s.section('Blade (point to hilt): the missile launcher, both gun consoles, helm and shield console')
    s.m('missileLauncher', 3, 10); s.m('weaponsConsole', 7, 9); s.m('weaponsConsole', 7, 12); s.m('helm', 10, 9); s.m('shieldConsole', 10, 12)
    s.lights((6, 11), (9, 11), (13, 11))
    s.section('Blade (crew end): bunks, galley, stores, life support')
    for x in (15, 16, 18, 19): s.m('bed', x, 9)
    s.m('galley', 15, 12, **GALLEY); s.m('lifeSupport', 21, 9)
    stores(s, [(18, 12), (19, 12), (20, 12)])
    s.lights((17, 11), (22, 11), (24, 13), (23, 9))
    s.section('Crossguard: a laser at each tip, reactors, the Mk II shield, life support')
    s.m('burstLaser', 26, 2); s.m('burstLaser', 26, 19); s.m('reactor', 26, 5); s.m('reactor', 26, 15); s.m('shieldGen.mk2', 27, 8)
    s.m('lifeSupport', 26, 12)
    s.lights((28, 4), (28, 17), (26, 8), (28, 13), (26, 18), (28, 2) if False else (26, 4))
    s.section('Grip: the airlock; pommel: two engines and a reactor')
    s.m('airlock', 30, 8); s.m('engine', 35, 6, 1); s.m('engine', 35, 13, 1); s.m('reactor', 37, 10)
    s.lights((33, 13), (30, 13), (35, 11), (36, 12))
    return s


def manta():
    s = Ship('MANTA', 27, 27, CREW, 'a broad rounded ray: the missile in its mouth, lasers along the leading edge, engines on the straight trailing edge')
    cols = []
    for x in range(1, 27):
        h = 3 + int(round(8 * math.sqrt(max(0.0, 1 - ((x - 16) / 15.5) ** 2)))) if x <= 16 else 11
        cols.append((x, 13 - h, 13 + h))
    hull(s, cols)
    vline(s, 9, 0, 26); vline(s, 18, 0, 26); hline(s, 9, 18, 8); hline(s, 9, 18, 18)
    for d in [(9, 13), (18, 13), (15, 8), (13, 18), (18, 5), (18, 21)]: s.door(*d)
    s.section('Mouth: the missile launcher, both gun consoles')
    s.m('missileLauncher', 2, 12); s.m('weaponsConsole', 6, 9); s.m('weaponsConsole', 6, 15)
    s.lights((5, 12), (8, 12), (8, 17), (5, 16), (5, 9))
    s.section('Wing roots: a laser on each leading edge, bunks north, galley south')
    s.m('burstLaser', 10, 4); s.m('burstLaser', 10, 21)
    for x in (13, 14, 16, 17): s.m('bed', x, 4)
    s.m('galley', 13, 21, **GALLEY); s.m('mess_table', 15, 22) if False else None
    s.lights((12, 7), (17, 7), (12, 19), (17, 22), (15, 3))
    s.section('Centre: helm, shield console, the hold, life support')
    s.m('helm', 11, 9); s.m('shieldConsole', 11, 15, 2); s.m('lifeSupport', 17, 10)
    stores(s, [(15, 11), (15, 15), (16, 15)])
    s.lights((10, 13), (14, 13), (17, 17))
    s.section('Trailing edge: an engine on each wing, reactors, the Mk II shield, life support, the airlock')
    s.m('engine', 22, 3, 1); s.m('engine', 22, 20, 1); s.m('airlock', 19, 2)
    s.m('reactor', 19, 9); s.m('reactor', 19, 16); s.m('reactor', 21, 12); s.m('shieldGen.mk2', 24, 11); s.m('lifeSupport', 24, 15)
    s.lights((20, 7), (20, 20), (24, 8), (24, 18), (21, 15), (19, 12))
    return s


def wasp():
    s = Ship('WASP', 35, 25, CREW, 'three segments on thin waists: a gun head, a crew thorax, an engine abdomen')
    cols = []
    for x in range(1, 11): cols.append((x, 12 - max(2, int(round(math.sqrt(max(0, 30 - (x - 6) ** 2))))), 12 + max(2, int(round(math.sqrt(max(0, 30 - (x - 6) ** 2)))))))
    cols += [(x, 10, 14) for x in range(10, 14)]
    for x in range(13, 26): cols.append((x, 12 - max(2, min(8, int(round(10 * math.sqrt(max(0, 1 - ((x - 19) / 6.6) ** 2)))))), 12 + max(2, min(8, int(round(10 * math.sqrt(max(0, 1 - ((x - 19) / 6.6) ** 2))))))))
    cols += [(x, 10, 14) for x in range(25, 28)]
    cols += [(x, 4 + max(0, 29 - x), 20 - max(0, 29 - x)) for x in range(27, 35)]
    hull(s, cols)
    for d in [(11, 12), (26, 12)]: s.door(*d)
    s.section('Head: the missile launcher between two lasers, both gun consoles')
    s.m('missileLauncher', 2, 11); s.m('burstLaser', 4, 8); s.m('burstLaser', 4, 15); s.m('weaponsConsole', 7, 9); s.m('weaponsConsole', 7, 13)
    s.lights((6, 12), (9, 12), (3, 10))
    s.section('Thorax: helm, shield console, bunks, galley, the Mk II shield, life support, airlock')
    s.m('helm', 16, 9); s.m('shieldConsole', 16, 14, 2)
    for x in (17, 18, 20, 21): s.m('bed', x, 5)
    s.m('galley', 16, 17, **GALLEY); s.m('lifeSupport', 14, 11); s.m('shieldGen.mk2', 22, 10)
    s.m('airlock', 18, 17, 2)
    s.lights((15, 8), (19, 7), (19, 12), (15, 16), (22, 18), (22, 7), (22, 16), (24, 12))
    s.section('Abdomen: two engines, reactors, the hold, life support')
    s.m('engine', 30, 5, 1); s.m('engine', 30, 16, 1); s.m('reactor', 28, 10); s.m('reactor', 30, 10); s.m('reactor', 30, 12) if False else None
    stores(s, [(28, 13), (29, 13), (30, 13)]); s.m('lifeSupport', 32, 12)
    s.lights((29, 9), (33, 10), (28, 15), (32, 15))
    return s


VARIANTS = [lambda: tagged(twin_boom(), 'new'), lambda: tagged(monitor(), 'new'), lambda: tagged(sword(), 'new'), lambda: tagged(manta(), 'new'), lambda: tagged(wasp(), 'new')]

if __name__ == '__main__':
    write('lancer', [v() for v in VARIANTS], 'Lancer variants, round 4: new concepts only')
