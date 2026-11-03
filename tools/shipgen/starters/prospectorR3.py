"""Prospector variants (#241). Run: python3 tools/shipgen/starters/prospector.py"""
from common import *  # noqa: F401,F403

CREW = ['role.pilot', 'role.engineer', 'role.engineer']
STOCK = [STOCK_BUILD, [{'item': 'item.metal', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}, {'item': 'item.fuel', 'count': 16}], [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]]

def claw():
    s = Ship('P2 CLAW', 34, 27, CREW, 'mining claw: ore jaws either side of the pod bay mouth')
    cols = []
    for x in range(2, 33):
        if x <= 14:
            cols.append((x, 6, 10) if x <= 5 else (x, 3, 9))
            cols.append((x, 16, 20) if x <= 5 else (x, 17, 23))
        if x >= 14: cols.append((x, 5, 21))
    hull(s, cols)
    vline(s, 14, 0, 26); vline(s, 21, 0, 26); vline(s, 27, 0, 26); hline(s, 21, 27, 12)
    for d in [(14, 7), (14, 19), (21, 9), (21, 16), (24, 12), (27, 11), (27, 15)]: s.door(*d)
    # north jaw: refinery and an ore bin
    s.m('refinery', 7, 4); s.m('storage_ore', 10, 4); s.m('storage_ore', 12, 4)
    s.lights((4, 7), (10, 8), (13, 8))
    # south jaw: the laser in the tip, big ore bin, pallet and racks
    s.m('burstLaser', 3, 17); s.m('storage_ore_large', 8, 18); s.m('storage_pallet', 11, 18)
    for (x, y), st in zip([(7, 21), (9, 21), (11, 21)], STOCK): s.m('storage_rack', x, y, 0, stock=st)
    s.lights((5, 19), (10, 20), (13, 22))
    # hold: the pod bay faces the mouth
    s.m('pod_bay', 15, 12, vehicle='vehicle.mining_pod'); s.m('airlock', 17, 5); s.m('shieldGen', 19, 17); s.m('lifeSupport', 20, 13)
    s.lights((15, 7), (19, 10), (15, 17), (19, 20), (16, 15))
    # bridge (north) and quarters (south)
    s.m('helm', 23, 6); s.m('weaponsConsole', 24, 9); s.m('lifeSupport', 26, 6)
    s.lights((22, 6), (22, 10))
    for x in (22, 23, 24): s.m('bed', x, 18)
    s.m('galley', 22, 13, **GALLEY); s.m('mess_table', 24, 15); s.m('chair', 24, 14, 2); s.m('chair', 25, 14, 2); s.m('chair', 24, 16); s.m('chair', 25, 16)
    s.m('lifeSupport', 26, 18)
    s.lights((26, 14), (22, 17), (25, 20))
    # engine room
    s.m('engine', 28, 6, 1); s.m('engine', 28, 17, 1); s.m('reactor', 28, 12); s.m('reactor', 30, 12)
    s.lights((28, 10), (31, 11), (29, 15))
    return s



def claw_body(b):
    """The claw's body (hold with the pod bay facing the mouth, bridge, quarters, engine room): x 14..32, y 5..21."""
    b.hull([(x, 5, 21) for x in range(14, 33)])
    b.vline(14, 5, 21); b.vline(21, 5, 21); b.vline(27, 5, 21); b.hline(21, 27, 12)
    for d in [(21, 9), (21, 16), (24, 12), (27, 11), (27, 15)]: b.door(*d)
    b.section('Hold: the pod bay faces the mouth; airlock, shield, life support')
    b.m('pod_bay', 15, 12, vehicle='vehicle.mining_pod'); b.m('airlock', 17, 5); b.m('shieldGen', 19, 17); b.m('lifeSupport', 20, 13)
    b.lights((15, 7), (19, 10), (15, 17), (19, 20), (16, 15))
    b.section('Bridge (north) and quarters (south)')
    b.m('helm', 23, 6); b.m('weaponsConsole', 24, 9); b.m('lifeSupport', 26, 6)
    b.lights((22, 6), (22, 10))
    for x in (22, 23, 24): b.m('bed', x, 18)
    b.m('galley', 22, 13, **GALLEY); b.m('mess_table', 24, 15); b.m('chair', 24, 14, 2); b.m('chair', 25, 14, 2); b.m('chair', 24, 16); b.m('chair', 25, 16)
    b.m('lifeSupport', 26, 18)
    b.lights((26, 14), (22, 17), (25, 20))
    b.section('Engine room')
    b.m('engine', 28, 6, 1); b.m('engine', 28, 17, 1); b.m('reactor', 28, 12); b.m('reactor', 30, 12)
    b.lights((28, 10), (31, 11), (29, 15))


def long_jaws():
    L = 5
    s = Ship('P2A LONG JAWS', 39, 27, CREW, 'riff: jaws five tiles longer, a deep mouth, more ore bins and pallets in the jaws')
    cols = []
    for x in range(2, 15 + L):
        cols.append((x, 6, 10) if x <= 5 else (x, 3, 9))
        cols.append((x, 16, 20) if x <= 5 else (x, 17, 23))
    hull(s, cols)
    claw_body(Shift(s, L, 0))
    s.door(14 + L, 7); s.door(14 + L, 19)
    s.section('North jaw: refinery and ore bins')
    s.m('refinery', 7, 4); s.m('storage_ore', 10, 4); s.m('storage_ore', 12, 4); s.m('storage_ore_large', 14, 4); s.m('storage_ore', 17, 4)
    s.lights((4, 7), (10, 8), (14, 8), (18, 8))
    s.section('South jaw: the laser in the tip, a big ore bin, pallets and racks')
    s.m('burstLaser', 3, 17); s.m('storage_ore_large', 8, 18); s.m('storage_pallet', 11, 18); s.m('storage_pallet', 14, 18)
    for (x, y), st in zip([(7, 21), (9, 21), (11, 21), (14, 21)], STOCK + [[]]): s.m('storage_rack', x, y, 0, **({'stock': st} if st else {}))
    s.lights((5, 19), (10, 20), (13, 22), (17, 20))
    return s


def crab():
    s = Ship('P2B CRAB', 34, 27, CREW, 'riff: one big crushing jaw (refinery, ore) and one short hooked jaw with the gun')
    cols = []
    for x in range(1, 15):
        cols.append((x, 6, 11) if x <= 4 else (x, 2, 9))
        if x >= 8: cols.append((x, 17, 21) if x <= 9 else (x, 17, 22))
    hull(s, cols)
    claw_body(Shift(s, 0, 0))
    s.door(14, 7); s.door(14, 19)
    s.section('Big jaw (north): refinery, ore bins, racks')
    s.m('refinery', 7, 3); s.m('storage_ore', 10, 3); s.m('storage_ore_large', 12, 6) if False else None
    s.m('storage_ore', 12, 3)
    for (x, y), st in zip([(7, 8), (9, 8), (11, 8)], STOCK): s.m('storage_rack', x, y, 2, stock=st)
    s.lights((5, 8), (10, 5), (13, 7), (2, 10))
    s.section('Short jaw (south): the laser')
    s.m('burstLaser', 9, 19)
    s.lights((13, 20), (12, 18))
    return s


def toothed():
    s = Ship('P2C WIDE MAW', 34, 28, CREW, 'riff: a wider mouth, the jaw tips bent hard inward like mandibles')
    cols = []
    for x in range(1, 15):
        cols.append((x, 6, 12) if x <= 5 else (x, 2, 9))
        cols.append((x, 15, 21) if x <= 5 else (x, 18, 25))
    hull(s, cols)
    claw_body(Shift(s, 0, 2))
    s.door(14, 8); s.door(14, 21)
    s.section('North jaw: refinery and ore bins')
    s.m('refinery', 7, 3); s.m('storage_ore', 10, 3); s.m('storage_ore', 12, 3)
    s.lights((3, 9), (10, 7), (13, 7), (7, 8))
    s.section('South jaw: the laser in the mandible, a big ore bin, pallet and racks')
    s.m('burstLaser', 2, 16); s.m('storage_ore_large', 9, 19); s.m('storage_pallet', 12, 19)
    for (x, y), st in zip([(7, 23), (9, 23), (11, 23)], STOCK): s.m('storage_rack', x, y, 0, stock=st)
    s.lights((4, 19), (13, 21), (13, 24), (2, 19))
    return s


def scoop():
    s = Ship('PN1 SCOOP', 31, 25, CREW, 'new: a dustpan bow, a V mouth between two lips that funnels into the pod bay, tapering to the stern')
    cols = []
    for x in range(1, 11):
        d = max(0, 8 - x)                      # the V mouth: open rows 12-d .. 12+d
        if d: cols.append((x, 1, 11 - d)); cols.append((x, 13 + d, 23))
        else: cols.append((x, 1, 23))
    for x in range(11, 30):
        h = 11 - (x - 11) // 5
        cols.append((x, 12 - h, 12 + h))
    hull(s, cols)
    vline(s, 10, 0, 24); vline(s, 17, 0, 24); vline(s, 23, 0, 24); hline(s, 17, 23, 12)
    for d in [(10, 4), (10, 20), (17, 9), (17, 16), (20, 12), (23, 9), (23, 16)]: s.door(*d)
    s.section('North lip: refinery and ore bins')
    s.m('refinery', 6, 2); s.m('storage_ore', 4, 2); s.m('storage_rack', 2, 2, 0, stock=STOCK[0])
    s.lights((5, 6), (9, 3), (7, 8))
    s.section('South lip: the laser, a big ore bin, racks')
    s.m('burstLaser', 2, 21); s.m('storage_ore_large', 5, 20)
    for (x, y), st in zip([(5, 18), (7, 18), (8, 16)], STOCK[1:] + [[]]): s.m('storage_rack', x, y, 0, **({'stock': st} if st else {}))
    s.lights((9, 21), (8, 19), (4, 22))
    s.section('Throat hold: the pod bay at the apex of the V, pallets, shield, airlock')
    s.m('pod_bay', 11, 11, vehicle='vehicle.mining_pod'); s.m('storage_pallet', 11, 6); s.m('storage_pallet', 12, 18)
    s.m('shieldGen', 15, 5); s.m('lifeSupport', 16, 17); s.m('airlock', 12, 1)
    s.lights((14, 7), (15, 10), (11, 16), (15, 14), (14, 21), (16, 3))
    s.section('Bridge (north) and quarters (south)')
    s.m('helm', 18, 5); s.m('weaponsConsole', 19, 8); s.m('lifeSupport', 22, 4)
    s.lights((19, 10), (18, 4))
    for x in (18, 19, 20): s.m('bed', x, 18)
    s.m('galley', 18, 13, **GALLEY); s.m('mess_table', 20, 15); s.m('lifeSupport', 22, 18)
    s.lights((22, 14), (19, 20))
    s.section('Engine room')
    s.m('engine', 25, 5, 1); s.m('engine', 25, 15, 1); s.m('reactor', 24, 10); s.m('reactor', 26, 10)
    s.lights((24, 9), (27, 13), (24, 14))
    return s


def boom():
    s = Ship('PN2 DRILL BOOM', 33, 27, CREW, 'new: a long boom with the pod bay at its tip, two big tanks flanking it, the works block behind')
    s.room(1, 10, 15, 16)
    s.room(15, 3, 32, 23)
    vline(s, 22, 3, 23); vline(s, 27, 3, 23); hline(s, 22, 27, 13)
    for d in [(15, 13), (22, 8), (22, 18), (25, 13), (27, 10), (27, 16)]: s.door(*d)
    box(s, 9, 5, 1, 'e', big=True); box(s, 9, 18, 1, 'e', big=True)
    s.beam(8, 5, 8, 7); s.beam(8, 18, 8, 20); s.beam(9, 8, 14, 9); s.beam(9, 17, 14, 17)
    s.section('Boom: the pod bay at the tip, ore bins along it')
    s.m('pod_bay', 2, 11, vehicle='vehicle.mining_pod'); s.m('storage_ore', 7, 11); s.m('storage_ore', 9, 11); s.m('storage_ore_large', 11, 11)
    s.m('burstLaser', 2, 14) if False else None
    s.lights((6, 15), (10, 15), (14, 15), (5, 11))
    s.section('Works hold: refinery, pallets, racks, the laser, shield and airlock')
    s.m('refinery', 16, 4); s.m('storage_pallet', 19, 4); s.m('burstLaser', 16, 19); s.m('shieldGen', 19, 20)
    for (x, y), st in zip([(16, 10), (18, 10), (20, 10)], STOCK): s.m('storage_rack', x, y, 0, stock=st)
    s.m('lifeSupport', 21, 14); s.m('airlock', 18, 3) if False else None
    s.lights((16, 8), (20, 8), (16, 15), (19, 13), (16, 22), (21, 18))
    s.section('Bridge (north) and quarters (south)')
    s.m('helm', 23, 4); s.m('weaponsConsole', 23, 7); s.m('lifeSupport', 26, 4); s.m('airlock', 23, 20, 2)
    s.lights((25, 9), (26, 12))
    for x in (23, 24, 25): s.m('bed', x, 14)
    s.m('galley', 23, 17, **GALLEY); s.m('mess_table', 25, 17) if False else None
    s.lights((26, 15), (26, 19))
    s.section('Engine room')
    s.m('engine', 28, 4, 1); s.m('engine', 28, 19, 1); s.m('reactor', 28, 11); s.m('reactor', 30, 11); s.m('lifeSupport', 28, 14)
    s.lights((28, 9), (31, 14), (30, 16))
    return s


VARIANTS = [lambda: tagged(claw(), "favourite"), lambda: tagged(long_jaws(), "riff"), lambda: tagged(crab(), "riff"), lambda: tagged(toothed(), "riff"), lambda: tagged(scoop(), "new"), lambda: tagged(boom(), "new")]

if __name__ == "__main__":
    write("prospectorR3", [v() for v in VARIANTS], "Prospector variants, round 3: the favourite, riffs and new concepts")
