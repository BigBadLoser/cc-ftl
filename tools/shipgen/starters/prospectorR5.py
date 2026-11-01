"""Prospector variants, round 5: new concepts with proper rooms, no containers (#241). Run: python3 tools/shipgen/starters/prospector.py"""
from common import *  # noqa: F401,F403

CREW = ['role.pilot', 'role.engineer', 'role.engineer']
STOCK = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}, {'item': 'item.fuel', 'count': 16}], [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]]
RK = [('storage_rack', {'stock': STOCK[0]}), ('storage_rack', {'stock': STOCK[1]}), ('storage_rack', {'stock': STOCK[2]})]


def pod(x0, y0, x1, y1):
    """A rectangle with its corners cut by one tile (a rounded tank or pod)."""
    return [(x0, y0 + 1, y1 - 1)] + [(x, y0, y1) for x in range(x0 + 1, x1)] + [(x1, y0 + 1, y1 - 1)]


def octagon(cx, cy, r, flat):
    return [(x, cy - (r - max(0, abs(x - cx) - flat)), cy + (r - max(0, abs(x - cx) - flat))) for x in range(cx - r - flat + 1, cx + r + flat)]


def saddlebags():
    s = Ship('SADDLEBAGS', 34, 26, CREW, 'a slim spine with two big holds slung either side like saddlebags: ore above, the pod hangar below')
    hull(s, [(x, 13 - min(6, x + 2), 13 + min(6, x + 2)) for x in range(1, 9)])
    hline(s, 0, 8, 13)
    s.section('Bridge (bow, upper): helm and gun console')
    s.m('helm', 5, 8); s.m('weaponsConsole', 5, 11); s.lights((7, 12), (4, 9), (2, 12))
    s.section('Quarters (bow, lower): three bunks; the burst laser in the chin')
    for x in (5, 6, 7): s.m('bed', x, 14)
    s.m('burstLaser', 3, 15); s.lights((6, 17))
    s.lights((2, 14), (7, 17))
    room(s, 'Spine corridor', 8, 11, 25, 15).light((10, 13), (17, 13), (23, 13))
    no = room(s, 'Ore hold (north saddlebag): refinery and ore bins', 10, 2, 22, 11)
    no.m('refinery', 11, 3); no.m('storage_ore_large', 15, 3); no.m('storage_ore', 19, 3); no.m('storage_ore', 19, 7); no.m('lifeSupport', 21, 9); no.light((12, 9), (17, 8), (21, 6))
    so = room(s, 'Pod hangar (south saddlebag): the pod bay, a pallet, racks, the airlock', 10, 15, 22, 24)
    so.m('pod_bay', 11, 17, vehicle='vehicle.mining_pod'); so.m('storage_pallet', 16, 17); so.row(RK, x=11, wall='s'); so.m('airlock', 18, 21, 2)
    so.light((15, 16), (21, 17), (13, 21))
    ga = room(s, 'Galley', 22, 7, 25, 11); ga.m('galley', 23, 8, **GALLEY); ga.m('lifeSupport', 24, 9); ga.light((23, 10))
    sh = room(s, 'Shield room', 22, 15, 25, 19); sh.m('shieldGen', 23, 17); sh.light((24, 16))
    er = room(s, 'Engine room: two engines, two reactors', 25, 7, 33, 19)
    er.m('engine', 29, 8, 1); er.m('engine', 29, 15, 1); er.m('reactor', 26, 8); er.m('reactor', 26, 16); er.light((28, 10), (30, 13), (26, 13), (28, 17))
    for d in [(8, 12), (8, 14), (16, 11), (16, 15), (23, 11), (23, 15), (25, 13)]: s.door(*d)
    return s



def mining_train():
    s = Ship('MINING TRAIN', 38, 19, CREW, 'four cars on short couplings: cab, refinery car, ore car, engine car')
    for x0, x1 in [(1, 8), (10, 18), (20, 28), (30, 37)]: hull(s, [(x, 3, 15) for x in range(x0, x1 + 1)])
    for x0 in (8, 18, 28): room(s, 'Coupling', x0, 7, x0 + 2, 11).light((x0 + 1, 9))
    for x0, x1 in [(1, 8), (10, 18), (20, 28)]: hline(s, x0, x1, 9)
    br = Room(s, 1, 3, 8, 9, 'Cab: bridge'); s.section('Cab: bridge'); br.m('helm', 2, 4); br.m('weaponsConsole', 5, 4); br.light((7, 8), (2, 7))
    s.section('Cab: quarters'); qu = Room(s, 1, 9, 8, 15, 'Cab: quarters'); qu.row(['bed', 'bed', 'bed', 'lifeSupport'], wall='s'); qu.m('burstLaser', 2, 10); qu.light((7, 11), (6, 14))
    s.section('Refinery car: the refinery and an ore bin'); rf = Room(s, 10, 3, 18, 9, 'Refinery car'); rf.m('refinery', 11, 4); rf.m('storage_ore', 15, 4); rf.light((17, 8), (15, 8))
    s.section('Refinery car: galley, a rack, life support'); ga = Room(s, 10, 9, 18, 15, 'Galley'); ga.row([('galley', GALLEY), 'mess_table', RK[2]], wall='s'); ga.m('lifeSupport', 17, 13); ga.light((14, 10), (11, 11))
    s.section('Ore car: the pod bay and a big ore bin'); pd = Room(s, 20, 3, 28, 9, 'Ore car: pod bay'); pd.m('pod_bay', 21, 4, vehicle='vehicle.mining_pod'); pd.m('storage_ore_large', 25, 4); pd.light((27, 8), (21, 8))
    s.section('Ore car: racks, shield, the airlock'); ho = Room(s, 20, 9, 28, 15, 'Ore car: hold'); ho.row(RK[:2], x=22, y=10); ho.m('airlock', 24, 12, 2)
    ho.m('shieldGen', 21, 13); ho.light((27, 12), (23, 12))
    s.section('Engine car: two engines, two reactors, the airlock'); en = Room(s, 30, 3, 37, 15, 'Engine car')
    en.m('engine', 33, 4, 1); en.m('engine', 33, 11, 1); en.m('reactor', 31, 4); en.m('reactor', 31, 13); en.light((32, 9), (35, 9), (31, 7))
    for d in [(8, 8), (8, 10), (10, 8), (10, 10), (18, 8), (18, 10), (20, 8), (20, 10), (28, 8), (28, 10), (30, 9)]: s.door(*d)
    return s



def excavator():
    s = Ship('EXCAVATOR', 34, 27, CREW, 'a works block with a jointed boom reaching down and forward to a bucket: the pod bay')
    br = room(s, 'Bridge: helm and gun console', 12, 2, 19, 7); br.m('helm', 13, 3); br.m('weaponsConsole', 16, 3); br.light((18, 6), (13, 6))
    qu = room(s, 'Quarters: three bunks, life support', 19, 2, 25, 7); qu.row(['bed', 'bed', 'bed', 'lifeSupport']); qu.light((24, 6))
    ga = room(s, 'Galley', 25, 2, 28, 7); ga.m('galley', 26, 3, **GALLEY); ga.light((27, 6))
    room(s, 'Corridor', 12, 7, 28, 11).light((14, 9), (20, 9), (26, 9))
    rf = room(s, 'Refinery: the refinery and two ore bins', 12, 11, 20, 17); rf.m('refinery', 13, 12); rf.m('storage_ore', 17, 12); rf.m('storage_ore', 17, 15, 2); rf.light((19, 16), (19, 12), (14, 16))
    sh = room(s, 'Shield and life support', 20, 11, 24, 17); sh.m('shieldGen', 21, 15); sh.m('lifeSupport', 23, 15); sh.light((23, 12))
    al = room(s, 'Airlock room', 24, 11, 28, 17); al.m('airlock', 25, 14, 2); al.light((27, 12))
    er = room(s, 'Engine room: two engines, two reactors', 28, 2, 33, 17); er.m('engine', 29, 3, 1); er.m('engine', 29, 13, 1); er.m('reactor', 31, 7); er.m('reactor', 31, 10)
    er.light((29, 8), (32, 12), (29, 12))
    bm = room(s, 'Boom: racks', 10, 17, 15, 21); bm.m('storage_rack', 11, 18, 0, stock=STOCK[0]); bm.m('storage_rack', 13, 20, 2, stock=STOCK[1]); bm.light((14, 18), (11, 20))
    bk = room(s, 'Bucket: the pod bay, a rack, the burst laser', 4, 19, 10, 25); bk.m('pod_bay', 5, 20, vehicle='vehicle.mining_pod'); bk.m('burstLaser', 5, 23); bk.m('storage_rack', 7, 24, 2, stock=STOCK[2])
    bk.light((9, 24), (8, 20))
    for d in [(15, 7), (22, 7), (26, 7), (16, 11), (22, 11), (26, 11), (28, 9), (13, 17), (10, 20)]: s.door(*d)
    return s



def tanker():
    s = Ship('TANKER', 36, 25, CREW, 'a corridor ship with round pods budding off it, each pod one job: ore tank, bunks, pod bay, galley')
    hull(s, pod(8, 4, 16, 11) + pod(19, 6, 26, 11) + pod(8, 15, 16, 22) + pod(19, 15, 26, 20))
    hull(s, [(x, 13 - min(4, x + 1), 13 + min(4, x + 1)) for x in range(1, 8)])
    room(s, 'Corridor', 7, 11, 27, 15).light((9, 13), (16, 13), (25, 13))
    s.section('Bridge (bow): helm and gun console')
    s.m('helm', 3, 11); s.m('weaponsConsole', 4, 14); s.lights((6, 12), (2, 14))
    s.section('Ore tank (north): the refinery and two ore bins')
    s.m('refinery', 10, 5); s.m('storage_ore', 13, 5); s.m('storage_ore', 14, 8); s.lights((10, 10), (15, 6), (13, 9))
    s.section('Bunk pod: three bunks and life support')
    for x in (21, 22, 23): s.m('bed', x, 7)
    s.m('lifeSupport', 24, 7); s.lights((21, 10), (24, 10))
    s.section('Pod tank (south): the pod bay, the burst laser')
    s.m('pod_bay', 9, 17, vehicle='vehicle.mining_pod'); s.m('burstLaser', 13, 20); s.lights((10, 21), (15, 17), (13, 16))
    s.section('Galley pod: galley and life support')
    s.m('galley', 21, 18, **GALLEY); s.m('lifeSupport', 24, 16); s.lights((21, 16), (24, 19))
    en = room(s, 'Engine room (north): an engine, a reactor, racks', 27, 4, 35, 13); en.m('engine', 31, 5, 1); en.m('reactor', 28, 5)
    en.m('storage_rack', 28, 11, 0, stock=STOCK[0]); en.m('storage_rack', 30, 11, 0, stock=STOCK[1]); en.light((28, 9), (33, 10))
    es = room(s, 'Engine room (south): an engine, a reactor, the shield, a rack, the airlock', 27, 13, 35, 22); es.m('engine', 31, 18, 1); es.m('reactor', 29, 15); es.m('shieldGen', 32, 14); es.m('airlock', 28, 19, 2)
    es.light((28, 14), (34, 16), (31, 17))
    for d in [(7, 13), (12, 11), (23, 11), (12, 15), (23, 15), (27, 12), (27, 14)]: s.door(*d)
    return s


def t_hauler():
    s = Ship('T-HAULER', 34, 28, CREW, 'a long neck from a small cab to a wide crossbar of holds: ore hold above, pod hangar below, engines between')
    hull(s, [(x, 14 - min(5, x + 2), 14 + min(5, x + 2)) for x in range(1, 10)])
    hline(s, 0, 9, 14)
    s.section('Bridge (cab, upper): helm, gun console, the burst laser')
    s.m('helm', 4, 10)
    s.m('weaponsConsole', 7, 10); s.lights((3, 13), (8, 13))
    s.section('Quarters (cab, lower): three bunks, life support, the burst laser')
    for x in (4, 5, 6): s.m('bed', x, 17)
    s.m('lifeSupport', 8, 17); s.m('burstLaser', 2, 15); s.lights((7, 15), (4, 16))
    room(s, 'Neck corridor', 9, 12, 22, 16).light((11, 14), (17, 14), (21, 14))
    ga = room(s, 'Galley', 12, 8, 18, 12); ga.m('galley', 13, 9, **GALLEY); ga.m('mess_table', 16, 9); ga.light((14, 11))
    sh = room(s, 'Shield and life support', 12, 16, 18, 20); sh.m('shieldGen', 13, 18); sh.m('lifeSupport', 16, 18); sh.light((17, 17))
    oh = room(s, 'Ore hold: refinery and ore bins', 22, 2, 33, 9); oh.m('refinery', 23, 3); oh.m('storage_ore_large', 27, 3); oh.m('storage_ore', 30, 3); oh.light((26, 8), (31, 8), (29, 6))
    er = room(s, 'Engine room: two engines, two reactors', 22, 9, 33, 19); er.m('engine', 29, 10, 1); er.m('engine', 29, 15, 1); er.m('reactor', 24, 10); er.m('reactor', 24, 16)
    er.light((23, 13), (27, 12), (27, 17), (32, 14))
    ph = room(s, 'Pod hangar: the pod bay, racks, the airlock', 22, 19, 33, 26); ph.m('pod_bay', 23, 20, vehicle='vehicle.mining_pod'); ph.m('storage_rack', 26, 20, 0, stock=STOCK[0])
    ph.m('storage_rack', 26, 25, 2, stock=STOCK[1]); ph.m('storage_rack', 28, 25, 2, stock=STOCK[2]); ph.m('airlock', 30, 23, 2); ph.light((23, 24), (29, 20), (32, 21))
    for d in [(9, 13), (9, 15), (15, 12), (15, 16), (22, 14), (27, 9), (28, 19)]: s.door(*d)
    return s


VARIANTS = [lambda: tagged(saddlebags(), 'new'), lambda: tagged(mining_train(), 'new'), lambda: tagged(excavator(), 'new'), lambda: tagged(tanker(), 'new'), lambda: tagged(t_hauler(), 'new')]

if __name__ == '__main__':
    write('prospectorR5', [v() for v in VARIANTS], 'Prospector variants, round 5: new concepts with proper rooms')
