"""Prospector variants, round 6: walkable hull shapes after FTL silhouettes, our own rooms (#241). Run: python3 tools/shipgen/starters/prospector.py"""
from common import *  # noqa: F401,F403

CREW = ['role.pilot', 'role.engineer', 'role.engineer']
STOCK = [STOCK_BUILD, [{'item': 'item.metal', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}, {'item': 'item.fuel', 'count': 16}], [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]]
RK = [('storage_rack', {'stock': STOCK[0]}), ('storage_rack', {'stock': STOCK[1]}), ('storage_rack', {'stock': STOCK[2]})]


def claw():
    s = Ship('CLAW', 30, 26, CREW, 'two jaws reach forward with hooked tips: the ore hold is the upper jaw, the pod hangar the lower; a hallway down the throat links them, with a branch aft to the engines')
    oh = room(s, 'Ore hold (upper jaw): refinery, ore bins, two racks', 4, 1, 17, 7); oh.m('storage_ore_large', 5, 2); oh.m('storage_ore', 9, 2); oh.m('refinery', 12, 2)
    oh.m('storage_rack', 7, 6, 2, stock=STOCK[1]); oh.m('storage_rack', 9, 6, 2, stock=STOCK[2]); oh.light((6, 5), (11, 6), (16, 6))
    ut = room(s, 'Upper claw tip: the burst laser', 1, 5, 4, 11); ut.m('burstLaser', 2, 9); ut.light((2, 6))
    ph = room(s, 'Pod hangar (lower jaw): the pod bay, a rack, the airlock', 4, 19, 17, 24); ph.m('pod_bay', 7, 20, vehicle='vehicle.mining_pod'); ph.m('airlock', 12, 21, 2)
    ph.m('storage_rack', 15, 20, stock=STOCK[0]); ph.light((5, 23), (10, 23), (16, 23))
    lt = room(s, 'Lower claw tip: the shield', 1, 16, 4, 22); lt.m('shieldGen', 2, 17); lt.light((2, 20))
    room(s, 'Throat hallway: jaw to jaw', 11, 7, 14, 19).light((12, 9), (13, 16))
    room(s, 'Aft hallway: throat to the engine room', 14, 11, 23, 14).light((17, 12), (21, 13))
    s.open(14, 12, 14, 13)
    br = room(s, 'Bridge: helm, gun console, life support', 14, 7, 23, 11); br.m('helm', 15, 8); br.m('weaponsConsole', 18, 8); br.m('lifeSupport', 22, 8); br.light((20, 10))
    qu = room(s, 'Quarters: three bunks, life support', 14, 14, 19, 19); qu.row(['bed', 'bed', 'bed'], x=16); qu.m('lifeSupport', 15, 17, 2); qu.light((17, 18))
    ga = room(s, 'Galley: galley, mess table', 19, 14, 23, 19); ga.m('galley', 20, 15, **GALLEY); ga.m('mess_table', 20, 18); ga.light((22, 16))
    er = room(s, 'Engine room: two engines, two reactors', 23, 6, 28, 20); er.m('engine', 24, 7, 1); er.m('engine', 24, 16, 1); er.m('reactor', 26, 12); er.m('reactor', 26, 14); er.light((25, 13), (27, 11))
    for d in [(4, 6), (4, 21), (12, 7), (12, 19), (17, 11), (15, 14), (22, 14), (23, 12)]: s.door(*d)
    return s


def hammerhead():
    s = Ship('HAMMERHEAD', 32, 26, CREW, 'a wide hammer head at the bow, ore hold above and pod hangar below the bridge, on a slim neck to the engines')
    oh = room(s, 'Ore hold (head, north): refinery and ore bins', 1, 1, 10, 9); oh.m('refinery', 2, 2); oh.m('storage_ore_large', 6, 2); oh.m('storage_ore', 6, 6); oh.light((3, 7), (9, 5), (9, 8))
    br = room(s, 'Bridge (head, middle): helm, gun console, the burst laser', 1, 9, 10, 15); br.m('helm', 2, 10); br.m('weaponsConsole', 7, 10); br.m('burstLaser', 2, 13); br.light((6, 13), (9, 13))
    ph = room(s, 'Pod hangar (head, south): the pod bay, a rack, the airlock', 1, 15, 10, 23); ph.m('pod_bay', 2, 16, vehicle='vehicle.mining_pod'); ph.m('storage_rack', 6, 16, stock=STOCK[0]); ph.m('airlock', 6, 20, 2)
    ph.light((3, 21), (9, 18))
    room(s, 'Neck corridor', 10, 10, 24, 14).light((12, 12), (18, 12), (23, 12))
    qu = room(s, 'Quarters: three bunks, life support', 12, 6, 18, 10); qu.m('bed', 13, 7); qu.m('bed', 14, 7); qu.m('bed', 16, 7); qu.m('lifeSupport', 17, 7); qu.light((13, 9))
    ga = room(s, 'Galley: galley, mess table', 18, 6, 24, 10); ga.row([('galley', GALLEY), 'mess_table']); ga.light((23, 9))
    sh = room(s, 'Shield room: the shield, life support', 12, 14, 17, 18); sh.m('shieldGen', 13, 16); sh.m('lifeSupport', 16, 16); sh.light((15, 15))
    st = room(s, 'Stores: racks', 17, 14, 24, 18); st.row(RK[1:], wall='s'); st.light((23, 16))
    er = room(s, 'Engine room: two engines, two reactors', 24, 5, 30, 19); er.m('engine', 26, 6, 1); er.m('engine', 26, 15, 1); er.m('reactor', 28, 11); er.m('reactor', 28, 13); er.light((26, 12), (25, 7), (25, 17))
    for d in [(5, 9), (5, 15), (10, 12), (15, 10), (21, 10), (14, 14), (20, 14), (24, 12)]: s.door(*d)
    return s


def boulder():
    s = Ship('BOULDER', 33, 24, CREW, 'a lumpy rock of a hull: rooms of every height bulge off one central hallway, like the knobs of an asteroid')
    br = room(s, 'Bridge (bow): helm, gun console, the burst laser', 1, 8, 6, 17); br.m('helm', 2, 9); br.m('weaponsConsole', 2, 12); br.m('burstLaser', 4, 15); br.light((4, 12), (2, 16))
    room(s, 'Hallway', 6, 11, 26, 14).light((8, 12), (15, 13), (22, 12))
    qu = room(s, 'Quarters: three bunks, life support', 6, 5, 12, 11); qu.row(['bed', 'bed', 'bed']); qu.m('lifeSupport', 11, 6); qu.light((8, 9))
    oh = room(s, 'Ore hold: refinery and ore bins', 12, 2, 21, 11); oh.m('refinery', 13, 3); oh.m('storage_ore_large', 17, 3); oh.m('storage_ore', 17, 7); oh.light((14, 9), (20, 6), (20, 9))
    ga = room(s, 'Galley: galley, mess table', 21, 6, 26, 11); ga.row([('galley', GALLEY), 'mess_table']); ga.light((24, 9))
    sh = room(s, 'Shield room: the shield, life support', 6, 14, 11, 18); sh.m('shieldGen', 7, 16); sh.m('lifeSupport', 10, 16); sh.light((9, 15))
    ph = room(s, 'Pod hangar: the pod bay, a rack, the airlock', 11, 14, 20, 22); ph.m('pod_bay', 12, 15, vehicle='vehicle.mining_pod'); ph.m('storage_rack', 17, 15, stock=STOCK[0]); ph.m('airlock', 16, 19, 2)
    ph.light((13, 20), (19, 18))
    st = room(s, 'Stores: racks', 20, 14, 26, 19); st.row(RK[1:], wall='s'); st.light((24, 16))
    er = room(s, 'Engine room: two engines, two reactors', 26, 4, 31, 20); er.m('engine', 27, 5, 1); er.m('engine', 27, 16, 1); er.m('reactor', 29, 11); er.m('reactor', 29, 13); er.light((28, 10), (28, 14))
    for d in [(6, 12), (9, 11), (15, 11), (23, 11), (8, 14), (16, 14), (23, 14), (26, 12)]: s.door(*d)
    return s


def drill():
    s = Ship('DRILL', 34, 25, CREW, 'a cone that widens in steps from a drill-bit nose to a broad engine block, one corridor down the axis')
    hull(s, [(x, 12 - min(5, x + 1), 13 + min(5, x + 1)) for x in range(1, 8)])
    vline(s, 7, 7, 18)
    s.section('Bridge (drill-bit nose): helm, gun console, the burst laser')
    s.m('helm', 2, 12); s.m('weaponsConsole', 5, 8); s.m('burstLaser', 5, 16); s.lights((4, 10), (6, 14), (2, 11), (4, 16))
    room(s, 'Axis corridor', 7, 11, 27, 14).light((8, 12), (15, 13), (22, 12))
    qu = room(s, 'Quarters: three bunks, life support', 7, 7, 13, 11); qu.row(['bed', 'bed', 'bed']); qu.m('lifeSupport', 12, 8); qu.light((9, 10))
    ga = room(s, 'Galley: galley, mess table, life support', 7, 14, 13, 18); ga.row([('galley', GALLEY), 'mess_table'], wall='s'); ga.m('lifeSupport', 12, 16); ga.light((9, 15))
    oh = room(s, 'Ore hold: refinery and ore bins', 13, 5, 21, 11); oh.m('refinery', 14, 6); oh.m('storage_ore_large', 17, 6); oh.m('storage_ore', 19, 9, 2); oh.light((15, 10), (20, 8))
    ph = room(s, 'Pod hangar: the pod bay, a rack, the airlock', 13, 14, 21, 20); ph.m('pod_bay', 14, 15, vehicle='vehicle.mining_pod'); ph.m('storage_rack', 18, 15, stock=STOCK[0]); ph.m('airlock', 18, 17, 2)
    ph.light((15, 19), (17, 18))
    sh = room(s, 'Shield room: the shield', 21, 3, 27, 8); sh.m('shieldGen', 22, 4); sh.light((25, 6))
    st = room(s, 'Stores: racks', 21, 8, 27, 11); st.m('storage_rack', 22, 9, stock=STOCK[1]); st.m('storage_rack', 25, 9, stock=STOCK[2]); st.light((24, 10))
    rr = room(s, 'Reactor room: two reactors', 21, 14, 27, 21); rr.m('reactor', 22, 15); rr.m('reactor', 22, 18); rr.light((25, 17))
    er = room(s, 'Engine room: two engines', 27, 2, 32, 22); er.m('engine', 28, 3, 1); er.m('engine', 28, 18, 1); er.light((29, 8), (29, 12), (29, 16))
    for d in [(7, 13), (10, 11), (10, 14), (16, 11), (17, 14), (24, 8), (24, 11), (24, 14), (27, 12)]: s.door(*d)
    return s


VARIANTS = [lambda: tagged(claw(), 'riff'), lambda: tagged(hammerhead(), 'new'), lambda: tagged(boulder(), 'new'), lambda: tagged(drill(), 'new')]

if __name__ == '__main__':
    write('prospector', [v() for v in VARIANTS], 'Prospector variants, round 6: walkable hull shapes after FTL silhouettes')
