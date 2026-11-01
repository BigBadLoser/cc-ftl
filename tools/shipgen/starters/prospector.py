"""Prospector variants, round 4: new concepts only, no containers (#241). Run: python3 tools/shipgen/starters/prospector.py"""
import math
from common import *  # noqa: F401,F403

CREW = ['role.pilot', 'role.engineer', 'role.engineer']
STOCK = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 80}, {'item': 'item.ice', 'count': 10}, {'item': 'item.ration', 'count': 12}, {'item': 'item.fuel', 'count': 16}], [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]]


def racks(s, pts, rot=0):
    for (x, y), st in zip(pts, STOCK): s.m('storage_rack', x, y, rot, stock=st)


def dump_truck():
    s = Ship('DUMP TRUCK', 34, 26, CREW, 'one huge open ore tub; a tiny cab perched on its front corner, the engines tucked under the back')
    s.room(1, 1, 10, 10); s.room(8, 5, 28, 22); s.room(28, 7, 33, 19)
    for d in [(28, 14)]: s.door(*d)
    s.section('Cab (front corner): helm, gun console, three bunks, galley, life support')
    s.m('helm', 2, 2); s.m('weaponsConsole', 6, 2); s.m('lifeSupport', 9, 2)
    for x in (2, 3, 4): s.m('bed', x, 6)
    s.m('galley', 6, 8, **GALLEY)
    s.lights((5, 5), (8, 5), (2, 9), (9, 9))
    s.section('Tub: the pod bay at the front, refinery, rows of ore bins, pallets and racks, the laser, shield, airlock')
    s.m('pod_bay', 9, 12, vehicle='vehicle.mining_pod'); s.m('burstLaser', 9, 20)
    s.m('refinery', 12, 6); s.m('storage_ore_large', 16, 6); s.m('storage_ore_large', 20, 6); s.m('storage_ore', 24, 6)
    s.m('storage_ore', 15, 11); s.m('storage_ore', 18, 11); s.m('storage_ore', 21, 11)
    s.m('storage_pallet', 15, 15); s.m('storage_pallet', 18, 15); s.m('storage_pallet', 21, 15)
    racks(s, [(14, 20), (16, 20), (18, 20)], 2)
    s.m('shieldGen', 24, 19); s.m('lifeSupport', 26, 12); s.m('airlock', 21, 19, 2)
    s.lights((10, 7), (15, 9), (19, 9), (24, 10), (12, 14), (24, 14), (11, 18), (16, 18), (24, 17), (27, 21), (20, 21))
    s.section('Engine block')
    s.m('engine', 29, 8, 1); s.m('engine', 29, 15, 1); s.m('reactor', 29, 12); s.m('reactor', 31, 12)
    s.lights((30, 14), (32, 14))
    return s



def octagon(cx, cy, r, flat):
    """Hull columns of an octagon: half-height r, the middle `flat` columns either side of cx full height."""
    return [(x, cy - (r - max(0, abs(x - cx) - flat)), cy + (r - max(0, abs(x - cx) - flat))) for x in range(cx - r - flat + 1, cx + r + flat)]


def silos():
    s = Ship('SILOS', 31, 29, CREW, 'three round ore silos stacked across the bow, the works and crew in a block behind them')
    hull(s, octagon(7, 5, 4, 3) + octagon(7, 14, 4, 3) + octagon(7, 23, 4, 3))
    s.room(12, 8, 30, 20)
    vline(s, 19, 8, 20); vline(s, 25, 8, 20)
    for d in [(19, 12), (25, 15)]: s.door(*d)
    s.section('North silo: the refinery and an ore bin; middle silo: ore bins; south silo: a big ore bin and the laser')
    s.m('refinery', 5, 3); s.m('storage_ore', 9, 3)
    s.m('storage_ore_large', 5, 13); s.m('storage_ore', 9, 15)
    s.m('storage_ore_large', 5, 22); s.m('burstLaser', 9, 22)
    s.lights((3, 5), (11, 5), (7, 9), (3, 14), (11, 13), (7, 19), (3, 23), (11, 23), (7, 25))
    s.section('Hold: the pod bay, a pallet, racks, shield, life support')
    s.m('pod_bay', 13, 9, vehicle='vehicle.mining_pod'); s.m('storage_pallet', 16, 13); s.m('shieldGen', 17, 15); s.m('lifeSupport', 18, 9)
    racks(s, [(13, 19), (15, 19), (17, 19)], 2)
    s.lights((16, 9), (14, 15), (13, 12), (19, 18) if False else (16, 17))
    s.section('Crew: helm, gun console, three bunks, galley, life support, the airlock')
    s.m('helm', 20, 9); s.m('weaponsConsole', 23, 9); s.m('galley', 21, 12, **GALLEY); s.m('lifeSupport', 24, 13)
    for x in (20, 21, 22): s.m('bed', x, 15)
    s.m('airlock', 22, 17, 2)
    s.lights((23, 12), (20, 18), (24, 16))
    s.section('Engine room')
    s.m('engine', 26, 9, 1); s.m('engine', 26, 16, 1); s.m('reactor', 26, 13); s.m('reactor', 28, 13)
    s.lights((26, 15), (29, 15))
    return s


def spider():
    s = Ship('SPIDER', 34, 31, CREW, 'a crew hub with four stepped legs: refinery and pod bay on the front pair, engines on the back pair')
    s.room(11, 11, 23, 19)
    for a in [(6, 5, 13, 12), (1, 1, 8, 8), (6, 18, 13, 25), (1, 22, 8, 29), (21, 5, 28, 12), (26, 1, 33, 8), (21, 18, 28, 25), (26, 22, 33, 29)]: s.room(*a)
    s.section('Front-north leg: refinery and ore bins')
    s.m('refinery', 2, 2); s.m('storage_ore', 5, 2); s.m('storage_ore', 8, 7); s.m('storage_ore_large', 9, 10) if False else None
    s.lights((7, 5), (11, 9), (6, 7))
    s.section('Front-south leg: the pod bay at the foot, the laser, pallet and racks')
    s.m('pod_bay', 2, 24, vehicle='vehicle.mining_pod'); s.m('burstLaser', 2, 27) if False else None
    s.m('storage_pallet', 11, 21); s.m('burstLaser', 2, 27)
    racks(s, [(10, 19), (9, 22), (7, 24)])
    s.lights((6, 23), (8, 20), (4, 28), (12, 23))
    s.section('Hub: helm, gun console, three bunks, galley, life support, shield')
    s.m('helm', 15, 12); s.m('weaponsConsole', 19, 12); s.m('lifeSupport', 12, 15)
    for x in (13, 14, 15): s.m('bed', x, 17)
    s.m('galley', 18, 15, **GALLEY); s.m('shieldGen', 20, 17)
    s.lights((14, 15), (17, 14), (22, 14), (17, 18))
    s.section('Back-north leg: an engine at the foot, a reactor, the airlock')
    s.m('engine', 29, 2, 1); s.m('reactor', 22, 9) if False else None
    s.m('reactor', 24, 9); s.m('airlock', 22, 5); s.m('lifeSupport', 27, 7)
    s.lights((22, 10), (27, 5), (32, 7))
    s.section('Back-south leg: an engine at the foot, a reactor, stores')
    s.m('engine', 29, 24, 1); s.m('reactor', 24, 21)
    s.lights((22, 23), (27, 27), (32, 23), (26, 20))
    return s


def sidewinder():
    s = Ship('SIDEWINDER', 34, 26, CREW, 'a long ore hold with the crew cab on a sponson to one side and an engine pod to the other')
    s.room(1, 9, 33, 17); s.room(11, 1, 22, 9); s.room(21, 17, 29, 24)
    vline(s, 11, 9, 17); vline(s, 26, 9, 17)
    for d in [(11, 13), (26, 13), (16, 9), (24, 17)]: s.door(*d)
    s.section('Bow: the laser in the nose, refinery and ore bins')
    s.m('burstLaser', 2, 10); s.m('refinery', 5, 10); s.m('storage_ore', 2, 14); s.m('storage_ore', 8, 10)
    s.lights((4, 13), (9, 15), (2, 12))
    s.section('Hold: the pod bay, pallets, a big ore bin, racks, shield')
    s.m('pod_bay', 12, 10, vehicle='vehicle.mining_pod'); s.m('storage_ore_large', 17, 10); s.m('storage_pallet', 21, 10); s.m('shieldGen', 21, 15)
    racks(s, [(12, 15), (14, 15), (16, 15)], 2)
    s.lights((15, 12), (20, 13), (25, 11), (19, 16))
    s.section('Cab sponson (north): helm, gun console, three bunks, galley, life support, the airlock')
    s.m('helm', 12, 2); s.m('weaponsConsole', 16, 2); s.m('airlock', 19, 1)
    for x in (12, 13, 14): s.m('bed', x, 6)
    s.m('galley', 16, 6, **GALLEY); s.m('lifeSupport', 21, 5)
    s.lights((15, 4), (12, 8), (20, 8), (18, 5))
    s.section('Engine pod (south) and stern: two engines, reactors, life support')
    s.m('engine', 25, 19, 1); s.m('engine', 29, 10, 1); s.m('reactor', 22, 18); s.m('reactor', 31, 14); s.m('lifeSupport', 22, 21)
    s.lights((24, 23), (28, 15), (30, 16), (27, 10))
    return s


def chisel():
    s = Ship('CHISEL', 30, 25, CREW, 'an ore ram: a heavy bow sloping back on one side like a chisel, the refinery right behind the edge')
    hull(s, [(x, 2, min(22, 8 + x)) for x in range(1, 30)])
    vline(s, 9, 0, 24); vline(s, 18, 0, 24); vline(s, 24, 0, 24); hline(s, 18, 24, 11)
    for d in [(9, 6), (9, 13), (18, 7), (18, 16), (21, 11), (24, 7), (24, 16)]: s.door(*d)
    s.section('Ram: refinery and ore bins behind the sloped edge, the laser on the blunt corner')
    s.m('refinery', 2, 3); s.m('burstLaser', 6, 3); s.m('storage_ore', 5, 7)
    s.lights((3, 8), (8, 9), (8, 3), (8, 14))
    s.section('Hold: the pod bay, the airlock, a big ore bin, pallets, racks, shield')
    s.m('pod_bay', 10, 3, vehicle='vehicle.mining_pod'); s.m('airlock', 14, 2); s.m('storage_ore_large', 13, 7); s.m('storage_pallet', 11, 15); s.m('storage_pallet', 14, 15)
    racks(s, [(10, 10), (12, 10), (14, 10)])
    s.m('shieldGen', 15, 17); s.m('lifeSupport', 17, 3)
    s.lights((11, 7), (17, 8), (11, 13), (16, 13), (13, 19), (17, 21))
    s.section('Bridge (north) and quarters (south)')
    s.m('helm', 19, 3); s.m('weaponsConsole', 21, 7); s.m('lifeSupport', 23, 3)
    for x in (19, 20, 21): s.m('bed', x, 19)
    s.m('galley', 19, 13, **GALLEY); s.m('airlock', 21, 19, 2) if False else None
    s.lights((22, 6), (22, 9), (23, 14), (22, 21))
    s.section('Engine room')
    s.m('engine', 25, 3, 1); s.m('engine', 25, 18, 1); s.m('reactor', 25, 11); s.m('reactor', 27, 11); s.m('airlock', 25, 22, 2) if False else None
    s.lights((25, 8), (28, 14), (25, 15))
    return s


VARIANTS = [lambda: tagged(dump_truck(), 'new'), lambda: tagged(silos(), 'new'), lambda: tagged(spider(), 'new'), lambda: tagged(sidewinder(), 'new'), lambda: tagged(chisel(), 'new')]

if __name__ == '__main__':
    write('prospector', [v() for v in VARIANTS], 'Prospector variants, round 4: new concepts only')
