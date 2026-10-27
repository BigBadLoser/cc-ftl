import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION, TraderC, atWar, deserialize, galaxyIndex, gatedBlueprints, newGame, nodeOf, portBlueprints, reputationWith, rollTrader, serialize, spillSources,
  standing, standings, stanceBetween, tierOf, unitPrice, type GalaxyContent, type Port, type Sim,
} from '../sim';
import { portsAt } from '../sim/galaxy/portIndex';
import { content } from '.';

const galaxy = content.galaxy as unknown as GalaxyContent;
const ids = Object.keys(content.galaxy.factions);

/** The old relation weights, as the faction table held them before the pairwise table: who was at war with whom (sum of both ways <= -0.3, or the rogue AI). */
const WAR_PAIRS = [
  ['navy', 'pirates'], ['navy', 'rogue'], ['meridian', 'helix'], ['meridian', 'vantor'], ['meridian', 'pirates'], ['helix', 'rogue'],
  ['vantor', 'pirates'], ['traders', 'pirates'], ['meridian', 'rogue'], ['vantor', 'rogue'], ['traders', 'rogue'], ['pirates', 'rogue'],
];

describe('per-faction standing', () => {
  it('gives every faction a reputation key of its own, so each standing moves on its own', () => {
    const sim = newGame(1, content);
    const before = Object.fromEntries(standings(sim).map((s) => [s.faction, s.value]));
    sim.story.reputation['meridian'] = 4;
    expect(standing(sim, 'meridian')).toBeCloseTo((before['meridian'] ?? 0) + 4, 5);
    // Its rivals feel a share (Helix -0.4 x 0.25 x 4); nobody else's own reputation changed.
    expect(standing(sim, 'helix')).toBeCloseTo(-0.4, 5);
    expect(sim.story.reputation['helix']).toBeUndefined();
    expect(sim.story.reputation['vantor']).toBeUndefined();
    expect(tierOf(sim, 'meridian')).toBe('friendly');
    expect(tierOf(sim, 'vantor')).toBe('neutral');
    expect(standing(sim, 'pirates')).toBe(before['pirates']);
  });

  it('keeps corp and pirate standings apart in the display list', () => {
    const sim = newGame(1, content);
    sim.story.reputation['pirates'] = 6;
    sim.story.reputation['helix'] = -3;
    const by = Object.fromEntries(standings(sim).map((s) => [s.faction, s]));
    expect(by['pirates']?.tier).toBe('neutral');
    expect(by['helix']?.tier).toBe('hostile');
    expect(by['meridian']?.tier).toBe('neutral');
    expect(by['vantor']?.tier).toBe('neutral');
    // Meridian: Helix's -3 is a rival's loss (+0.3), the pirates' +6 a rival's gain (-0.6); neither is its own reputation.
    expect(by['meridian']?.value).toBeCloseTo(0.3 - 0.6, 5);
    expect(sim.story.reputation['meridian']).toBeUndefined();
  });

  it('prices and hails read the owner faction, not a shared key', () => {
    const sim = newGame(1, content);
    const make = (owner: string): number => {
      const id = sim.world.createEntity();
      sim.world.add(id, TraderC, rollTrader(sim, 'trader.station.trading', 'station.trading', owner, 5, true, owner));
      return id;
    };
    const meridian = make('meridian');
    const helix = make('helix');
    const base = unitPrice(sim, helix, 'item.metal', 'sell');
    sim.story.reputation['meridian'] = 5;
    expect(reputationWith(sim, meridian)).toBe(5);
    expect(reputationWith(sim, helix)).toBe(0);
    expect(unitPrice(sim, helix, 'item.metal', 'sell')).toBe(base);
    expect(unitPrice(sim, meridian, 'item.metal', 'sell')).toBeLessThan(base as number);
  });

  it('survives a save round trip with its owners and per-faction numbers', () => {
    const sim = newGame(2, content);
    sim.story.reputation['vantor'] = 2;
    sim.story.reputation['pirates'] = -1;
    const id = sim.world.createEntity();
    sim.world.add(id, TraderC, rollTrader(sim, 'trader.station.trading', 'station.trading', 'S', 9, true, 'meridian'));
    const saved = serialize(sim);
    expect(JSON.parse(saved).version).toBe(SAVE_VERSION);
    const back = deserialize(saved, content);
    expect(back.story.reputation).toMatchObject({ vantor: 2, pirates: -1 });
    expect(standing(back, 'vantor')).toBe(standing(sim, 'vantor'));
    expect(back.world.get(id, TraderC)?.owner).toBe('meridian');
  });
});

describe('faction relations table', () => {
  it('keeps today\'s wars and nothing else', () => {
    const war = new Set(WAR_PAIRS.map(([a, b]) => [a, b].sort().join('|')));
    for (const a of ids) for (const b of ids) {
      if (a >= b) continue;
      expect(stanceBetween(galaxy, a, b) === 'war', `${a} ${b}`).toBe(war.has([a, b].sort().join('|')));
    }
  });

  it('is symmetric, never at war with itself, and neutral for unknown or unlisted pairs', () => {
    for (const a of ids) for (const b of ids) expect(stanceBetween(galaxy, a, b)).toBe(stanceBetween(galaxy, b, a));
    expect(stanceBetween(galaxy, 'navy', 'navy')).toBe('allied');
    expect(stanceBetween(galaxy, 'navy', 'nobody')).toBe('neutral');
    expect(stanceBetween(galaxy, 'navy', 'meridian')).toBe('neutral');
    expect(stanceBetween(galaxy, 'helix', 'vantor')).toBe('neutral');
    const sim = newGame(1, content);
    expect(atWar(sim, 'meridian', 'helix')).toBe(true);
    expect(atWar(sim, 'navy', 'navy')).toBe(false);
  });

  it('carries the spill both ways, as the faction table did', () => {
    expect(spillSources(galaxy, 'navy')).toContainEqual({ faction: 'pirates', weight: -0.6 });
    expect(spillSources(galaxy, 'pirates')).toContainEqual({ faction: 'navy', weight: -0.5 });
    expect(spillSources(galaxy, 'vantor').some((s) => s.faction === 'navy')).toBe(false);
    expect(spillSources(galaxy, 'navy')).toContainEqual({ faction: 'vantor', weight: 0.2 });
  });

  it('takes new factions as rows: pirates at war with each other, the cartel neutral with the Scrappers', () => {
    const more: GalaxyContent = {
      ...galaxy,
      factions: { ...galaxy.factions, raiders: { ...galaxy.factions['pirates']!, reputation: 'raiders' }, cartel: { ...galaxy.factions['pirates']!, reputation: 'cartel' } },
      relations: [
        ...galaxy.relations,
        { a: 'pirates', b: 'raiders', stance: 'war' }, { a: 'cartel', b: 'pirates', stance: 'neutral' }, { a: 'cartel', b: 'raiders', stance: 'war' },
      ],
    };
    expect(stanceBetween(more, 'pirates', 'raiders')).toBe('war');
    expect(stanceBetween(more, 'cartel', 'pirates')).toBe('neutral');
    expect(stanceBetween(more, 'raiders', 'cartel')).toBe('war');
    expect(stanceBetween(more, 'cartel', 'navy')).toBe('neutral');
  });
});

describe('faction stock specialities', () => {
  const sim = newGame(5, content);
  const count = (profile: string, owner: string | undefined, item: string): number => {
    let n = 0;
    for (let i = 1; i <= 60; i++) n += rollTrader(sim, profile, 'station.trading', 'S', i, true, owner).stock.find((l) => l.item === item)?.count ?? 0;
    return n;
  };

  it('stocks more of what its owner favours, and exactly as before of the rest', () => {
    expect(count('trader.station.trading', 'meridian', 'item.fuel')).toBeGreaterThan(count('trader.station.trading', undefined, 'item.fuel') * 1.15);
    expect(count('trader.station.trading', 'meridian', 'item.shuttle')).toBeGreaterThan(count('trader.station.trading', undefined, 'item.shuttle'));
    expect(count('trader.station.military', 'navy', 'item.missile')).toBeGreaterThan(count('trader.station.military', undefined, 'item.missile'));
    expect(count('trader.station.trading', 'meridian', 'item.metal')).toBe(count('trader.station.trading', undefined, 'item.metal'));
    expect(count('trader.station.trading', 'helix', 'item.ration')).toBeGreaterThan(count('trader.station.trading', undefined, 'item.ration'));
    expect(rollTrader(sim, 'trader.station.trading', 'station.trading', 'S', 7, true).credits).toBe(rollTrader(sim, 'trader.station.trading', 'station.trading', 'S', 7, true, 'vantor').credits);
  });

  it('sells fuel cheaper at Meridian stations, and nothing else', () => {
    const price = (owner: string, item: string): number => {
      const id = sim.world.createEntity();
      sim.world.add(id, TraderC, rollTrader(sim, 'trader.station.trading', 'station.trading', 'S', 3, true, owner));
      return unitPrice(sim, id, item, 'sell') as number;
    };
    const ratio = price('meridian', 'item.fuel') / price('vantor', 'item.fuel');
    // 15% off, before the price rounds to whole credits.
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.9);
    expect(price('meridian', 'item.metal')).toBe(price('vantor', 'item.metal'));
  });
});

/** Every blueprint port of a revealed galaxy with its danger forced to the deepest tier. */
function deepPorts(seed: number): { sim: Sim; ports: Port[] } {
  const sim = newGame(seed, content);
  sim.step();
  sim.enqueue({ type: 'debug.galaxyReveal', radius: 14 });
  sim.step();
  const nodes = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const n of nodes) (nodeOf(sim, n.id) as { danger: number }).danger = 9;
  const ports = nodes.flatMap((n) => portsAt(sim, n.id)).filter((p) => {
    const s = nodeOf(sim, p.node)!.structures[Number(p.id.slice(p.id.indexOf('#') + 1))];
    return galaxy.structures[s!.def]?.services?.includes('blueprints');
  });
  return { sim, ports };
}

describe('blueprint stock by owner', () => {
  it('always stocks the owner\'s speciality and thins the rest by a fixed roll', () => {
    let off = 0;
    let offStocked = 0;
    for (const seed of [1, 2, 3]) {
      const { sim, ports } = deepPorts(seed);
      sim.story.reputation['navy'] = 10; // lift the navy gate, so only the stock roll is left
      for (const p of ports) {
        const spec = galaxy.factions[p.owner]?.specialities?.blueprints;
        if (!spec || tierOf(sim, p.owner) === 'hostile') continue;
        const sold = new Set(portBlueprints(sim, p).map((o) => o.def));
        for (const [def, d] of Object.entries(sim.content.modules)) {
          if (!d.blueprint || (d.category === 'defence') !== (kindOf(sim, p) === 'military')) continue;
          if (spec.includes(d.category ?? 'utility')) expect(sold.has(def), `${p.id} ${def}`).toBe(true);
          else { off++; if (sold.has(def)) offStocked++; }
        }
      }
    }
    expect(off).toBeGreaterThan(10);
    expect(offStocked / off).toBeGreaterThan(0.45);
    expect(offStocked / off).toBeLessThan(0.95);
  });

  it('gates the navy\'s best defence gear by standing', () => {
    const { sim, ports } = deepPorts(1);
    const navy = ports.filter((p) => p.owner === 'navy' && kindOf(sim, p) === 'military');
    expect(navy.length).toBeGreaterThan(0);
    const p = navy[0] as Port;
    // Base standing 1: Mk II (needs 0) is for sale, Mk III (needs 3) is held back.
    const sold = (): string[] => portBlueprints(sim, p).map((o) => o.def);
    const held = (): string[] => gatedBlueprints(sim, p).map((o) => o.def);
    expect(sold()).toContain('module.shieldGen.mk2');
    expect(sold()).not.toContain('module.shieldGen.mk3');
    expect(held()).toContain('module.shieldGen.mk3');
    sim.story.reputation['navy'] = 2; // standing 3: friendly
    expect(sold()).toContain('module.shieldGen.mk3');
    expect(held()).toEqual([]);
    sim.story.reputation['navy'] = -2; // standing -1: not even Mk II
    expect(sold()).not.toContain('module.shieldGen.mk2');
    expect(held()).toContain('module.shieldGen.mk2');
    // Other owners' military stations have no gate.
    const other = ports.find((q) => q.owner !== 'navy' && kindOf(sim, q) === 'military' && tierOf(sim, q.owner) !== 'hostile');
    if (other) expect(gatedBlueprints(sim, other)).toEqual([]);
  });
});

/** The station type of a port's structure. */
function kindOf(sim: Sim, p: Port): string | undefined {
  const s = nodeOf(sim, p.node)!.structures[Number(p.id.slice(p.id.indexOf('#') + 1))];
  return galaxy.structures[s!.def]?.station;
}
