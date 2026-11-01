"""Lancer variants (#241). Run: python3 tools/shipgen/starters/lancer.py"""
from common import *  # noqa: F401,F403

CREW = ['role.gunner', 'role.gunner', 'role.pilot', 'role.engineer']
HOLD = [STOCK_BUILD, [{'item': 'item.scrap', 'count': 60}, {'item': 'item.ice', 'count': 10}, {'item': 'item.missile', 'count': 16}, {'item': 'item.ration', 'count': 12}], STOCK_ARMS]

def trident():
    s = Ship('L3 TRIDENT', 32, 27, CREW, 'three prongs: missile on the long one, lasers on the outer two')
    cols = []
    for x in range(1, 30):
        if 2 <= x <= 15: cols.append((x, 11, 15))
        if 7 <= x <= 15: cols.append((x, 4, 8)); cols.append((x, 18, 22))
        if x >= 15: cols.append((x, 4, 22))
    hull(s, cols)
    vline(s, 15, 0, 26); vline(s, 21, 0, 26); hline(s, 21, 29, 11); hline(s, 21, 29, 15)
    for d in [(15, 6), (15, 13), (15, 20), (21, 13), (24, 11), (24, 15)]: s.door(*d)
    # centre prong: missile in the tip, the two weapon consoles behind it
    s.m('missileLauncher', 3, 12); s.m('weaponsConsole', 8, 12); s.m('weaponsConsole', 11, 12)
    s.lights((7, 14), (14, 12))
    # north prong: a laser in the tip, bunks behind
    s.m('burstLaser', 8, 5)
    for x, y in ((10, 5), (12, 5), (10, 7), (12, 7)): s.m('bed', x, y, 1)
    s.lights((14, 6), (8, 7))
    # south prong: a laser in the tip, the galley behind
    s.m('burstLaser', 8, 20); s.m('galley', 11, 19, **GALLEY); s.m('mess_table', 12, 21); s.m('chair', 12, 20, 2); s.m('chair', 13, 20, 2)
    s.lights((14, 19), (8, 19))
    # bridge
    s.m('helm', 17, 10); s.m('shieldConsole', 17, 15, 2); s.m('lifeSupport', 20, 5); s.m('lifeSupport', 20, 8)
    s.m('shieldGen.mk2', 19, 19)
    s.lights((17, 6), (18, 13), (17, 19), (17, 21))
    # stern: engines north and south, reactors in the waist, the airlock on the dorsal hull
    s.m('engine', 25, 5, 1); s.m('engine', 25, 16, 1); s.m('airlock', 22, 4)
    s.m('reactor', 22, 8); s.m('reactor', 27, 13);
    for (x, y), st in zip([(22, 12), (23, 12), (25, 12)], HOLD): s.m('storage', x, y, 0, stock=st)
    s.m('reactor', 22, 16); s.m('lifeSupport', 23, 20)
    s.lights((24, 9), (26, 14), (24, 14), (24, 17), (27, 21), (28, 10))
    return s



def trident_body(b, nacelles=False):
    """The trident's body: bridge (x 16..20) and stern (x 22..28) in x 15..29, y 4..22; with nacelles the engines sit in
    two pods reaching four tiles further aft. Prong doors (x 15) are the caller's."""
    cols = [(x, 4, 22) for x in range(15, 30)]
    if nacelles: cols += [(x, 4, 9) for x in range(29, 34)] + [(x, 17, 22) for x in range(29, 34)]
    b.hull(cols)
    b.vline(15, 4, 22); b.vline(21, 4, 22); b.hline(21, 29, 11); b.hline(21, 29, 15)
    for d in [(21, 13), (24, 11), (24, 15)]: b.door(*d)
    b.section('Bridge: helm, shield console, life support, the Mk II shield')
    b.m('helm', 17, 10); b.m('shieldConsole', 17, 15, 2); b.m('lifeSupport', 20, 5); b.m('lifeSupport', 20, 8)
    b.m('shieldGen.mk2', 19, 19)
    b.lights((17, 6), (18, 13), (17, 19), (17, 21))
    b.section('Stern: engines north and south, reactors, the hold and the dorsal airlock')
    ex = 29 if nacelles else 25
    b.m('engine', ex, 5, 1); b.m('engine', ex, 18 if nacelles else 16, 1); b.m('airlock', 22, 4)
    b.m('reactor', 22, 8); b.m('reactor', 27, 13)
    for (x, y), st in zip([(22, 12), (23, 12), (25, 12)], HOLD): b.m('storage', x, y, 0, stock=st)
    b.m('reactor', 22, 16); b.m('lifeSupport', 23, 20)
    b.lights((24, 9), (26, 14), (24, 14), (24, 17), (27, 21), (28, 10))


def centre_prong(s, tx, x1, y0=11):
    """A five-tall prong from x tx to x1 (walls included): the missile in the tip, both gun consoles behind it."""
    hull(s, [(x, y0, y0 + 4) for x in range(tx, x1 + 1)])
    s.section('Centre prong: the missile launcher in the tip, both gun consoles')
    s.m('missileLauncher', tx + 1, y0 + 1); s.m('weaponsConsole', tx + 6, y0 + 1); s.m('weaponsConsole', tx + 9, y0 + 1)
    s.lights((tx + 5, y0 + 3), (x1 - 1, y0 + 1))


def north_prong(s, tx, x1, y0=4):
    hull(s, [(x, y0, y0 + 4) for x in range(tx, x1 + 1)])
    s.section('North prong: a burst laser in the tip, four bunks')
    s.m('burstLaser', tx + 1, y0 + 1)
    for x, y in ((tx + 3, y0 + 1), (tx + 5, y0 + 1), (tx + 3, y0 + 3), (tx + 5, y0 + 3)): s.m('bed', x, y, 1)
    s.lights((x1 - 1, y0 + 2), (tx + 1, y0 + 3))


def south_prong(s, tx, x1, y0=18):
    hull(s, [(x, y0, y0 + 4) for x in range(tx, x1 + 1)])
    s.section('South prong: a burst laser in the tip, the galley')
    s.m('burstLaser', tx + 1, y0 + 2); s.m('galley', tx + 4, y0 + 1, **GALLEY)
    s.m('mess_table', tx + 5, y0 + 3); s.m('chair', tx + 5, y0 + 2, 2); s.m('chair', tx + 6, y0 + 2, 2)
    s.lights((x1 - 1, y0 + 1), (tx + 1, y0 + 1))


def spear():
    s = Ship('L3A SPEAR', 37, 27, CREW, 'riff: the centre prong runs long like a spear, short stub prongs carry the lasers')
    centre_prong(s, 2, 20); north_prong(s, 12, 20); south_prong(s, 12, 20)
    trident_body(Shift(s, 5, 0))
    for y in (6, 13, 20): s.door(20, y)
    s.lights((16, 13))
    return s


def splayed():
    s = Ship('L3B SPLAYED', 32, 29, CREW, 'riff: the outer prongs kink outward toward their tips, a wider, angrier fork')
    centre_prong(s, 2, 15, 12)
    hull(s, [(x, 2, 7) for x in range(5, 13)] + [(x, 5, 9) for x in range(11, 16)])
    hull(s, [(x, 21, 26) for x in range(5, 13)] + [(x, 19, 23) for x in range(11, 16)])
    trident_body(Shift(s, 0, 1))
    for y in (7, 14, 21): s.door(15, y)
    s.section('North prong: a burst laser in the kinked tip, four bunks')
    s.m('burstLaser', 6, 3)
    for x, y in ((8, 3), (10, 3), (8, 5), (10, 5)): s.m('bed', x, y, 1)
    s.lights((6, 6), (12, 6), (14, 8))
    s.section('South prong: a burst laser in the kinked tip, the galley')
    s.m('burstLaser', 6, 24); s.m('galley', 8, 22, **GALLEY); s.m('mess_table', 9, 24); s.m('chair', 9, 23, 2); s.m('chair', 10, 23, 2)
    s.lights((6, 22), (12, 22), (14, 20))
    return s


def nacelle_trident():
    s = Ship('L3C NACELLES', 35, 27, CREW, 'riff: the favourite with its engines pushed out into two stern nacelles')
    centre_prong(s, 2, 15); north_prong(s, 7, 15); south_prong(s, 7, 15)
    trident_body(Shift(s, 0, 0), nacelles=True)
    for y in (6, 13, 20): s.door(15, y)
    return s



def hammerhead():
    s = Ship('LN1 HAMMERHEAD', 33, 27, CREW, 'new: a wide gun bar across the bow (lasers at its ends, missile centre), a slim neck, a broad stern')
    s.room(1, 2, 7, 24); s.room(7, 9, 20, 17); s.room(20, 5, 31, 21)
    vline(s, 13, 9, 17)
    for d in [(7, 13), (13, 13), (20, 13)]: s.door(*d)
    s.section('Gun bar: lasers at both ends, the missile launcher in the middle, both gun consoles')
    s.m('burstLaser', 2, 3); s.m('burstLaser', 2, 22); s.m('missileLauncher', 2, 12)
    s.m('weaponsConsole', 4, 7); s.m('weaponsConsole', 4, 17); s.m('lifeSupport', 6, 3)
    s.lights((5, 5), (2, 9), (6, 11), (6, 15), (2, 17), (5, 21), (6, 23))
    s.section('Bridge: helm and shield console')
    s.m('helm', 9, 10); s.m('shieldConsole', 9, 15, 2); s.m('lifeSupport', 12, 10)
    s.lights((8, 13), (12, 14))
    s.section('Crew: four bunks, galley, mess table')
    for x in (14, 15, 17, 18): s.m('bed', x, 10)
    s.m('galley', 14, 15, **GALLEY); s.m('mess_table', 17, 14); s.m('chair', 17, 13, 2); s.m('chair', 18, 13, 2)
    s.lights((16, 12), (19, 16))
    s.section('Stern: engines, reactors, the Mk II shield, the hold, the airlock')
    s.m('engine', 27, 6, 1); s.m('engine', 27, 17, 1); s.m('airlock', 23, 5)
    s.m('reactor', 23, 11); s.m('reactor', 25, 11); s.m('reactor', 27, 11); s.m('shieldGen.mk2', 29, 12) if False else None
    s.m('shieldGen.mk2', 21, 15); s.m('lifeSupport', 21, 6)
    for (x, y), st in zip([(23, 19), (24, 19), (25, 19)], HOLD): s.m('storage', x, y, 0, stock=st)
    s.lights((22, 9), (26, 10), (29, 14), (24, 14), (26, 17), (22, 20))
    return s


def xwing():
    s = Ship('LN2 X-WING', 32, 27, CREW, 'new: a slim fuselage with four wings, lasers on the forward pair, engines on the aft pair')
    hull(s, [(x, 11, 15) if x <= 2 else (x, 10, 16) for x in range(1, 32)])
    hull(s, [(x, 3, 10) for x in range(8, 15)] + [(x, 16, 23) for x in range(8, 15)])
    hull(s, [(x, 2, 10) for x in range(21, 32)] + [(x, 16, 24) for x in range(21, 32)])
    vline(s, 7, 0, 26); vline(s, 15, 0, 26); vline(s, 21, 0, 26)
    for d in [(7, 13), (15, 13), (21, 13), (11, 10), (11, 16), (25, 10), (25, 16)]: s.door(*d)
    s.section('Nose: the missile launcher and both gun consoles')
    s.m('missileLauncher', 2, 12); s.m('weaponsConsole', 5, 11) if False else None
    s.lights((6, 11), (6, 15))
    s.section('Forward fuselage and wings: bridge in the middle, a laser on each wingtip, bunks north, galley south')
    s.m('helm', 12, 11)
    s.m('burstLaser', 9, 4); s.m('bed', 12, 4); s.m('bed', 13, 4); s.m('bed', 12, 7); s.m('bed', 13, 7)
    s.m('burstLaser', 9, 21); s.m('galley', 12, 17, **GALLEY); s.m('weaponsConsole', 12, 20) if False else None
    s.lights((9, 8), (9, 13), (9, 18), (13, 22), (10, 6), (10, 20), (13, 14))
    s.section('Waist: gun and shield consoles, the hold, life support, the Mk II shield')
    s.m('weaponsConsole', 16, 11); s.m('weaponsConsole', 18, 11); s.m('shieldConsole', 16, 14, 2)
    s.m('lifeSupport', 20, 14)
    s.lights((20, 11), (19, 15))
    s.section('Aft fuselage and wings: an engine on each aft wing, reactors, hold, airlock')
    s.m('engine', 27, 3, 1); s.m('engine', 27, 20, 1); s.m('airlock', 22, 2)
    s.m('reactor', 22, 11); s.m('reactor', 26, 11); s.m('reactor', 22, 18); s.m('shieldGen.mk2', 28, 11)
    for (x, y), st in zip([(22, 22), (23, 22), (24, 22)], HOLD): s.m('storage', x, y, 0, stock=st)
    s.m('lifeSupport', 26, 6); s.m('lifeSupport', 26, 18)
    s.lights((24, 7), (30, 8), (24, 13), (30, 15), (25, 19), (30, 18), (25, 23), (26, 9))
    return s


VARIANTS = [lambda: tagged(trident(), "favourite"), lambda: tagged(spear(), "riff"), lambda: tagged(splayed(), "riff"), lambda: tagged(nacelle_trident(), "riff"), lambda: tagged(hammerhead(), "new"), lambda: tagged(xwing(), "new")]

if __name__ == "__main__":
    write("lancerR3", [v() for v in VARIANTS], "Lancer variants: the favourite and new riffs and concepts")
