"""Wayfarer variants, round 4: new concepts only, no containers (#241). Run: python3 tools/shipgen/starters/wayfarer.py"""
import math
from common import *  # noqa: F401,F403

CREW = ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']
STOCK = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]


def stores(s, pts, rot=0):
    for (x, y), st in zip(pts, STOCK): s.m('storage', x, y, rot, stock=st)


def homestead():
    s = Ship('HOMESTEAD', 25, 28, CREW, 'short and wide like a house: a big living room in the middle with every room opening off it')
    cols = []
    for x in range(1, 25):
        c = max(0, 6 - x) if x < 6 else 0
        cols.append((x, 2 + c, 25 - c))
    hull(s, cols)
    vline(s, 8, 0, 27); vline(s, 17, 0, 27); hline(s, 8, 17, 9); hline(s, 8, 17, 18)
    for d in [(8, 13), (17, 17), (12, 9), (12, 18), (17, 6), (17, 21)]: s.door(*d)
    s.section('Bow porch: helm, gun and shield consoles, the burst laser')
    s.m('helm', 3, 8); s.m('weaponsConsole', 2, 12); s.m('shieldConsole', 3, 16, 2); s.m('burstLaser', 5, 12)
    s.lights((5, 6), (2, 11), (6, 15), (5, 21), (7, 11))
    s.section('Living room (centre): mess table, galley, hydroponics, lockers, life support')
    s.m('galley', 9, 10, **GALLEY); s.m('hydroponics', 13, 10); s.m('mess_table', 11, 14); s.m('chair', 11, 13, 2); s.m('chair', 12, 13, 2); s.m('chair', 11, 15); s.m('chair', 12, 15)
    s.m('storage_locker', 15, 10); s.m('lifeSupport', 16, 15)
    s.lights((9, 13), (15, 13), (12, 17))
    s.section('Bedrooms (north): four bunks, a med bed and the dorsal airlock')
    for x in (12, 13, 14, 15): s.m('bed', x, 3)
    s.m('med_bed', 16, 3); s.m('airlock', 9, 2)
    s.lights((11, 6), (15, 7), (9, 8))
    s.section('Workshop (south): fabricator, stores, shield, the airlock')
    s.m('fabricator', 9, 23); s.m('shieldGen', 14, 19); s.m('airlock', 11, 22, 2) if False else None
    stores(s, [(9, 19), (10, 19), (11, 19)])
    s.m('lifeSupport', 16, 22)
    s.lights((12, 21), (9, 21), (15, 24))
    s.section('Stern: the shuttle bay, engines far apart, reactors')
    s.m('vehicle_bay', 18, 11, vehicle='vehicle.shuttle'); s.m('engine', 20, 3, 1); s.m('engine', 20, 21, 1)
    s.m('reactor', 18, 7); s.m('reactor', 18, 18); s.m('airlock', 21, 7) if False else None
    s.lights((18, 9), (23, 9), (18, 16), (23, 17), (23, 13), (18, 24))
    return s



def freighter():
    s = Ship('AFT TOWER', 35, 24, CREW, 'a long low working deck forward, the crew living in a tall block over the stern like a freighter')
    s.room(1, 13, 34, 22); s.room(22, 2, 34, 13)
    vline(s, 10, 13, 22); vline(s, 22, 13, 22); hline(s, 22, 34, 7)
    for d in [(10, 17), (22, 17), (27, 13), (28, 7)]: s.door(*d)
    s.section('Bow deck: the burst laser in the nose, fabricator, stores')
    s.m('burstLaser', 2, 14); s.m('fabricator', 5, 14); s.m('lifeSupport', 9, 19)
    stores(s, [(2, 19), (3, 19), (4, 19)])
    s.lights((4, 17), (8, 15), (7, 21), (2, 21))
    s.section('Garden and hangar deck: hydroponics rows, the shuttle bay, shield')
    s.m('hydroponics', 11, 14); s.m('hydroponics', 13, 14); s.m('hydroponics', 11, 19); s.m('hydroponics', 13, 19)
    s.m('vehicle_bay', 16, 15, vehicle='vehicle.shuttle'); s.m('shieldGen', 6, 17)
    s.lights((15, 14), (20, 14), (15, 21), (21, 20), (13, 17))
    s.section('Engine room (under the tower): two engines, two reactors')
    s.m('engine', 30, 14, 1); s.m('engine', 30, 18, 1); s.m('reactor', 23, 14); s.m('reactor', 23, 19)
    s.lights((26, 16), (26, 20), (28, 14), (29, 21))
    s.section('Tower bridge (top): helm, gun and shield consoles, the airlock')
    s.m('airlock', 23, 2); s.m('helm', 26, 3); s.m('weaponsConsole', 29, 3); s.m('shieldConsole', 31, 3)
    s.lights((27, 6), (30, 6), (33, 6))
    s.section('Tower quarters: four bunks, a med bed, galley, mess table, life support')
    for x in (23, 24, 26, 27): s.m('bed', x, 8)
    s.m('med_bed', 33, 8); s.m('galley', 29, 8, **GALLEY); s.m('mess_table', 30, 11) if False else None
    s.m('lifeSupport', 31, 8)
    s.lights((25, 11), (29, 11), (33, 11))
    return s


def atrium():
    s = Ship('ATRIUM', 27, 23, CREW, 'a ring of rooms around an open courtyard: cockpit, lounge, bunks and hangar all face the middle')
    cols = []
    for x in range(1, 27):
        if 10 <= x <= 17: cols += [(x, 1, 8), (x, 15, 22)]
        else: cols.append((x, 1, 22))
    hull(s, cols)
    vline(s, 9, 0, 22); vline(s, 18, 0, 22)
    for d in [(9, 4), (9, 18), (18, 4), (18, 18)]: s.door(*d)
    s.section('West: the cockpit, the burst laser, the airlock')
    s.m('helm', 3, 9); s.m('weaponsConsole', 2, 13); s.m('shieldConsole', 5, 13, 2) if False else None
    s.m('shieldConsole', 4, 13); s.m('burstLaser', 2, 3); s.m('lifeSupport', 7, 2)
    s.lights((5, 6), (2, 11), (7, 11), (3, 17), (2, 20), (8, 20))
    s.section('North: the lounge, galley, hydroponics, mess table')
    s.m('galley', 10, 2, **GALLEY); s.m('hydroponics', 12, 2); s.m('hydroponics', 14, 2); s.m('mess_table', 12, 5); s.m('chair', 12, 4, 2); s.m('chair', 13, 4, 2)
    s.lights((10, 6), (16, 6), (16, 3))
    s.section('South: four bunks, a med bed, life support, stores')
    for x in (10, 11, 13, 14): s.m('bed', x, 19)
    s.m('med_bed', 16, 19); s.m('lifeSupport', 17, 16)
    stores(s, [(10, 16), (11, 16), (12, 16)])
    s.lights((15, 17), (12, 21), (17, 20) if False else (9, 21) if False else (15, 21))
    s.section('East: the shuttle bay, engines, reactors, shield, fabricator, airlock')
    s.m('vehicle_bay', 19, 9, vehicle='vehicle.shuttle'); s.m('engine', 22, 2, 1); s.m('engine', 22, 17, 1)
    s.m('reactor', 19, 2); s.m('reactor', 19, 19); s.m('shieldGen', 24, 9); s.m('fabricator', 19, 15); s.m('airlock', 4, 19, 2)
    s.lights((19, 7), (24, 7), (24, 13), (19, 17), (24, 15), (21, 21))
    return s


def whale():
    s = Ship('WHALE', 31, 25, CREW, 'a teardrop: a big round head full of lounge and cockpit, tapering to an engine tail')
    cols = []
    for x in range(1, 31):
        h = max(3, int(11 * math.sqrt(max(0.0, 1 - ((x - 12) / 11.5) ** 2)) + 0.5)) if x < 12 else 11 - ((x - 12) * 6) // 18
        cols.append((x, 12 - h, 23 if 12 <= x <= 22 else 12 + h))   # a flat belly under the body
    hull(s, cols)
    vline(s, 7, 0, 24); vline(s, 15, 0, 24); vline(s, 23, 0, 24); hline(s, 15, 23, 12)
    for d in [(7, 12), (15, 9), (15, 15), (19, 12), (23, 9), (23, 13)]: s.door(*d)
    s.section('Forehead: the cockpit, the burst laser')
    s.m('helm', 3, 9); s.m('weaponsConsole', 3, 13); s.m('burstLaser', 4, 6)
    s.lights((5, 11), (3, 8), (5, 15), (5, 19))
    s.section('Head lounge: galley, hydroponics, a long mess table, shield console, lockers, life support')
    s.m('galley', 8, 3, **GALLEY); s.m('hydroponics', 10, 2); s.m('hydroponics', 12, 2); s.m('mess_table', 10, 11); s.m('chair', 10, 10, 2); s.m('chair', 11, 10, 2); s.m('chair', 10, 12); s.m('chair', 11, 12)
    s.m('shieldConsole', 11, 15); s.m('storage_locker', 8, 20); s.m('storage_locker', 9, 20); s.m('lifeSupport', 14, 18)
    s.lights((8, 7), (13, 7), (8, 15), (13, 13), (11, 20))
    s.section('Body (north): the shuttle bay, fabricator, a reactor; (south): bunks, the med bed, stores, a reactor')
    s.m('vehicle_bay', 17, 5, vehicle='vehicle.shuttle'); s.m('fabricator', 16, 10)
    for x in (16, 17, 19, 20): s.m('bed', x, 14)
    s.m('med_bed', 22, 14); s.m('lifeSupport', 22, 17)
    stores(s, [(16, 17), (17, 17), (18, 17)]); s.m('reactor', 21, 10); s.m('reactor', 20, 17); s.m('airlock', 16, 20, 2)
    s.lights((19, 4), (19, 11), (16, 16), (19, 19))
    s.section('Tail: two engines (the shield sits in the lounge)')
    s.m('engine', 26, 8, 1); s.m('engine', 26, 13, 1); s.m('shieldGen', 9, 6)
    s.lights((26, 7), (26, 17), (27, 12))
    return s


def hook():
    s = Ship('J-HOOK', 34, 23, CREW, 'a body that curls back on itself at the bow: the cockpit in the curve, a lounge porch on the hook')
    s.room(8, 2, 33, 12); s.room(1, 2, 9, 21); s.room(1, 15, 17, 21)
    vline(s, 15, 2, 12); vline(s, 24, 2, 12); hline(s, 1, 9, 13)
    for d in [(9, 7), (15, 9), (24, 5), (24, 7), (5, 13), (9, 18)]: s.door(*d)
    s.section('Curve (bow): the cockpit and the burst laser')
    s.m('helm', 3, 3); s.m('weaponsConsole', 7, 3); s.m('shieldConsole', 3, 9, 2); s.m('burstLaser', 2, 6)
    s.lights((6, 6), (8, 11), (2, 11), (6, 7))
    s.section('Hook (porch): the lounge with galley, hydroponics, mess table, life support')
    s.m('galley', 2, 16, **GALLEY); s.m('hydroponics', 4, 16); s.m('hydroponics', 6, 16); s.m('mess_table', 11, 18); s.m('chair', 11, 17, 2); s.m('chair', 12, 17, 2)
    s.m('lifeSupport', 16, 16)
    s.lights((3, 19), (8, 20), (14, 19), (9, 15) if False else (12, 16))
    s.section('Body: bunks and med bed, then the shuttle bay with fabricator and stores')
    for x in (10, 11, 13, 14): s.m('bed', x, 3)
    s.m('med_bed', 10, 10); s.m('lifeSupport', 12, 10)
    s.m('vehicle_bay', 16, 3, vehicle='vehicle.shuttle'); s.m('fabricator', 16, 10); s.m('airlock', 20, 9, 2)
    stores(s, [(21, 3), (22, 3), (23, 3)])
    s.lights((12, 6), (14, 11), (21, 6), (17, 9))
    s.section('Stern: two engines, reactors, shield')
    s.m('engine', 29, 3, 1); s.m('engine', 29, 8, 1); s.m('reactor', 25, 3); s.m('reactor', 25, 10); s.m('shieldGen', 27, 10)
    s.lights((28, 7), (25, 6), (32, 7))
    return s


VARIANTS = [lambda: tagged(homestead(), 'new'), lambda: tagged(freighter(), 'new'), lambda: tagged(atrium(), 'new'), lambda: tagged(whale(), 'new'), lambda: tagged(hook(), 'new')]

if __name__ == '__main__':
    write('wayfarer', [v() for v in VARIANTS], 'Wayfarer variants, round 4: new concepts only')
