"""Lancer variants, round 6: walkable hull shapes after FTL silhouettes, our own rooms (#241). Run: python3 tools/shipgen/starters/lancer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.gunner', 'role.gunner', 'role.pilot', 'role.engineer']
HOLD = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 60}, {'item': 'item.ice', 'count': 10}, {'item': 'item.missile', 'count': 16}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]
ST = [('storage', {'stock': HOLD[0]}), ('storage', {'stock': HOLD[1]}), ('storage', {'stock': HOLD[2]})]


def trident():
    s = Ship('TRIDENT', 36, 27, CREW, 'three tines reach forward from a crossbar hallway, a gun gallery in each; the crew block and engines make the shaft')
    nt = room(s, 'North tine: a burst laser, a locker', 4, 2, 12, 6); nt.m('burstLaser', 5, 3); nt.m('storage', 11, 3, stock=HOLD[0]); nt.light((8, 4))
    mt = room(s, 'Middle tine: the missile launcher, a locker', 1, 10, 12, 16); mt.m('missileLauncher', 2, 12); mt.m('storage', 11, 11, stock=HOLD[1]); mt.light((7, 13), (3, 11))
    stn = room(s, 'South tine: a burst laser, a locker', 4, 20, 12, 24); stn.m('burstLaser', 5, 22); stn.m('storage', 11, 21, stock=HOLD[2]); stn.light((8, 22))
    room(s, 'Crossbar hallway', 12, 2, 15, 24).light((13, 4), (13, 9), (13, 14), (13, 19), (13, 23))
    room(s, 'Shaft corridor', 15, 12, 29, 15).light((17, 13), (23, 14), (28, 13))
    br = room(s, 'Bridge: helm and shield console', 15, 6, 20, 12); br.m('helm', 16, 7); br.m('shieldConsole', 16, 10, 2); br.light((19, 8))
    sh = room(s, 'Shield room: the Mk II shield, life support', 20, 6, 24, 12); sh.m('shieldGen.mk2', 21, 7); sh.m('lifeSupport', 23, 7); sh.light((22, 11))
    gc = room(s, 'Gun control: both gun consoles', 24, 6, 29, 12); gc.m('weaponsConsole', 25, 7); gc.m('weaponsConsole', 27, 7); gc.light((26, 10))
    qu = room(s, 'Quarters: four bunks', 15, 15, 21, 20); qu.row(['bed', 'bed', 'bed', 'bed'], wall='s'); qu.light((19, 16))
    ga = room(s, 'Galley: galley, life support', 21, 15, 25, 20); ga.m('galley', 22, 16, **GALLEY); ga.m('lifeSupport', 24, 18); ga.light((22, 18))
    al = room(s, 'Airlock', 25, 15, 29, 20); al.m('airlock', 26, 17, 2); al.light((26, 16))
    er = room(s, 'Engine room: two engines, two reactors', 29, 6, 34, 20); er.m('engine', 30, 7, 1); er.m('engine', 30, 16, 1); er.m('reactor', 31, 11); er.m('reactor', 31, 14); er.light((30, 13), (33, 13))
    for d in [(12, 4), (12, 13), (12, 22), (15, 13), (15, 17), (19, 12), (22, 12), (26, 12), (18, 15), (24, 15), (27, 15), (29, 13)]: s.door(*d)
    return s


def shrike():
    s = Ship('SHRIKE', 36, 30, CREW, 'two blades sweep back from the middle of a slim body, each a gun gallery stepping out to a laser at its tip')
    hull(s, [(x, 15 - min(5, x + 1), 15 + min(5, x + 1)) for x in range(1, 8)])
    vline(s, 7, 9, 21)
    s.section('Missile room (nose): the missile launcher'); s.m('missileLauncher', 2, 14); s.lights((5, 12), (5, 18))
    room(s, 'Corridor', 7, 14, 29, 16).light((9, 15), (15, 15), (21, 15), (27, 15))
    br = room(s, 'Bridge: helm and shield console', 7, 10, 14, 14); br.m('helm', 8, 11); br.m('shieldConsole', 11, 11); br.light((13, 13))
    gc = room(s, 'Gun control: both gun consoles', 14, 10, 20, 14); gc.m('weaponsConsole', 15, 11); gc.m('weaponsConsole', 18, 11); gc.light((19, 13))
    qu = room(s, 'Quarters: four bunks', 20, 10, 25, 14); qu.row(['bed', 'bed', 'bed', 'bed']); qu.light((22, 13))
    sh = room(s, 'Shield room: the Mk II shield, life support', 25, 10, 29, 14); sh.m('shieldGen.mk2', 26, 11); sh.m('lifeSupport', 28, 11); sh.light((28, 13))
    al = room(s, 'Airlock', 7, 16, 12, 20); al.m('airlock', 8, 17, 2); al.light((11, 18))
    ga = room(s, 'Galley', 12, 16, 16, 20); ga.m('galley', 13, 17, **GALLEY); ga.light((14, 19))
    mg = room(s, 'Magazine: stores, life support', 16, 16, 22, 20); mg.row(ST, x=17); mg.m('lifeSupport', 21, 17); mg.light((18, 19))
    rr = room(s, 'Reactor room: two reactors', 22, 16, 29, 20); rr.m('reactor', 23, 17); rr.m('reactor', 26, 17); rr.light((25, 19), (28, 18))
    ng = room(s, 'North blade, root: gallery', 14, 6, 21, 10); ng.light((17, 8))
    nt = room(s, 'North blade, tip: a burst laser', 21, 3, 28, 8); nt.m('burstLaser', 26, 4); nt.light((23, 6))
    sg = room(s, 'South blade, root: gallery', 14, 20, 21, 24); sg.light((17, 22))
    stp = room(s, 'South blade, tip: a burst laser', 21, 22, 28, 27); stp.m('burstLaser', 26, 25); stp.light((23, 24))
    er = room(s, 'Engine room: two engines, a reactor', 29, 9, 34, 21); er.m('engine', 30, 10, 1); er.m('engine', 30, 17, 1); er.m('reactor', 32, 14); er.light((31, 15))
    for d in [(7, 15), (10, 14), (17, 14), (24, 14), (28, 14), (11, 16), (15, 16), (20, 16), (25, 16), (17, 10), (21, 7), (20, 20), (21, 23), (29, 15)]: s.door(*d)
    return s


def gem():
    s = Ship('CUT GEM', 35, 29, CREW, 'a faceted gem: columns of rooms rise from a pointed bow to a tall middle and fall back to a flat stern')
    no = room(s, 'Missile room (bow): the missile launcher', 1, 12, 7, 18); no.m('missileLauncher', 2, 14); no.light((5, 13), (5, 17))
    room(s, 'Corridor', 7, 14, 28, 16).light((9, 15), (16, 15), (22, 15), (27, 15))
    br = room(s, 'Bridge: helm and shield console', 7, 8, 14, 14); br.m('helm', 8, 9); br.m('shieldConsole', 11, 9); br.light((12, 12))
    ga = room(s, 'Galley: galley, mess table, life support', 7, 16, 14, 22); ga.row([('galley', GALLEY), 'mess_table']); ga.m('lifeSupport', 13, 17); ga.light((9, 20))
    nt = room(s, 'North turret: a burst laser', 14, 4, 21, 8); nt.m('burstLaser', 15, 5); nt.light((19, 6))
    gc = room(s, 'Gun control: both gun consoles', 14, 8, 21, 14); gc.m('weaponsConsole', 15, 9); gc.m('weaponsConsole', 18, 9); gc.light((16, 12))
    mg = room(s, 'Magazine: stores', 14, 16, 21, 22); mg.m('storage', 15, 17, stock=HOLD[0]); mg.m('storage', 16, 17, stock=HOLD[1]); mg.m('storage', 18, 17, stock=HOLD[2]); mg.light((19, 20))
    stt = room(s, 'South turret: a burst laser', 14, 22, 21, 26); stt.m('burstLaser', 15, 24); stt.light((19, 24))
    qu = room(s, 'Quarters: four bunks, life support', 21, 6, 28, 14); qu.row(['bed', 'bed', 'bed', 'bed']); qu.m('lifeSupport', 27, 7); qu.light((23, 12))
    sh = room(s, 'Shield room: the Mk II shield, life support', 21, 16, 28, 20); sh.m('shieldGen.mk2', 22, 17); sh.m('lifeSupport', 27, 17); sh.light((25, 18))
    al = room(s, 'Airlock', 21, 20, 28, 24); al.m('airlock', 23, 21, 2); al.light((22, 22), (27, 22))
    er = room(s, 'Engine room: two engines, three reactors', 28, 8, 33, 22); er.m('engine', 29, 9, 1); er.m('engine', 29, 18, 1); er.m('reactor', 29, 13); er.m('reactor', 31, 13); er.m('reactor', 31, 15)
    er.light((29, 16), (30, 15))
    for d in [(7, 15), (10, 14), (12, 16), (17, 8), (17, 14), (17, 16), (17, 22), (24, 14), (24, 16), (26, 20), (28, 15)]: s.door(*d)
    return s


def dart():
    s = Ship('DART', 39, 23, CREW, 'a long thin dart: the missile in its point, crew rooms (two quarters, a sick bay by gun control) down one straight corridor, a laser in each of two tail fins')
    hull(s, [(x, 11 - min(4, x // 2 + 1), 11 + min(4, x // 2 + 1)) for x in range(2, 8)])
    vline(s, 7, 6, 16)
    s.section('Missile room (point): the missile launcher'); s.m('missileLauncher', 3, 10); s.lights((5, 9), (5, 13))
    room(s, 'Corridor', 7, 10, 32, 12).light((9, 11), (16, 11), (23, 11), (30, 11))
    br = room(s, 'Bridge: helm and shield console', 7, 6, 14, 10); br.m('helm', 8, 7); br.m('shieldConsole', 11, 7); br.light((13, 9))
    gc = room(s, 'Gun control and sick bay: the gun console, a med bed', 14, 6, 19, 10); gc.m('weaponsConsole', 15, 7); gc.m('med_bed', 17, 7); gc.light((18, 9))
    qa = room(s, 'Quarters A: two bunks', 19, 6, 22, 10); qa.row(['bed', 'bed']); qa.light((21, 9))
    qb = room(s, 'Quarters B: two bunks', 22, 6, 25, 10); qb.row(['bed', 'bed']); qb.light((24, 9))
    sh = room(s, 'Shield room: the Mk II shield, life support', 25, 6, 32, 10); sh.m('shieldGen.mk2', 26, 7); sh.m('lifeSupport', 31, 7); sh.light((29, 9))
    nf = room(s, 'North tail fin: a burst laser', 24, 1, 31, 6); nf.m('burstLaser', 29, 2); nf.light((26, 4))
    al = room(s, 'Airlock', 7, 12, 12, 16); al.m('airlock', 8, 13, 2); al.light((11, 14))
    ga = room(s, 'Galley: galley, life support', 12, 12, 17, 16); ga.m('galley', 13, 13, **GALLEY); ga.m('lifeSupport', 16, 13); ga.light((14, 15))
    mg = room(s, 'Magazine: stores', 17, 12, 24, 16); mg.row(ST, x=18); mg.light((22, 15))
    rr = room(s, 'Reactor room: two reactors, life support', 24, 12, 32, 16); rr.m('reactor', 25, 13); rr.m('reactor', 29, 13); rr.m('lifeSupport', 31, 13); rr.light((27, 15))
    sf = room(s, 'South tail fin: a burst laser', 24, 16, 31, 21); sf.m('burstLaser', 29, 19); sf.light((26, 18))
    er = room(s, 'Engine room: two engines, a reactor', 32, 5, 37, 17); er.m('engine', 33, 6, 1); er.m('engine', 33, 13, 1); er.m('reactor', 35, 10); er.light((33, 11))
    for d in [(7, 11), (10, 10), (16, 10), (20, 10), (23, 10), (28, 10), (28, 6), (11, 12), (15, 12), (22, 12), (27, 12), (28, 16), (32, 11)]: s.door(*d)
    return s


VARIANTS = [lambda: tagged(trident(), 'riff'), lambda: tagged(shrike(), 'new'), lambda: tagged(gem(), 'new'), lambda: tagged(dart(), 'new')]

if __name__ == '__main__':
    write('lancer', [v() for v in VARIANTS], 'Lancer variants, round 6: walkable hull shapes after FTL silhouettes')
