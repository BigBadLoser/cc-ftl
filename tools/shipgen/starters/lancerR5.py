"""Lancer variants, round 5: new concepts with proper rooms, no containers (#241). Run: python3 tools/shipgen/starters/lancer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.gunner', 'role.gunner', 'role.pilot', 'role.engineer']
HOLD = [STOCK_BUILD, [{'item': 'item.metal', 'count': 60}, {'item': 'item.ice', 'count': 10}, {'item': 'item.missile', 'count': 16}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]
ST = [('storage', {'stock': HOLD[0]}), ('storage', {'stock': HOLD[1]}), ('storage', {'stock': HOLD[2]})]


def broadside():
    s = Ship('BROADSIDE', 35, 23, CREW, 'three gun turrets stand off one flank like a comb: a broadside ship, crew decks along the other side')
    hull(s, [(x, 14 - min(5, x + 1), 14 + min(5, x + 1)) for x in range(1, 9)])
    s.section('Bridge (bow): helm and shield console')
    s.m('helm', 5, 10); s.m('shieldConsole', 4, 16, 2); s.lights((7, 13), (3, 13), (3, 15))
    room(s, 'Corridor', 8, 12, 29, 16).light((10, 14), (18, 14), (26, 14))
    g1 = room(s, 'Turret 1: burst laser', 9, 2, 14, 8); g1.m('burstLaser', 10, 3); g1.light((13, 7))
    g2 = room(s, 'Turret 2: missile launcher', 16, 2, 22, 8); g2.m('missileLauncher', 17, 3); g2.light((21, 7))
    g3 = room(s, 'Turret 3: burst laser', 24, 2, 29, 8); g3.m('burstLaser', 25, 3); g3.light((28, 7))
    gc = room(s, 'Gun control: both gun consoles', 8, 8, 16, 12); gc.m('weaponsConsole', 9, 9); gc.m('weaponsConsole', 12, 9); gc.light((15, 11))
    ls = room(s, 'Life support and a reactor', 16, 8, 22, 12); ls.m('lifeSupport', 17, 9); ls.m('reactor', 18, 9); ls.light((21, 11))
    st = room(s, 'Ready room: stores', 22, 8, 29, 12); st.row(ST); st.light((28, 11))
    qu = room(s, 'Quarters: four bunks', 8, 16, 15, 21); qu.row(['bed', 'bed', 'bed', 'bed'], wall='s'); qu.light((13, 17))
    ga = room(s, 'Galley and life support', 15, 16, 21, 21); ga.row([('galley', GALLEY), 'lifeSupport'], wall='s'); ga.light((19, 17))
    sh = room(s, 'Shield room: the Mk II shield', 21, 16, 25, 21); sh.m('shieldGen.mk2', 22, 18); sh.light((24, 17))
    al = room(s, 'Airlock', 25, 16, 29, 21); al.m('airlock', 26, 18, 2); al.light((26, 17))
    er = room(s, 'Engine room: two engines, a reactor', 29, 8, 34, 20); er.m('engine', 30, 9, 1); er.m('engine', 30, 16, 1); er.m('reactor', 32, 13)
    er.light((30, 13), (31, 14), (30, 15))
    for d in [(8, 13), (8, 15), (11, 8), (21, 8), (27, 8), (14, 12), (20, 12), (27, 12), (11, 16), (18, 16), (23, 16), (27, 16), (29, 14)]: s.door(*d)
    return s


def shark():
    s = Ship('SHARK', 36, 27, CREW, 'a pointed snout with the missile, a raked dorsal fin, a pectoral fin with a laser, a straight tail of engines')
    hull(s, [(x, 13 - min(6, x), 13 + min(6, x)) for x in range(1, 10)])
    hull(s, [(x, max(1, 8 - (x - 16)), 8) for x in range(16, 28)])
    hull(s, [(x, 18, 22 if x <= 12 else 23) for x in range(10, 19)])
    vline(s, 9, 0, 26)
    s.section('Snout: the missile launcher and both gun consoles')
    s.m('missileLauncher', 5, 12); s.m('weaponsConsole', 6, 9); s.m('weaponsConsole', 6, 15); s.lights((3, 13), (8, 12), (8, 15))
    room(s, 'Corridor', 9, 11, 28, 15).light((11, 13), (19, 13), (26, 13))
    br = room(s, 'Bridge: helm and shield console', 9, 7, 16, 11); br.m('helm', 10, 8); br.m('shieldConsole', 13, 8); br.light((15, 10))
    ga = room(s, 'Galley', 16, 7, 22, 11); ga.row([('galley', GALLEY), 'mess_table']); ga.light((21, 10))
    ls = room(s, 'Life support and the Mk II shield', 22, 7, 28, 11); ls.row(['lifeSupport', 'lifeSupport'], x=24); ls.m('shieldGen.mk2', 26, 8); ls.light((23, 10))
    s.section('Dorsal fin: a burst laser'); s.m('burstLaser', 25, 3); s.lights((22, 6), (26, 6))
    qu = room(s, 'Quarters: four bunks', 9, 15, 16, 19); qu.row(['bed', 'bed', 'bed', 'bed'], x=12, wall='s'); qu.light((10, 16))
    st = room(s, 'Stores', 16, 15, 22, 19); st.row(ST, wall='s'); st.light((20, 16))
    al = room(s, 'Airlock', 22, 15, 28, 19); al.m('airlock', 24, 16, 2); al.light((23, 16))
    s.section('Pectoral fin: a burst laser'); s.m('burstLaser', 16, 20); s.lights((12, 21), (15, 22))
    er = room(s, 'Engine room: two engines, two reactors', 28, 7, 35, 19); er.m('engine', 31, 8, 1); er.m('engine', 31, 15, 1); er.m('reactor', 29, 8); er.m('reactor', 29, 17)
    er.light((29, 12), (33, 13), (30, 14))
    for d in [(9, 13), (12, 11), (19, 11), (25, 11), (12, 15), (19, 15), (23, 15), (28, 13), (23, 7), (12, 19)]: s.door(*d)
    return s


def halberd():
    s = Ship('HALBERD', 38, 24, CREW, 'a long shaft with an axe blade hung under the bow (two lasers on its edge) and a missile spike at the tip')
    sp = room(s, 'Spike: the missile launcher', 1, 7, 10, 13); sp.m('missileLauncher', 2, 9); sp.light((8, 8), (8, 12))
    room(s, 'Shaft corridor', 10, 9, 32, 13).light((12, 11), (20, 11), (28, 11))
    gc = room(s, 'Gun control (axe head): both gun consoles', 4, 13, 14, 17); gc.m('weaponsConsole', 5, 14); gc.m('weaponsConsole', 8, 14); gc.light((12, 15), (7, 16))
    ax = room(s, 'Axe blade: two burst lasers on the edge', 4, 17, 14, 23); ax.m('burstLaser', 5, 20); ax.m('burstLaser', 9, 21); ax.light((12, 19), (6, 18))
    br = room(s, 'Bridge: helm and shield console', 10, 5, 17, 9); br.m('helm', 11, 6); br.m('shieldConsole', 14, 6); br.light((16, 8))
    ga = room(s, 'Galley', 17, 5, 22, 9); ga.row([('galley', GALLEY), 'mess_table']); ga.light((21, 8))
    qu = room(s, 'Quarters: four bunks', 22, 5, 28, 9); qu.row(['bed', 'bed', 'bed', 'bed']); qu.light((27, 8))
    sh = room(s, 'Shield room: the Mk II shield', 28, 4, 32, 9); sh.m('shieldGen.mk2', 29, 5); sh.light((31, 8))
    st = room(s, 'Stores', 14, 13, 20, 17); st.row(ST, wall='s'); st.light((18, 14))
    ls = room(s, 'Life support', 20, 13, 25, 17); ls.row(['lifeSupport', 'lifeSupport'], wall='s'); ls.light((23, 14))
    al = room(s, 'Airlock and a reactor', 25, 13, 32, 17); al.m('airlock', 26, 14, 2); al.m('reactor', 29, 15); al.light((30, 14))
    er = room(s, 'Engine room: two engines, two reactors', 32, 4, 37, 18); er.m('engine', 33, 5, 1); er.m('engine', 33, 14, 1); er.m('reactor', 33, 9); er.m('reactor', 35, 9)
    er.light((33, 12), (36, 12), (34, 11))
    for d in [(10, 11), (12, 13), (12, 17), (13, 9), (19, 9), (25, 9), (30, 9), (17, 13), (22, 13), (27, 13), (32, 12)]: s.door(*d)
    return s


def star():
    s = Ship('STAR', 33, 33, CREW, 'a plus-shaped star: a gun at the end of three arms, the engines in the fourth, crew in the middle')
    hub = room(s, 'Command hub: gun and shield consoles', 12, 12, 20, 20); hub.m('weaponsConsole', 13, 13); hub.m('weaponsConsole', 17, 13); hub.m('shieldConsole', 14, 17, 2); hub.light((16, 16), (13, 19), (19, 19))
    nt = room(s, 'North turret: a burst laser', 13, 2, 19, 7); nt.m('burstLaser', 15, 3); nt.light((14, 6), (18, 6))
    nq = room(s, 'Quarters: four bunks', 13, 7, 19, 12); nq.row(['bed', 'bed', 'bed', 'bed']); nq.light((18, 11))
    sg = room(s, 'Galley and life support', 13, 20, 19, 25); sg.m('galley', 14, 24, 2, **GALLEY); sg.m('lifeSupport', 17, 23); sg.m('lifeSupport', 18, 23); sg.light((14, 21))
    stt = room(s, 'South turret: a burst laser and stores', 13, 25, 19, 30); stt.m('burstLaser', 15, 28)
    for x, it in zip((14, 17, 18), ST): stt.m(it[0], x, 26, 0, **it[1])
    stt.light((18, 29), (14, 29))
    wt = room(s, 'West turret: the missile launcher', 2, 13, 8, 19); wt.m('missileLauncher', 3, 15); wt.light((7, 14), (7, 18))
    wb = room(s, 'Bridge: the helm', 8, 13, 12, 19); wb.m('helm', 9, 14); wb.light((10, 18))
    ea = room(s, 'Engine arm, inboard: three reactors, the Mk II shield, the airlock', 20, 10, 26, 22)
    ea.m('reactor', 21, 11); ea.m('reactor', 21, 20); ea.m('reactor', 23, 15); ea.m('shieldGen.mk2', 24, 11); ea.m('airlock', 23, 19, 2); ea.light((21, 14), (25, 17))
    eo = room(s, 'Engine room: two engines', 26, 10, 32, 22); eo.m('engine', 28, 11, 1); eo.m('engine', 28, 18, 1); eo.light((27, 13), (29, 16), (27, 20))
    for d in [(16, 7), (16, 12), (16, 20), (16, 25), (8, 16), (12, 16), (20, 16), (26, 16)]: s.door(*d)
    return s



def zig():
    s = Ship('ZIGZAG', 36, 27, CREW, 'three blocks stepping down corner to corner: guns and bridge up front, crew amidships, engines low at the back')
    wb = room(s, 'Weapons bay: the missile launcher and two burst lasers', 1, 2, 8, 12); wb.m('missileLauncher', 2, 6); wb.m('burstLaser', 5, 3); wb.m('burstLaser', 5, 10)
    wb.light((7, 7), (2, 3), (2, 11))
    br = room(s, 'Bridge: helm and shield console', 8, 2, 13, 8); br.m('helm', 9, 3); br.m('shieldConsole', 9, 6); br.light((12, 5))
    gc = room(s, 'Gun control: both gun consoles', 8, 8, 13, 12); gc.m('weaponsConsole', 9, 9); gc.m('weaponsConsole', 11, 9); gc.light((12, 11))
    room(s, 'Hall', 13, 10, 24, 14).light((15, 12), (21, 12))
    qu = room(s, 'Quarters: four bunks and the airlock', 11, 14, 17, 19)
    for x, y in ((12, 15), (12, 17), (16, 15), (16, 17)): qu.m('bed', x, y)
    qu.m('airlock', 13, 16, 2); qu.light((14, 15))
    ga = room(s, 'Galley and life support', 17, 14, 24, 19); ga.m('galley', 18, 15, **GALLEY); ga.m('mess_table', 20, 17); ga.m(ST[2][0], 20, 15, 0, **ST[2][1]); ga.m('lifeSupport', 22, 15); ga.light((19, 18), (23, 18))
    sh = room(s, 'Shield room: the Mk II shield, life support, stores', 24, 14, 29, 19); sh.m('shieldGen.mk2', 27, 15); sh.m('lifeSupport', 25, 17)
    for x, it in zip((25, 26), ST): sh.m(it[0], x, 15, 0, **it[1])
    sh.light((28, 18))
    rr = room(s, 'Reactor room: two reactors', 24, 19, 29, 25); rr.m('reactor', 27, 20); rr.m('reactor', 27, 22)
    rr.light((25, 20), (26, 23))
    er = room(s, 'Engine room: two engines and a reactor', 29, 14, 35, 25); er.m('engine', 31, 15, 1); er.m('engine', 31, 21, 1); er.m('reactor', 33, 19); er.light((30, 17), (31, 20))
    for d in [(8, 5), (8, 10), (13, 11), (14, 14), (21, 14), (24, 16), (26, 19), (29, 24)]: s.door(*d)
    return s


VARIANTS = [lambda: tagged(broadside(), 'new'), lambda: tagged(shark(), 'new'), lambda: tagged(halberd(), 'new'), lambda: tagged(star(), 'new'), lambda: tagged(zig(), 'new')]

if __name__ == '__main__':
    write('lancerR5', [v() for v in VARIANTS], 'Lancer variants, round 5: new concepts with proper rooms')
