import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, WeaponC, newGame, type Contact, type Sim } from '../sim';
import { spawnDerelict } from '../sim/combat/derelict';
import { shipCreated, spawnShip } from '../sim/combat/ships';
import { spawnContact } from '../sim/galaxy/arrivals';
import { generateShip } from '../sim/shipgen/generate';
import { shipIdOf } from '../sim/regions';
import { holdOffline, isHeldOffline, releaseHold } from '../sim/modules/hold';
import { content } from '.';

/** The upgrades on a ship's weapon modules, in entity order. */
const fitted = (sim: Sim, ship: number): string[] =>
  sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship).map((id) => sim.world.get(id, ModuleC)?.upgrade ?? '-');

const FACTION = 'faction.navy';
const DEPTH = 6;
/** Every way a generated ship is made, each returning the new ship's id straight away (no tick has run). */
const paths: Record<string, (sim: Sim, seed: number) => number> = {
  spawnShip: (sim, seed) => {
    const gen = generateShip(content.factions[FACTION]!, FACTION, seed, DEPTH, content.modules);
    return spawnShip(sim, gen.template, { faction: 'hostile', x: 150, y: 60, rest: 100, gen: { faction: FACTION, seed, depth: DEPTH, role: gen.role } });
  },
  spawnContact: (sim, seed) => {
    const c: Contact = { id: 9000 + seed, faction: 'navy', shipgen: FACTION, seed, depth: DEPTH, since: 0 };
    expect(spawnContact(sim, sim.galaxy.current, c, { reason: 'jump-in' })).toBe(true);
    return c.ship as number;
  },
  'debug.spawnGenerated': (sim, seed) => {
    const before = new Set(sim.world.query(ShipC));
    sim.enqueue({ type: 'debug.spawnGenerated', faction: FACTION, depth: DEPTH, seed, cx: 150, cy: 80 });
    sim.step();
    return sim.world.query(ShipC).find((s) => !before.has(s)) as number;
  },
  spawnDerelict: (sim, seed) => {
    const id = spawnDerelict(sim, { faction: FACTION, depth: DEPTH, seed, at: { x: 150, y: 80 }, intensity: 0 });
    expect(typeof id).toBe('number');
    return id as number;
  },
};

describe('the ship creation step rolls the faction loadout', () => {
  // A seed whose navy ship carries at least one upgrade, found through the plainest path.
  const pick = (): { seed: number; expected: string[] } => {
    for (let s = 1; s <= 60; s++) {
      const sim = newGame(3, content);
      const list = fitted(sim, paths.spawnShip!(sim, s));
      if (list.some((u) => u !== '-')) return { seed: s, expected: list };
    }
    throw new Error('no navy seed carries an upgrade');
  };
  const { seed: found, expected } = pick();

  for (const [name, make] of Object.entries(paths)) {
    it(`${name}: carried the moment the ship exists, before any tick, and the same for the seed`, () => {
      const sim = newGame(7, content);
      const ship = make(sim, found);
      expect(sim.world.get(ship, ShipC)?.gen?.seed).toBe(found);
      // Hulls and positions can differ between paths (a derelict is ruined), so compare only what the weapons carry: all from the navy table.
      const got = fitted(sim, ship).filter((u) => u !== '-');
      expect(got.length).toBeGreaterThan(0);
      for (const u of got) expect(content.factions[FACTION]!.upgrades!.map((e) => e.item)).toContain(u);
      if (name !== 'spawnDerelict') expect(fitted(sim, ship)).toEqual(expected);
      const before = fitted(sim, ship);
      for (let t = 0; t < 5; t++) sim.step();
      expect(fitted(sim, ship)).toEqual(before); // nothing is rolled later
    });
  }

  it('a ship made without a generator origin carries nothing and gains nothing; the player ship stays bare', () => {
    const sim = newGame(3, content);
    const gen = generateShip(content.factions[FACTION]!, FACTION, found, DEPTH, content.modules);
    const ship = spawnShip(sim, gen.template, { faction: 'hostile', x: 150, y: 60 });
    for (let t = 0; t < 5; t++) sim.step();
    expect(fitted(sim, ship).every((u) => u === '-')).toBe(true);
    shipCreated(sim, ship, { faction: FACTION, seed: found, depth: DEPTH });
    expect(fitted(sim, ship)).toEqual(expected);
    const mine = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.faction === 'player') as number;
    expect(fitted(sim, mine).every((u) => u === '-')).toBe(true);
  });
});

describe('the work hold (Module.offlineUntil)', () => {
  it('takes any module offline while refreshed, lapses by itself, and can be released', () => {
    const sim = newGame(3, content);
    const id = sim.world.query(ModuleC).find((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]!.power < 0) as number;
    const m = sim.world.get(id, ModuleC)!;
    sim.step();
    expect(m.powered).toBe(true);
    holdOffline(sim, id);
    expect(isHeldOffline(sim, m)).toBe(true);
    sim.step();
    expect(m.powered).toBe(false);
    for (let t = 0; t < 4; t++) sim.step();
    expect(isHeldOffline(sim, m)).toBe(false);
    expect(m.powered).toBe(true);
    holdOffline(sim, id);
    releaseHold(sim, id);
    sim.step();
    expect(m.powered).toBe(true);
  });
});
