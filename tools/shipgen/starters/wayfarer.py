"""Wayfarer variants (#241). Run: python3 tools/shipgen/starters/wayfarer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']
STOCK = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]

def spine():
    s = Ship('W2 SPINE HAULER', 35, 25, CREW, 'hab forward, a container spine amidships, engineering aft')
    cols = []
    for x in range(1, 15):
        cols.append((x, 9, 15) if x <= 2 else (x, 6, 18) if x <= 4 else (x, 4, 20))
    hull(s, cols)
    s.room(14, 10, 24, 14)    # spine corridor
    s.room(24, 4, 33, 20)     # engineering and hangar
    vline(s, 8, 0, 24); hline(s, 8, 14, 10); hline(s, 8, 14, 14)
    for d in [(8, 12), (11, 10), (11, 14), (14, 12), (24, 12)]: s.door(*d)
    for x in (15, 18, 21): box(s, x, 6, 0, 's'); box(s, x, 15, 0, 'n')
    s.beam(15, 5, 23, 5); s.beam(15, 19, 23, 19); s.beam(23, 6, 23, 9); s.beam(23, 15, 23, 18)
    s.section('Cockpit: helm, gun and shield consoles')
    s.m('helm', 4, 8); s.m('weaponsConsole', 4, 11); s.m('shieldConsole', 4, 15, 2); s.m('lifeSupport', 7, 5)
    s.lights((3, 10), (3, 14), (7, 12), (6, 18), (6, 7))
    s.section('Lounge (north): galley, hydroponics, lockers and a mess table')
    s.m('galley', 9, 5, **GALLEY); s.m('hydroponics', 11, 5); s.m('storage_locker', 13, 5)
    s.m('mess_table', 10, 8); s.m('chair', 10, 7, 2); s.m('chair', 11, 7, 2)
    s.lights((9, 9), (13, 8))
    s.section('Corridor, quarters (south: four bunks, a med bed) and the stores along the spine')
    s.lights((10, 12), (13, 12))
    for x in (9, 10, 12, 13): s.m('bed', x, 18)
    s.m('med_bed', 9, 15); s.m('lifeSupport', 13, 15)
    s.lights((11, 16))
    s.lights((16, 12), (21, 12))
    s.section('Aft: engines north and south with the shuttle bay between them, reactors, shield, the gun, fabricator and the dorsal airlock')
    s.m('engine', 29, 5, 1); s.m('engine', 29, 16, 1)
    s.m('vehicle_bay', 26, 10, vehicle='vehicle.shuttle')
    s.m('reactor', 31, 10); s.m('reactor', 31, 12)
    s.m('airlock', 26, 4); s.m('lifeSupport', 25, 5)
    s.m('burstLaser', 25, 18); s.m('shieldGen', 31, 14); s.m('lifeSupport', 27, 18); s.m('fabricator', 25, 16)
    for (x, y), st in zip([(16, 11), (17, 11), (18, 11)], STOCK): s.m('storage', x, y, 0, stock=st)
    s.lights((25, 8), (30, 12), (28, 15), (25, 13), (32, 9))
    return s



def hab(b, corridor_door=True):
    """The spine hauler's hab (cockpit, lounge north, bunks south) at an offset; its east wall is x 14, corridor y 11..13."""
    b.hull([(x, 9, 15) if x <= 2 else (x, 6, 18) if x <= 4 else (x, 4, 20) for x in range(1, 15)])
    b.vline(8, 4, 20); b.hline(8, 14, 10); b.hline(8, 14, 14)
    for d in [(8, 12), (11, 10), (11, 14)]: b.door(*d)
    b.section('Hab cockpit: helm, gun and shield consoles')
    b.m('helm', 4, 8); b.m('weaponsConsole', 4, 11); b.m('shieldConsole', 4, 15, 2); b.m('lifeSupport', 7, 5)
    b.lights((3, 10), (3, 14), (7, 12), (6, 18), (6, 7))
    b.section('Hab lounge (north): galley, hydroponics, lockers and a mess table')
    b.m('galley', 9, 5, **GALLEY); b.m('hydroponics', 11, 5); b.m('storage_locker', 13, 5)
    b.m('mess_table', 10, 8); b.m('chair', 10, 7, 2); b.m('chair', 11, 7, 2)
    b.lights((9, 9), (13, 8))
    b.section('Hab corridor and quarters (south): four bunks, a med bed')
    b.lights((10, 12), (13, 12))
    for x in (9, 10, 12, 13): b.m('bed', x, 18)
    b.m('med_bed', 9, 15); b.m('lifeSupport', 13, 15)
    b.lights((11, 16))


def aft(b):
    """The spine hauler's engineering and hangar block at an offset: room x 24..33, y 4..20 (doors are the caller's)."""
    b.room(24, 4, 33, 20)
    b.section('Aft: engines north and south, the shuttle bay between them, reactors, shield, the gun, fabricator, dorsal airlock')
    b.m('engine', 29, 5, 1); b.m('engine', 29, 16, 1)
    b.m('vehicle_bay', 26, 10, vehicle='vehicle.shuttle')
    b.m('reactor', 31, 10); b.m('reactor', 31, 12)
    b.m('airlock', 26, 4); b.m('lifeSupport', 25, 5)
    b.m('burstLaser', 25, 18); b.m('shieldGen', 31, 14); b.m('lifeSupport', 27, 18); b.m('fabricator', 25, 16)
    b.lights((25, 8), (30, 12), (28, 15), (25, 13), (32, 9))


def stores(s, pts):
    s.section('Stores')
    for (x, y), st in zip(pts, STOCK): s.m('storage', x, y, 0, stock=st)


def long_spine():
    s = Ship('W2A LONG SPINE', 39, 25, CREW, 'riff: a longer spine with four containers a side, the same hab and aft')
    hab(Shift(s, 0, 0))
    s.room(14, 10, 28, 14)
    aft(Shift(s, 4, 0))
    s.door(14, 12); s.door(28, 12)
    for x in (15, 18, 21, 24): box(s, x, 6, 0, 's'); box(s, x, 15, 0, 'n')
    s.beam(15, 5, 27, 5); s.beam(15, 19, 27, 19); s.beam(27, 6, 27, 9); s.beam(27, 15, 27, 18)
    s.lights((17, 12), (22, 12), (26, 12))
    stores(s, [(16, 11), (17, 11), (18, 11)])
    return s


def offset_cab():
    s = Ship('W2B STAGGERED', 35, 26, CREW, 'riff: aft block dropped below the spine, big boxes on top, small ones under')
    hab(Shift(s, 0, 0))
    s.room(14, 10, 24, 14)
    aft(Shift(s, 0, 4))
    s.door(14, 12); s.door(24, 12)
    box(s, 15, 4, 0, 's', big=True); box(s, 19, 4, 0, 's', big=True)
    s.beam(15, 3, 23, 3); s.beam(23, 4, 23, 9)
    for x in (16, 20): box(s, x, 15, 0, 'n')
    s.beam(15, 19, 22, 19); s.beam(15, 15, 15, 18)
    s.lights((16, 12), (21, 12))
    stores(s, [(17, 11), (18, 11), (19, 11)])
    return s


def twin_spine():
    s = Ship('W2C TWIN SPINE', 35, 25, CREW, 'riff: two corridors hab to aft, containers zipped into the gap between them')
    hab(Shift(s, 0, 0))
    s.room(14, 4, 24, 8); s.room(14, 16, 24, 20)
    aft(Shift(s, 0, 0))
    for d in [(14, 7), (24, 7), (14, 17), (24, 17)]: s.door(*d)
    for x in (15, 19): box(s, x, 9, 0, 'n')
    for x in (17, 21): box(s, x, 12, 0, 's')
    s.beam(23, 9, 23, 15); s.beam(15, 13, 16, 15) if False else None
    s.lights((17, 6), (22, 6), (17, 18), (22, 18))
    stores(s, [(16, 5), (17, 5), (18, 5)])
    return s



def catamaran():
    s = Ship('WN1 CATAMARAN', 33, 26, CREW, 'new: twin hulls joined at the bow, containers zipped between them, an engine on each stern')
    hull(s, [(x, 8, 17) if x <= 2 else (x, 3, 22) for x in range(1, 11)])
    s.room(10, 3, 31, 9); s.room(10, 16, 31, 23)
    hline(s, 1, 10, 8); hline(s, 1, 10, 17)
    for d in [(10, 6), (10, 19), (5, 8), (5, 17)]: s.door(*d)
    for x in (12, 18, 24): box(s, x, 10, 0, 'n')
    for x in (15, 21): box(s, x, 12, 0, 's')
    s.section('Bow cockpit: helm, gun and shield consoles, the burst laser')
    s.m('helm', 3, 10); s.m('weaponsConsole', 3, 13); s.m('shieldConsole', 6, 14, 2); s.m('burstLaser', 7, 10)
    s.lights((2, 12), (6, 12), (9, 13))
    s.section('Bow lounge (north): galley, hydroponics, mess table')
    s.m('galley', 4, 4, **GALLEY); s.m('hydroponics', 6, 4); s.m('mess_table', 7, 6); s.m('chair', 7, 5, 2); s.m('chair', 8, 5, 2)
    s.lights((4, 7), (9, 4))
    s.section('Bow (south): life support, lockers, a med bed')
    s.m('lifeSupport', 4, 20); s.m('storage_locker', 6, 18); s.m('storage_locker', 7, 18); s.m('med_bed', 9, 18)
    s.lights((6, 21), (4, 18))
    s.section('North hull: bunks, life support, a reactor and its engine')
    for x in (12, 13, 15, 16): s.m('bed', x, 4)
    s.m('lifeSupport', 18, 4); s.m('reactor', 23, 4); s.m('engine', 27, 4, 1)
    s.lights((11, 7), (17, 7), (21, 5), (25, 7), (30, 8))
    s.section('South hull: shuttle bay, fabricator, stores, reactor, shield, airlock and its engine')
    s.m('airlock', 11, 20, 2); s.m('reactor', 12, 17); s.m('fabricator', 14, 17)
    for (x, y), st in zip([(16, 17), (17, 17), (18, 17)], STOCK): s.m('storage', x, y, 0, stock=st)
    s.m('shieldGen', 16, 20); s.m('vehicle_bay', 20, 17, vehicle='vehicle.shuttle'); s.m('engine', 27, 19, 1)
    s.lights((14, 21), (19, 19), (24, 22), (26, 20), (30, 17), (19, 22))
    return s


def dome():
    s = Ship('WN2 DOME', 34, 25, CREW, 'new: a round hab forward with a big lounge, a short neck, engineering aft')
    import math
    hull(s, [(x, 12 - max(2, int(math.sqrt(max(0, 81 - (x - 10) ** 2)) + 0.5)), 12 + max(2, int(math.sqrt(max(0, 81 - (x - 10) ** 2)) + 0.5))) for x in range(1, 20)])
    s.room(18, 10, 24, 14)
    aft(Shift(s, 0, 0))
    vline(s, 7, 0, 24); hline(s, 7, 18, 7); hline(s, 7, 18, 17)
    for d in [(7, 12), (10, 7), (10, 17), (24, 12)]: s.door(*d)
    s.section('Dome cockpit (front): helm, gun and shield consoles')
    s.m('helm', 3, 9); s.m('weaponsConsole', 3, 12); s.m('shieldConsole', 14, 14)
    s.lights((5, 11), (5, 15), (5, 7))
    s.section('Dome lounge (centre): galley, mess table, hydroponics ring, life support')
    s.m('galley', 8, 8, **GALLEY); s.m('hydroponics', 13, 8); s.m('hydroponics', 13, 16) if False else None
    s.m('mess_table', 10, 12); s.m('chair', 10, 11, 2); s.m('chair', 11, 11, 2); s.m('chair', 10, 13); s.m('chair', 11, 13)
    s.m('lifeSupport', 16, 9); s.m('hydroponics', 8, 16) if False else None
    s.lights((8, 12), (14, 12), (12, 15))
    s.section('Dome north arc: bunks')
    for x, y in ((9, 4), (10, 4), (11, 4), (13, 5)): s.m('bed', x, y)
    s.lights((12, 6), (15, 6))
    s.section('Dome south arc: med bed, lockers, life support')
    s.m('med_bed', 8, 18); s.m('storage_locker', 12, 18)
    s.lights((12, 19), (9, 20))
    stores(s, [(19, 11), (20, 11), (21, 11)])
    s.lights((22, 13))
    return s


VARIANTS = [lambda: tagged(spine(), "favourite"), lambda: tagged(long_spine(), "riff"), lambda: tagged(offset_cab(), "riff"), lambda: tagged(twin_spine(), "riff"), lambda: tagged(catamaran(), "new"), lambda: tagged(dome(), "new")]

if __name__ == "__main__":
    write("wayfarer", [v() for v in VARIANTS], "Wayfarer variants: the favourite and new riffs and concepts")
