import { describe, expect, it } from 'vitest';
import { atWar, clash, fleetPower, newGame, wouldFight, type Sim } from '../sim';
import { SHIP_POWER } from '../sim/galaxy/tuningWar';
import type { ShipSize } from '../sim/galaxy/defs';
import type { Fleet } from '../sim/galaxy/types';
import { content } from '.';

/** Give a fleet ships of these size classes (fresh ids, names and generator keys of its own faction's hulls). */
function ships(sim: Sim, f: Fleet, sizes: ShipSize[], depth = 1): void {
  const proto = f.ships[0]!;
  f.ships = sizes.map((size, i) => ({ ...proto, id: sim.galaxy.nextFleet++, size, depth, seed: proto.seed + i, name: `${proto.name ?? f.role} ${i}` }));
}
const kinds = (a: Fleet, b: Fleet, sim: Sim, from = 1, to = 300) => {
  const out: Record<string, number> = { decisive: 0, driven: 0, draw: 0, avoided: 0, a: 0, b: 0 };
  for (let t = from; t <= to; t++) {
    const c = clash(sim, a, b, t);
    out[c.kind]!++;
    if (c.winner) out[c.winner]!++;
  }
  return out;
};

describe('the stats mini-sim', () => {
  // The mini-sim is pure: any fleets will do (a pirate is a navy patrol re-labelled).
  const sim = newGame(21, content);
  const patrol = sim.galaxy.fleets.find((f) => f.role === 'patrol')!;
  const trader = sim.galaxy.fleets.find((f) => f.role === 'trader')!;
  const pirate = { ...patrol, id: 90001, faction: 'pirates', role: 'pirate', ships: patrol.ships.map((c) => ({ ...c })) } as Fleet;

  it('three heavy navy ships against one small pirate: the winner is obvious (almost every time)', () => {
    ships(sim, patrol, ['heavy', 'heavy', 'heavy']);
    ships(sim, pirate, ['small']);
    // The pirate sometimes sees it coming and runs; when the two fight, the navy wins and the pirate is destroyed.
    let fights = 0;
    let won = 0;
    for (let t = 1; t <= 300; t++) {
      const c = clash(sim, patrol, pirate, t);
      if (c.kind === 'avoided') continue;
      fights++;
      if (c.winner === 'a' && c.kind === 'decisive' && c.b.fate === 'destroyed') won++;
    }
    expect(fights).toBeGreaterThan(20);
    expect(won / fights).toBeGreaterThan(0.99);
    // Seen from the other side the answer is the same.
    const flip = kinds(pirate, patrol, sim);
    expect(flip['b']).toBe(300 - flip['avoided']!);
  });

  it('a pirate that is clearly outmatched by a patrol usually slips away without a fight', () => {
    ships(sim, patrol, ['heavy', 'medium']);
    ships(sim, pirate, ['small']);
    const k = kinds(patrol, pirate, sim);
    expect(k['avoided']! / 300).toBeGreaterThan(0.6);
    expect(k['avoided']! / 300).toBeLessThan(0.95);
  });

  it('an even match varies: driven-off and bloody draws all happen, and either side can win', () => {
    ships(sim, patrol, ['small', 'small']);
    ships(sim, pirate, ['medium']);
    const k = kinds(patrol, pirate, sim);
    // Equal-ish fleets are never wiped out in one go, but they do drive each other off and hurt each other.
    expect(k['decisive']).toBe(0);
    expect(k['driven']).toBeGreaterThan(5);
    expect(k['draw']).toBeGreaterThan(5);
    expect(k['a']).toBeGreaterThan(10);
    expect(k['b']).toBeGreaterThan(10);
  });

  it('an unarmed hauler is prey: a small pirate beats a small trader nearly always, and a heavy freighter still loses most of the time', () => {
    ships(sim, pirate, ['small']);
    ships(sim, trader, ['small']);
    const small = kinds(pirate, trader, sim);
    expect(small['a']! / 300).toBeGreaterThan(0.99);
    ships(sim, trader, ['heavy']);
    const heavy = kinds(pirate, trader, sim);
    expect(heavy['a']! / 300).toBeGreaterThan(0.4);
    expect(heavy['a']! / 300).toBeLessThan(small['a']! / 300);
    expect(heavy['decisive']!).toBeLessThan(small['decisive']!);
  });

  it('is deterministic: the same fleets and turn give the same result', () => {
    ships(sim, patrol, ['small', 'small']);
    ships(sim, pirate, ['medium']);
    for (let t = 1; t < 50; t++) expect(clash(sim, patrol, pirate, t)).toEqual(clash(sim, patrol, pirate, t));
  });

  it('fleet power follows size, role and depth; a stranded fleet is half as strong', () => {
    ships(sim, patrol, ['heavy']);
    ships(sim, trader, ['heavy']);
    expect(fleetPower(patrol)).toBeGreaterThan(fleetPower(trader) * 5);
    ships(sim, patrol, ['small']);
    const one = fleetPower(patrol);
    ships(sim, patrol, ['small'], 5);
    expect(fleetPower(patrol)).toBeGreaterThan(one);
    patrol.damaged = true;
    expect(fleetPower(patrol)).toBeCloseTo((one / (1 + 0.08)) * (1 + 0.08 * 5) * 0.5, 6);
    expect(SHIP_POWER.heavy).toBeGreaterThan(SHIP_POWER.medium);
  });

  it('who fights: armed fleets of factions at war; two haulers, or one faction, never', () => {
    expect(atWar(sim, 'navy', 'pirates')).toBe(true);
    expect(atWar(sim, 'rogue', 'traders')).toBe(true);
    expect(atWar(sim, 'navy', 'meridian')).toBe(false);
    expect(atWar(sim, 'navy', 'navy')).toBe(false);
    ships(sim, trader, ['small']);
    const other = { ...trader, id: 9999, faction: 'pirates', role: 'trader' } as Fleet;
    expect(wouldFight(sim, trader, other)).toBe(false);
    expect(wouldFight(sim, patrol, pirate)).toBe(true);
    expect(wouldFight(sim, pirate, trader)).toBe(true);
    expect(wouldFight(sim, patrol, { ...patrol, id: 9998 } as Fleet)).toBe(false);
  });
});

