"""Wayfarer variants, round 5: new concepts with proper rooms, no containers (#241). Run: python3 tools/shipgen/starters/wayfarer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']
STOCK = [STOCK_BUILD, [{'item': 'item.metal', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]
ST = [('storage', {'stock': STOCK[0]}), ('storage', {'stock': STOCK[1]}), ('storage', {'stock': STOCK[2]})]


def longhouse():
    s = Ship('LONGHOUSE', 37, 22, CREW, 'a long hall down the middle with cabins either side, staggered roofline, the bridge in a rounded bow')
    hull(s, [(x, 9 - min(4, x), 12 + min(4, x)) for x in range(1, 9)])
    s.section('Bridge (bow): helm, gun and shield consoles, the burst laser')
    s.m('helm', 5, 6); s.m('burstLaser', 2, 9); s.m('weaponsConsole', 5, 9); s.m('shieldConsole', 4, 13)
    s.lights((3, 8), (7, 8), (7, 12), (3, 12))
    room(s, 'Hall', 8, 9, 30, 12).lit([(14, 10), (24, 10)])
    q1 = room(s, 'Cabin: two bunks', 8, 4, 13, 9); q1.row(['bed', 'bed']); q1.lit()
    q2 = room(s, 'Cabin: two bunks', 13, 3, 18, 9); q2.row(['bed', 'bed']); q2.lit([(16, 5)])
    mb = room(s, 'Med bay', 18, 4, 23, 9); mb.row(['med_bed', 'storage_locker', 'lifeSupport']); mb.lit()
    ga = room(s, 'Galley and mess', 23, 3, 30, 9); ga.row([('galley', GALLEY), 'hydroponics']); ga.row(['mess_table'], y=6, x=25); ga.lit([(28, 5)])
    ho = room(s, 'Workshop and stores', 8, 12, 15, 18); ho.row(['fabricator'] + ST); ho.lit()
    sh = room(s, 'Shield and life support', 15, 12, 20, 17); sh.row(['shieldGen', 'lifeSupport']); sh.lit()
    hg = room(s, 'Hangar: the shuttle bay', 20, 12, 30, 19); hg.m('vehicle_bay', 21, 13, vehicle='vehicle.shuttle'); hg.m('airlock', 26, 16, 2); hg.lit([(29, 13)])
    er = room(s, 'Engine room: two engines, two reactors', 30, 2, 36, 19)
    er.m('engine', 32, 3, 1); er.m('engine', 32, 15, 1); er.m('reactor', 33, 8); er.m('reactor', 33, 11); er.light((35, 10), (31, 13), (31, 5), (31, 17))
    for d in [(8, 10), (10, 9), (15, 9), (20, 9), (26, 9), (14, 12), (19, 12), (25, 12), (30, 11)]: s.door(*d)
    return s



def staggered():
    s = Ship('STAGGERED', 34, 24, CREW, 'two blocks offset corner to corner: a living block forward-north, a working block aft-south, joined by a lobby')
    br = room(s, 'Bridge', 1, 2, 8, 9); br.m('helm', 2, 3); br.m('shieldConsole', 5, 3); br.m('weaponsConsole', 2, 6); br.m('burstLaser', 5, 6); br.light((7, 8), (2, 8))
    hall = room(s, 'Living hall', 8, 6, 19, 9); hall.light((10, 7), (16, 7))
    q = room(s, 'Quarters: four bunks', 8, 1, 14, 6); q.row(['bed', 'bed', 'bed', 'bed']); q.lit()
    ga = room(s, 'Galley and mess', 14, 1, 20, 6); ga.row([('galley', GALLEY), 'hydroponics']); ga.lit()
    mb = room(s, 'Med bay and life support', 8, 9, 14, 13); mb.row(['med_bed', 'lifeSupport', 'storage_locker'], wall='s'); mb.light((12, 10))
    lo = room(s, 'Lobby', 14, 9, 20, 15); lo.lit([(19, 10)])
    ho = room(s, 'Hold and workshop', 20, 9, 28, 15); ho.row(['fabricator'] + ST); ho.lit()
    hg = room(s, 'Hangar', 14, 15, 23, 22); hg.m('vehicle_bay', 15, 17, vehicle='vehicle.shuttle'); hg.m('airlock', 20, 19, 2); hg.light((22, 16), (15, 16), (20, 16))
    rs = room(s, 'Reactor and shield room', 23, 15, 28, 22); rs.row(['reactor', 'shieldGen'], wall='s'); rs.light((25, 17))
    er = room(s, 'Engine room', 28, 7, 33, 22); er.m('engine', 29, 8, 1); er.m('engine', 29, 18, 1); er.m('reactor', 30, 13); er.m('lifeSupport', 32, 13)
    er.light((29, 12), (32, 15), (29, 17), (30, 16))
    for d in [(8, 7), (11, 6), (17, 6), (11, 9), (17, 9), (20, 12), (17, 15), (23, 18), (28, 12), (28, 16)]: s.door(*d)
    return s


def terraces():
    s = Ship('TERRACES', 34, 24, CREW, 'a straight north side and a south side that steps down in three terraces toward the stern')
    corr = room(s, 'Main corridor', 8, 6, 28, 9); corr.light((12, 7), (19, 7), (25, 7))
    br = room(s, 'Bridge', 1, 2, 8, 10); br.m('helm', 2, 3); br.m('shieldConsole', 5, 3); br.m('weaponsConsole', 2, 7); br.light((4, 9), (7, 6))
    wb = room(s, 'Gun room', 1, 10, 8, 14); wb.m('burstLaser', 2, 11); wb.lit()
    q = room(s, 'Quarters: four bunks', 8, 1, 15, 6); q.row(['bed', 'bed', 'bed', 'bed']); q.lit()
    ga = room(s, 'Galley and mess', 15, 1, 22, 6); ga.row([('galley', GALLEY), 'hydroponics', 'mess_table']); ga.lit()
    mb = room(s, 'Med bay', 22, 1, 28, 6); mb.row(['med_bed', 'med_bed', 'storage_locker', 'lifeSupport']); mb.lit()
    t1 = room(s, 'Terrace 1: workshop and stores', 8, 9, 15, 14); t1.row(['fabricator'] + ST, wall='s'); t1.light((12, 10))
    t2 = room(s, 'Terrace 2: shield, life support, the airlock', 15, 9, 21, 17); t2.m('shieldGen', 16, 11); t2.m('lifeSupport', 19, 11); t2.m('airlock', 17, 14, 2); t2.light((19, 10), (16, 15))
    t3 = room(s, 'Terrace 3: hangar', 21, 9, 28, 20); t3.m('vehicle_bay', 22, 13, vehicle='vehicle.shuttle'); t3.light((22, 11), (27, 11), (27, 18))
    er = room(s, 'Engine room', 28, 1, 33, 20); er.m('engine', 29, 2, 1); er.m('engine', 29, 16, 1); er.m('reactor', 31, 7); er.m('reactor', 31, 10)
    er.light((29, 7), (32, 13), (29, 13), (30, 10))
    for d in [(8, 7), (11, 6), (18, 6), (25, 6), (11, 9), (18, 9), (24, 9), (28, 7), (5, 10)]: s.door(*d)
    return s


def nacelles():
    s = Ship('NACELLE CRUISER', 35, 28, CREW, 'a slim hull with two big engine nacelles held off on short pylons, the hangar in the lower one')
    hull(s, [(x, 13 - min(6, x + 1), 13 + min(6, x + 1)) for x in range(1, 9)])
    s.section('Bridge (bow): helm, gun and shield consoles, the burst laser')
    s.m('helm', 4, 10); s.m('weaponsConsole', 3, 13); s.m('burstLaser', 5, 13); s.lights((7, 9), (7, 15), (3, 15), (6, 18))
    room(s, 'Corridor', 8, 11, 27, 15).light((12, 13), (19, 13), (25, 13))
    q = room(s, 'Quarters: four bunks', 8, 7, 14, 11); q.row(['bed', 'bed', 'bed', 'bed']); q.light((13, 10))
    ga = room(s, 'Galley and mess', 14, 7, 21, 11); ga.row([('galley', GALLEY), 'hydroponics', 'mess_table']); ga.light((17, 10))
    mb = room(s, 'Med bay', 21, 7, 27, 11); mb.row(['med_bed', 'lifeSupport', 'storage_locker']); mb.light((26, 10))
    ho = room(s, 'Stores and workshop', 8, 15, 15, 19); ho.row(['fabricator'] + ST, wall='s'); ho.light((12, 16))
    sh = room(s, 'Shield and life support', 15, 15, 21, 19); sh.row(['shieldGen', 'lifeSupport'], wall='s'); sh.light((18, 16))
    lb = room(s, 'Comms lobby: the shield console', 21, 15, 27, 19); lb.m('shieldConsole', 24, 16); lb.light((22, 18))
    room(s, 'Pylon (north)', 23, 5, 27, 7).light((25, 6))
    room(s, 'Pylon (south)', 23, 19, 27, 21).light((25, 20))
    rr = room(s, 'North nacelle: a reactor and the airlock', 20, 0, 27, 5); rr.m('airlock', 21, 0)
    rr.m('reactor', 24, 1); rr.light((26, 4))
    en = room(s, 'North nacelle: engine room', 27, 0, 34, 5); en.m('engine', 30, 1, 1); en.light((28, 4))
    hg = room(s, 'South nacelle: hangar', 20, 21, 27, 27); hg.m('vehicle_bay', 21, 22, vehicle='vehicle.shuttle'); hg.light((26, 22))
    es = room(s, 'South nacelle: engine room and reactor', 27, 21, 34, 27); es.m('engine', 30, 22, 1); es.m('reactor', 28, 22); es.light((28, 26), (32, 26))
    for d in [(8, 13), (11, 11), (17, 11), (24, 11), (11, 15), (18, 15), (22, 15), (25, 7), (25, 5), (25, 19), (25, 21), (27, 3), (27, 24)]: s.door(*d)
    return s


def roundhouse():
    s = Ship('ROUNDHOUSE', 27, 27, CREW, 'an octagon: a ring corridor around the mess, with bridge, bunks, hangar and engines on the four sides')
    hull(s, [(x, 1 + max(0, 8 - x, x - 19), 25 - max(0, 8 - x, x - 19)) for x in range(2, 26)])
    vline(s, 7, 0, 26); vline(s, 19, 0, 26); vline(s, 8, 20, 24); hline(s, 0, 26, 7); hline(s, 0, 26, 19)
    room(s, 'Ring corridor', 7, 7, 19, 19).light((8, 8), (18, 8), (8, 18), (18, 18))
    core = room(s, 'Mess (centre)', 9, 9, 17, 17); core.row([('galley', GALLEY), 'hydroponics', 'hydroponics'], wall='s'); core.m('mess_table', 12, 12); core.light((13, 10), (10, 13), (16, 13))
    s.section('Bridge (west side): helm, gun and shield consoles, the burst laser')
    s.m('helm', 3, 8); s.m('weaponsConsole', 3, 11); s.m('shieldConsole', 3, 14); s.m('burstLaser', 3, 17); s.lights((6, 8), (6, 12), (6, 16), (5, 18))
    s.section('Quarters (north side): four bunks, a med bed, a locker, the shield')
    for x in (9, 10, 11, 12): s.m('bed', x, 2)
    s.m('shieldGen', 13, 2); s.m('med_bed', 15, 2); s.m('storage_locker', 17, 2); s.m('lifeSupport', 18, 2); s.lights((10, 5), (16, 5))
    s.section('Hangar (south side): the shuttle bay, fabricator, a reactor, stores, the airlock')
    s.m('vehicle_bay', 9, 20, vehicle='vehicle.shuttle'); s.m('fabricator', 14, 20); s.m('reactor', 17, 20); s.m('airlock', 15, 22, 2)
    for (x, y), st in zip([(13, 24), (14, 24), (18, 24)], STOCK): s.m('storage', x, y, 2, stock=st)
    s.lights((13, 20), (18, 22), (13, 22))
    s.section('Engine room (east side): two engines, a reactor, life support')
    s.m('engine', 21, 8, 1); s.m('engine', 21, 15, 1); s.m('reactor', 22, 12); s.m('lifeSupport', 24, 12); s.lights((20, 11), (23, 14), (20, 14))
    s.section('Corner closets: lockers')
    s.m('storage_locker', 6, 5); s.m('storage_locker', 20, 4); s.lights((5, 6), (20, 6), (20, 22), (5, 20))
    for d in [(13, 7), (13, 19), (7, 13), (19, 13), (13, 9), (19, 6), (19, 22), (6, 19), (7, 6)]: s.door(*d)
    return s

VARIANTS = [lambda: tagged(longhouse(), 'new'), lambda: tagged(staggered(), 'new'), lambda: tagged(terraces(), 'new'), lambda: tagged(nacelles(), 'new'), lambda: tagged(roundhouse(), 'new')]

if __name__ == '__main__':
    write('wayfarerR5', [v() for v in VARIANTS], 'Wayfarer variants, round 5: new concepts with proper rooms')
