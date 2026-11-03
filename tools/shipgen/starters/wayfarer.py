"""Wayfarer variants, round 6: walkable hull shapes after FTL silhouettes, our own rooms (#241). Run: python3 tools/shipgen/starters/wayfarer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']
STOCK = [STOCK_BUILD, [{'item': 'item.metal', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]


def kestrel():
    s = Ship('TWIN PODS', 34, 34, CREW, 'a long-nosed body with two engine pods held out above and below the stern, each reached by a short corridor')
    hull(s, [(x, 17 - min(7, x + 2), 17 + min(7, x + 2)) for x in range(1, 8)])
    s.section('Bridge (nose): helm, gun console, the burst laser')
    s.m('helm', 3, 14); s.m('burstLaser', 2, 17); s.m('weaponsConsole', 5, 17); s.lights((6, 12), (5, 22), (2, 15), (5, 20))
    room(s, 'Corridor', 7, 14, 22, 18).light((9, 16), (15, 16), (21, 16))
    q = room(s, 'Quarters: four bunks', 7, 10, 13, 14); q.row(['bed', 'bed', 'bed', 'bed']); q.light((12, 13))
    me = room(s, 'Mess and comms: galley, the shield console', 13, 10, 19, 14); me.m('galley', 14, 11, **GALLEY); me.m('shieldConsole', 16, 11); me.light((18, 13))
    ln = room(s, 'Upper lobby: life support', 19, 10, 22, 14); ln.m('lifeSupport', 21, 11); ln.light((20, 13))
    ho = room(s, 'Hold: stores, fabricator, the airlock', 7, 18, 13, 24); ho.m('fabricator', 8, 19); ho.m('storage', 8, 23, 2, stock=STOCK[0]); ho.m('storage', 9, 23, 2, stock=STOCK[1]); ho.m('airlock', 10, 21, 2); ho.light((12, 19), (8, 21))
    hg = room(s, 'Hangar: the shuttle bay', 13, 18, 19, 24); hg.m('vehicle_bay', 14, 19, vehicle='vehicle.shuttle'); hg.light((18, 23))
    md = room(s, 'Med bay: med bed, stores', 19, 18, 22, 24); md.m('med_bed', 20, 19); md.m('storage', 21, 19, stock=STOCK[2]); md.light((21, 23))
    room(s, 'Upper neck', 19, 6, 22, 10).light((20, 8))
    room(s, 'Lower neck', 19, 24, 22, 28).light((20, 26))
    pn = room(s, 'Upper engine pod: an engine, a reactor, life support, the shield', 16, 1, 33, 6); pn.m('engine', 29, 2, 1); pn.m('reactor', 17, 2); pn.m('shieldGen', 22, 2); pn.m('lifeSupport', 26, 2); pn.light((18, 5), (24, 5), (28, 5))
    ps = room(s, 'Lower engine pod: an engine, a reactor', 16, 28, 33, 33); ps.m('engine', 29, 29, 1); ps.m('reactor', 17, 29); ps.light((18, 32), (24, 30), (28, 32))
    for d in [(7, 16), (10, 14), (15, 14), (20, 14), (10, 18), (18, 18), (20, 18), (20, 6), (20, 10), (20, 24), (20, 28)]: s.door(*d)
    return s



def c_arms():
    s = Ship('C-ARMS', 32, 28, CREW, 'a C open to the bow: two long arms reaching forward from an engine block, a hallway down the inside of each')
    room(s, 'North hallway', 5, 6, 22, 9).light((7, 7), (14, 7), (20, 8))
    br = room(s, 'Bridge (north arm tip): helm and shield console', 5, 2, 12, 6); br.m('helm', 6, 3); br.m('shieldConsole', 9, 3); br.light((8, 5))
    q = room(s, 'Quarters: four bunks', 12, 2, 17, 6); q.row(['bed', 'bed', 'bed', 'bed']); q.light((16, 5))
    me = room(s, 'Mess: galley, hydroponics, life support', 17, 2, 22, 6); me.row([('galley', GALLEY), 'hydroponics']); me.light((21, 5))
    room(s, 'South hallway', 5, 19, 22, 22).light((7, 20), (14, 20), (20, 21))
    gr = room(s, 'Gun room (south arm tip): the burst laser and gun console', 5, 22, 12, 26); gr.m('burstLaser', 6, 24); gr.m('weaponsConsole', 9, 23); gr.light((11, 25))
    md = room(s, 'Med bay: med bed, life support', 12, 22, 17, 26); md.m('med_bed', 13, 24); md.m('lifeSupport', 16, 24); md.light((14, 23))
    ho = room(s, 'Hold: stores, fabricator, the airlock', 17, 22, 22, 26); ho.m('airlock', 18, 23, 2); ho.light((21, 23))
    hg = room(s, 'Hangar: the shuttle bay, stores', 22, 2, 31, 9); hg.m('vehicle_bay', 23, 3, vehicle='vehicle.shuttle'); hg.m('storage', 28, 3, stock=STOCK[0]); hg.m('storage', 29, 3, stock=STOCK[1]); hg.m('storage', 30, 3, stock=STOCK[2]); hg.light((29, 8), (28, 6))
    er = room(s, 'Engine room: two engines, two reactors', 22, 9, 31, 19); er.m('engine', 27, 10, 1); er.m('engine', 27, 15, 1); er.m('reactor', 23, 10); er.m('reactor', 23, 16); er.light((24, 13), (26, 14), (30, 14))
    sr = room(s, 'Shield room: shield, life support, fabricator', 22, 19, 31, 26); sr.m('shieldGen', 23, 23); sr.m('lifeSupport', 30, 20); sr.m('fabricator', 26, 25, 2); sr.light((28, 22), (24, 21))
    for d in [(8, 6), (14, 6), (19, 6), (8, 22), (14, 22), (19, 22), (22, 8), (22, 20), (26, 9), (26, 19)]: s.door(*d)
    return s



def spine():
    s = Ship('SPINE HAULER', 37, 25, CREW, 'a rounded hab forward with the hold, a spine of crew rooms (med bay, two quarters, a workshop) amidships, engineering aft')
    hull(s, [(x, 9, 15) if x <= 2 else (x, 6, 18) if x <= 4 else (x, 4, 20) for x in range(1, 9)])
    s.section('Cockpit: helm, gun and shield consoles, the burst laser')
    s.m('helm', 4, 7); s.m('weaponsConsole', 3, 11); s.m('burstLaser', 5, 11); s.m('shieldConsole', 4, 15); s.lights((7, 6), (7, 13), (2, 13), (6, 19))
    lo = room(s, 'Lounge: galley, mess table and chairs, the airlock', 8, 4, 15, 10); lo.m('airlock', 9, 4); lo.m('galley', 12, 5, **GALLEY); lo.m('mess_table', 12, 8); lo.m('chair', 12, 7, 2); lo.m('chair', 13, 7, 2); lo.light((14, 9), (14, 6))
    room(s, 'Hab corridor', 8, 10, 15, 14).light((11, 12))
    ho = room(s, 'Hold: three racks', 8, 14, 15, 20); ho.row([('storage_rack', {'stock': st}) for st in STOCK], wall='s'); ho.light((14, 15))
    room(s, 'Spine', 15, 10, 25, 14).light((17, 12), (23, 12))
    md = room(s, 'Med bay: a med bed', 15, 6, 20, 10); md.m('med_bed', 16, 7); md.light((19, 8))
    qa = room(s, 'Quarters A: two bunks', 20, 6, 25, 10); qa.row(['bed', 'bed'], x=21); qa.light((24, 8))
    qb = room(s, 'Quarters B: two bunks', 15, 14, 20, 18); qb.row(['bed', 'bed'], x=16, wall='s'); qb.light((19, 16))
    ws = room(s, 'Workshop: the fabricator', 20, 14, 25, 18); ws.m('fabricator', 21, 17, 2); ws.light((24, 16))
    hg = room(s, 'Hangar: the shuttle bay', 25, 4, 31, 11); hg.m('vehicle_bay', 26, 5, vehicle='vehicle.shuttle'); hg.light((30, 6))
    en = room(s, 'Engineering: two reactors, the shield, life support', 25, 11, 31, 20); en.m('lifeSupport', 26, 14); en.m('reactor', 26, 16); en.m('reactor', 26, 18); en.m('shieldGen', 29, 18); en.m('lifeSupport', 30, 14); en.light((28, 13), (28, 18))
    er = room(s, 'Engine room: two engines', 31, 4, 36, 20); er.m('engine', 32, 5, 1); er.m('engine', 32, 16, 1); er.light((33, 10), (34, 13))
    for d in [(8, 12), (11, 10), (11, 14), (15, 12), (18, 10), (23, 10), (18, 14), (23, 14), (25, 12), (30, 11), (31, 12)]: s.door(*d)
    return s


def roundhouse():
    s = Ship('ROUNDHOUSE', 28, 26, CREW, 'a squat round hull built around a ring hallway, rooms bulging out on every side like lumps of armour')
    room(s, 'Ring hallway', 7, 6, 19, 18).light((8, 7), (18, 7), (8, 17), (18, 17), (8, 12), (18, 12), (13, 8), (13, 16))
    co = room(s, 'Core: two reactors, the shield, life support', 10, 9, 16, 15); co.m('reactor', 11, 10); co.m('reactor', 11, 13); co.m('shieldGen', 14, 10); co.m('lifeSupport', 15, 13); co.light((13, 12))
    br = room(s, 'Bridge (bow lump): helm, gun console, the burst laser', 1, 8, 7, 16); br.m('helm', 3, 9); br.m('weaponsConsole', 2, 13); br.m('burstLaser', 5, 13); br.light((5, 11), (4, 15))
    q = room(s, 'Quarters: four bunks', 8, 1, 13, 6); q.row(['bed', 'bed', 'bed', 'bed']); q.light((10, 5))
    me = room(s, 'Mess: galley, hydroponics', 13, 1, 19, 6); me.row([('galley', GALLEY), 'hydroponics'], x=14); me.light((17, 5))
    sh = room(s, 'Workshop: fabricator, stores', 19, 0, 25, 6); sh.m('fabricator', 21, 1); sh.m('storage', 24, 1, stock=STOCK[2]); sh.light((22, 4))
    er = room(s, 'Engine room: two engines', 19, 6, 24, 18); er.m('engine', 20, 7, 1); er.m('engine', 20, 14, 1); er.light((21, 12))
    ho = room(s, 'Hold: stores, the airlock', 8, 18, 13, 23); ho.m('airlock', 9, 20, 2); ho.m('storage', 12, 19, stock=STOCK[0]); ho.light((12, 22))
    md = room(s, 'Med bay: med bed, life support, stores', 13, 18, 19, 23); md.m('med_bed', 14, 21); md.m('lifeSupport', 18, 21); md.m('storage', 17, 19, stock=STOCK[1]); md.light((16, 21))
    hg = room(s, 'Hangar: the shuttle bay', 19, 18, 26, 25); hg.m('vehicle_bay', 21, 19, vehicle='vehicle.shuttle'); hg.light((20, 23), (25, 24))
    for d in [(7, 12), (13, 9), (13, 15), (11, 6), (16, 6), (19, 4), (19, 12), (11, 18), (16, 18), (19, 20)]: s.door(*d)
    return s


VARIANTS = [lambda: tagged(kestrel(), 'new'), lambda: tagged(c_arms(), 'new'), lambda: tagged(spine(), 'riff'), lambda: tagged(roundhouse(), 'new')]

if __name__ == '__main__':
    write('wayfarer', [v() for v in VARIANTS], 'Wayfarer variants, round 6: walkable hull shapes after FTL silhouettes')
