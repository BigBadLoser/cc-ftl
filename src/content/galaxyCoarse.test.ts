import { describe, expect, it } from 'vitest';
import { exploredWorld, measurePace } from '../../test/support/fixtures/coarse';
import { cachedWorld } from '../../test/support/world';
import { stepCoarse } from '../sim/galaxy/coarse';
import { nodeOwner, sectorNeighbours, sectorOwner, structureOwner, tidyControl } from '../sim/galaxy/control';
import { flipSector } from '../sim/galaxy/flip';
import { econOf } from '../sim/galaxy/market';
import { owe, portsAt } from '../sim/galaxy/portIndex';
import { addPressure, fightPressure, playerFightPressure } from '../sim/galaxy/pressure';
import { atWar } from '../sim/galaxy/relations';
import { ensureChunk, galaxyIndex, nodeOf, START_NODE } from '../sim/galaxy/state';
import { onTurn } from '../sim/galaxy/turn';
import { COARSE_TURNS, CONSOLIDATE_TICKS, FACTION_MIN_SECTORS, FLIP_COOLDOWN, FLIP_SPACING, FLIP_TICKS, FLIPS_PER_TICK, PRESSURE_MAX } from '../sim/galaxy/tuningCoarse';
import type { StructureRef } from '../sim/galaxy/types';
import { newGame } from '../sim/newGame';
import { deserialize, serialize } from '../sim/save';
import type { Sim } from '../sim/sim';
import { content } from '.';

/** A world with the chunks around the start generated: 11 x 11 chunks, about 160 sectors, a handful of fronts. */
function world(): Sim {
  const sim = newGame(3, content);
  for (let cy = -5; cy <= 5; cy++) for (let cx = -5; cx <= 5; cx++) ensureChunk(sim, cx, cy);
  return sim;
}
const base = (): Sim => cachedWorld('coarse.world', world);
const tickAt = (n: number): number => n * COARSE_TURNS;
const galaxyOf = (sim: Sim): NonNullable<Sim['content']['galaxy']> => sim.content.galaxy as NonNullable<Sim['content']['galaxy']>;
const startSector = (sim: Sim): string => nodeOf(sim, START_NODE)?.sector as string;
const countOf = (sim: Sim, faction: string): number => [...galaxyIndex(sim.galaxy).sectors.keys()].filter((id) => sectorOwner(sim, id) === faction).length;
const firstNode = (sim: Sim, sector: string): string => galaxyIndex(sim.galaxy).sectors.get(sector)?.nodes[0] as string;
const nodeData = (sim: Sim, sector: string): NonNullable<ReturnType<typeof nodeOf>> => nodeOf(sim, firstNode(sim, sector)) as NonNullable<ReturnType<typeof nodeOf>>;

/** A faction at war with `owner` that fields ships, a law-abiding one if there is one (pirates need more pressure to take a sector). */
function enemyOf(sim: Sim, owner: string): string {
  const foes = Object.keys(galaxyOf(sim).factions).sort().filter((f) => f !== owner && atWar(sim, f, owner) && Object.keys(galaxyOf(sim).factions[f]?.fleet?.groups ?? {}).length > 0);
  return (foes.find((f) => galaxyOf(sim).factions[f]?.kind !== 'pirates') ?? foes[0]) as string;
}

/**
 * Sectors that may flip (not the start, not a hub, held by a faction with sectors to spare) and are not lane-adjacent to each other, in id order. The natural
 * fronts of a galaxy are few, so tests make their own: `arm` gives one of these an enemy neighbour and full pressure.
 */
function candidates(sim: Sim, n: number): string[] {
  const index = galaxyIndex(sim.galaxy);
  const lanes = sectorNeighbours(index);
  const out: string[] = [];
  for (const id of [...index.sectors.keys()].sort()) {
    const owner = sectorOwner(sim, id);
    if (!owner || index.sectors.get(id)?.hub || id === startSector(sim) || countOf(sim, owner) <= FACTION_MIN_SECTORS + 10 || !(lanes.get(id) ?? []).length) continue;
    if (out.some((o) => o === id || (lanes.get(o) ?? []).includes(id) || (lanes.get(o) ?? []).some((x) => (lanes.get(id) ?? []).includes(x)))) continue;
    out.push(id);
    if (out.length === n) break;
  }
  return out;
}

/** Give `target` an enemy of its owner for a neighbour, with its sectors around it (so its push beats the defence), and put the target under full pressure `ticks` ticks in. Returns the taker. */
function arm(sim: Sim, target: string, ticks: number): string {
  const owner = sectorOwner(sim, target) as string;
  const by = enemyOf(sim, owner);
  const lanes = sectorNeighbours(galaxyIndex(sim.galaxy));
  const ring1 = lanes.get(target) ?? [];
  const ring2 = ring1.flatMap((a) => lanes.get(a) ?? []).filter((a) => a !== target && !ring1.includes(a));
  for (const id of [...new Set([...ring1, ...ring2])].slice(0, 8)) sim.galaxy.control[id] = { owner: by, since: 1 };
  sim.galaxy.control[target] = { owner, since: 0, pressure: { by, value: PRESSURE_MAX, ticks } };
  return by;
}

/**
 * Keep the rest of the galaxy from flipping during a short run (the real fronts of this world press hard and would take the per-tick cap and the spacing):
 * every sector without an entry gets one that says it changed hands at turn 1, which holds it for the cooldown. Pressure still builds on it.
 */
function freezeOthers(sim: Sim, keep: readonly string[]): void {
  for (const id of galaxyIndex(sim.galaxy).sectors.keys()) if (!keep.includes(id) && !sim.galaxy.control[id]) sim.galaxy.control[id] = { owner: sectorOwner(sim, id), since: 1 };
}

describe('who owns it', () => {
  it('is the generated owner until a control entry says otherwise, for sectors, nodes and stations', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t) as string;
    const by = enemyOf(sim, owner);
    const node = nodeData(sim, t);
    const station: StructureRef = { def: 'structure.station_trade', genOwner: node.genFaction };
    expect(owner).toBe(node.genFaction);
    expect(nodeOwner(sim, node)).toBe(owner);
    expect(structureOwner(sim, node, station)).toBe(owner);
    sim.galaxy.control[t] = { owner: by, since: 5 };
    expect(sectorOwner(sim, t)).toBe(by);
    expect(nodeOwner(sim, node)).toBe(by);
    expect(structureOwner(sim, node, station)).toBe(by);
  });

  it('leaves what is not the sector faction\'s alone: a derelict, a free trader, another faction\'s station', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    sim.galaxy.control[t] = { owner: enemyOf(sim, sectorOwner(sim, t) as string), since: 5 };
    const node = nodeData(sim, t);
    expect(structureOwner(sim, node, { def: 'structure.derelict', genOwner: null })).toBeNull();
    expect(structureOwner(sim, node, { def: 'structure.station_trade', genOwner: 'traders' })).toBe('traders');
    expect(structureOwner(sim, node, { def: 'structure.station_pirate', genOwner: 'pirates' })).toBe('pirates');
  });

  it('keeps control only where it differs from the generated state', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t) as string;
    const by = enemyOf(sim, owner);
    flipSector(sim, t, by, 8);
    expect(sim.galaxy.control[t]?.owner).toBe(by);
    flipSector(sim, t, owner, 16);
    // Back in its generated hands, the entry only lingers while the sector cools down and consolidates.
    expect(sim.galaxy.control[t]?.owner).toBe(owner);
    sim.galaxy.turn = 16 + COARSE_TURNS * Math.max(FLIP_COOLDOWN, CONSOLIDATE_TICKS);
    stepCoarse(sim, sim.galaxy.turn);
    expect(sim.galaxy.control[t]).toBeUndefined();
    addPressure(sim, firstNode(sim, t), by, 0.3);
    expect(sim.galaxy.control[t]?.pressure?.value).toBeCloseTo(0.3);
    addPressure(sim, firstNode(sim, t), owner, 0.5);
    expect(sim.galaxy.control[t]).toBeUndefined();
  });
});

describe('the coarse tick', () => {
  it('does nothing off its turns', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    arm(sim, t, FLIP_TICKS - 1);
    const before = JSON.stringify(sim.galaxy.control);
    for (const turn of [1, 3, COARSE_TURNS + 1, 2 * COARSE_TURNS - 1]) stepCoarse(sim, turn);
    expect(JSON.stringify(sim.galaxy.control)).toBe(before);
  });

  it('changes no owner before FLIP_TICKS ticks in a row, then flips the sector once and says so', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t);
    const by = arm(sim, t, 0);
    freezeOthers(sim, [t]);
    for (let k = 1; k < FLIP_TICKS; k++) {
      stepCoarse(sim, tickAt(k));
      expect(sectorOwner(sim, t), `tick ${k}`).toBe(owner);
    }
    stepCoarse(sim, tickAt(FLIP_TICKS));
    expect(sectorOwner(sim, t)).toBe(by);
    expect(sim.galaxy.control[t]?.pressure).toBeUndefined();
    expect(sim.galaxy.news.some((n) => n.kind === 'fell' && n.faction === by && n.foeFaction === owner && n.who === galaxyIndex(sim.galaxy).sectors.get(t)?.name)).toBe(true);
  });

  it('resets the count when the pressure falls below the threshold', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t);
    arm(sim, t, FLIP_TICKS - 1);
    (sim.galaxy.control[t] as NonNullable<(typeof sim.galaxy.control)[string]>).pressure!.value = 0.2;
    stepCoarse(sim, tickAt(1));
    expect(sectorOwner(sim, t)).toBe(owner);
    expect(sim.galaxy.control[t]?.pressure?.ticks ?? 0).toBe(0);
  });

  it('flips at most FLIPS_PER_TICK sectors, and never two within FLIP_SPACING lanes, in one tick', () => {
    const sim = base();
    const lanes = sectorNeighbours(galaxyIndex(sim.galaxy));
    // Two ready sectors three or four lanes apart (inside the spacing) and one far away.
    const [a] = candidates(sim, 1) as [string];
    const dist = new Map([[a, 0]]);
    for (let ring = [a]; ring.length; ) {
      ring = ring.flatMap((x) => (lanes.get(x) ?? []).filter((o) => !dist.has(o) && (dist.set(o, (dist.get(x) as number) + 1), true)));
    }
    const nearby = [...dist].filter(([id, d]) => d >= 3 && d <= 4 && sectorOwner(sim, id) && countOf(sim, sectorOwner(sim, id) as string) > FACTION_MIN_SECTORS + 10 && !galaxyIndex(sim.galaxy).sectors.get(id)?.hub && id !== startSector(sim)).map(([id]) => id);
    expect(nearby.length).toBeGreaterThan(0);
    const far = candidates(sim, 60).find((id) => (dist.get(id) ?? 99) > FLIP_SPACING + 2) as string;
    expect(far).toBeDefined();
    const picks = [a, nearby[0] as string, far];
    const taker = picks.map((t) => arm(sim, t, FLIP_TICKS - 1));
    freezeOthers(sim, picks);
    picks.forEach((t, i) => ((sim.galaxy.control[t] as NonNullable<(typeof sim.galaxy.control)[string]>).pressure!.value = PRESSURE_MAX - i * 0.2));
    const flipped = (): string[] => picks.filter((t, i) => sectorOwner(sim, t) === taker[i]);
    stepCoarse(sim, tickAt(1));
    expect(flipped().length).toBeLessThanOrEqual(FLIPS_PER_TICK);
    expect(flipped()).toContain(a);
    expect(flipped()).not.toContain(nearby[0]);
    expect(flipped()).toContain(far);
  });

  it('never flips the start sector or a hub, nor a faction\'s last sectors, nor the player\'s own sector', () => {
    const sim = base();
    const index = galaxyIndex(sim.galaxy);
    const hub = [...index.sectors.values()].find((s) => s.hub && s.id !== startSector(sim) && sectorOwner(sim, s.id) && (sectorNeighbours(index).get(s.id) ?? []).length) as NonNullable<ReturnType<typeof index.sectors.get>>;
    for (const id of [hub.id, startSector(sim)]) {
      arm(sim, id, FLIP_TICKS - 1);
      stepCoarse(sim, tickAt(1));
      expect(sectorOwner(sim, id), id).toBe(index.sectors.get(id)?.genFaction);
    }
    // A faction down to its last sectors keeps them.
    const [t, own] = candidates(sim, 2) as [string, string];
    const owner = sectorOwner(sim, t) as string;
    const mine = [...index.sectors.keys()].filter((id) => sectorOwner(sim, id) === owner && id !== t).sort();
    for (const id of mine.slice(FACTION_MIN_SECTORS - 1)) sim.galaxy.control[id] = { owner: enemyOf(sim, owner), since: 1 };
    expect(countOf(sim, owner)).toBe(FACTION_MIN_SECTORS);
    arm(sim, t, FLIP_TICKS - 1);
    stepCoarse(sim, tickAt(2));
    expect(sectorOwner(sim, t)).toBe(owner);
    // The sector the player is in.
    sim.galaxy.current = firstNode(sim, own);
    const ownOwner = sectorOwner(sim, own);
    arm(sim, own, FLIP_TICKS - 1);
    stepCoarse(sim, tickAt(3));
    expect(sectorOwner(sim, own)).toBe(ownOwner);
  });

  it('builds pressure on its own at a front, and wears it off when the push stops', () => {
    const sim = base();
    const index = galaxyIndex(sim.galaxy);
    const lanes = sectorNeighbours(index);
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t) as string;
    const by = enemyOf(sim, owner);
    // A strong enemy at the gate: its sectors around the target outweigh the target's defence. No pressure yet.
    arm(sim, t, 0);
    delete (sim.galaxy.control[t] as NonNullable<(typeof sim.galaxy.control)[string]>).pressure;
    stepCoarse(sim, tickAt(1));
    const p = sim.galaxy.control[t]?.pressure;
    expect(p?.by).toBe(by);
    expect(p?.value ?? 0).toBeGreaterThan(0);
    // The push stops: no sector of the enemy borders it any more.
    for (const a of lanes.get(t) ?? []) if (sectorOwner(sim, a) === by) sim.galaxy.control[a] = { owner, since: 2 };
    const v = sim.galaxy.control[t]?.pressure?.value ?? 0;
    stepCoarse(sim, tickAt(2));
    expect(sim.galaxy.control[t]?.pressure?.value ?? 0).toBeLessThan(v);
  });

  it('does not flip a sector back until it has cooled down', () => {
    const sim = base();
    // Both sides need sectors to spare, or the protection of a faction's last ones would hold the flip back instead.
    const big = (f: string): boolean => countOf(sim, f) > FACTION_MIN_SECTORS + 2;
    const foes = (o: string): string[] => Object.keys(galaxyOf(sim).factions).filter((f) => big(f) && atWar(sim, f, o));
    const t = candidates(sim, 40).find((id) => foes(sectorOwner(sim, id) as string).length > 0) as string;
    const owner = sectorOwner(sim, t) as string;
    const by = foes(owner)[0] as string;
    const lanes = sectorNeighbours(galaxyIndex(sim.galaxy));
    const back = (): void => {
      sim.galaxy.control[t] = { ...(sim.galaxy.control[t] as NonNullable<(typeof sim.galaxy.control)[string]>), pressure: { by: owner, value: PRESSURE_MAX, ticks: FLIP_TICKS - 1 } };
    };
    for (const a of lanes.get(t) ?? []) sim.galaxy.control[a] = { owner, since: 0 };
    sim.galaxy.turn = tickAt(1);
    flipSector(sim, t, by, tickAt(1));
    back();
    sim.galaxy.turn = tickAt(2);
    stepCoarse(sim, tickAt(2));
    expect(sectorOwner(sim, t)).toBe(by);
    back();
    sim.galaxy.turn = tickAt(1 + FLIP_COOLDOWN);
    stepCoarse(sim, tickAt(1 + FLIP_COOLDOWN));
    expect(sectorOwner(sim, t)).toBe(owner);
  });

  it('is deterministic and survives a save', () => {
    // Not `expectReplayable`: a coarse tick is eight turns of three minutes, so this drives `onTurn` itself and compares the control it leaves.
    const run = (sim: Sim, from: number, to: number): void => {
      for (let n = from; n <= to; n++) onTurn(sim, ++sim.galaxy.turn);
    };
    const build = (): Sim => {
      const sim = base();
      for (const t of candidates(sim, 3)) arm(sim, t, 0);
      return sim;
    };
    const a = build();
    run(a, 1, 60);
    const b = build();
    run(b, 1, 60);
    expect(JSON.stringify(a.galaxy.control)).toBe(JSON.stringify(b.galaxy.control));
    expect(Object.values(a.galaxy.control).some((c) => c.owner !== galaxyIndex(a.galaxy).sectors.get(Object.keys(a.galaxy.control)[0] as string)?.genFaction)).toBe(true);
    // Saved and reloaded partway: the rest of the run matches the straight run.
    const c = build();
    run(c, 1, 29);
    const d = deserialize(serialize(c), content);
    run(d, 30, 60);
    expect(JSON.stringify(d.galaxy.control)).toBe(JSON.stringify(a.galaxy.control));
  });
});

describe('the handover to the fine tier', () => {
  it('queues the new owner\'s fleets at a flipped port, builds them, and rehomes the old ones', () => {
    const sim = base();
    const index = galaxyIndex(sim.galaxy);
    const t = candidates(sim, 40).find((id) => index.sectors.get(id)?.nodes.some((n) => portsAt(sim, n).some((p) => p.kind === 'station' && p.owner === sectorOwner(sim, id)))) as string;
    const owner = sectorOwner(sim, t) as string;
    const by = enemyOf(sim, owner);
    const sectorPorts = (): ReturnType<typeof portsAt> => (index.sectors.get(t)?.nodes ?? []).flatMap((n) => portsAt(sim, n));
    const ports = sectorPorts().filter((p) => p.owner === owner);
    const homed = (f: string): number => sim.galaxy.fleets.filter((x) => ports.some((p) => p.id === x.home) && x.faction === f).length;
    expect(homed(owner)).toBeGreaterThan(0);
    const turn = sim.galaxy.turn;
    sim.galaxy.fleets.forEach((f) => (f.synced = turn));
    flipSector(sim, t, by, turn);
    // Nothing of the old owner is left homed there; the ports owe their new owner's ships.
    expect(homed(owner)).toBe(0);
    const owed = sectorPorts().filter((p) => p.owner === by && (sim.galaxy.ports[p.id]?.queue.length ?? 0) > 0);
    expect(owed.length).toBeGreaterThan(0);
    for (const p of owed) expect((sim.galaxy.ports[p.id]?.queue ?? []).every((q) => q.faction === by)).toBe(true);
    // With the player near, the port builds them, one per rebuild period (a den takes a long while).
    sim.galaxy.current = (owed[0] as (typeof owed)[number]).node;
    for (let i = 0; i < 400 && homed(by) === 0; i++) onTurn(sim, ++sim.galaxy.turn);
    expect(homed(by)).toBeGreaterThan(0);
    expect(homed(owner)).toBe(0);
  });
});

describe('the fine tier feeds the coarse', () => {
  it('a win over the sector owner builds pressure, a win at home relieves it, and a stranger\'s fight counts for nothing', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t) as string;
    const by = enemyOf(sim, owner);
    const node = firstNode(sim, t);
    fightPressure(sim, node, by, owner, 1, false);
    const v = sim.galaxy.control[t]?.pressure?.value ?? 0;
    expect(v).toBeGreaterThan(0);
    fightPressure(sim, node, by, 'nobody', 2, false);
    expect(sim.galaxy.control[t]?.pressure?.value).toBe(v);
    fightPressure(sim, node, owner, by, 3, false);
    expect(sim.galaxy.control[t]).toBeUndefined();
  });
});

describe('expansion into unowned space', () => {
  /** An unowned sector next to a sector of a faction that settles, with that faction's sectors around it. */
  function claim(sim: Sim, ok: (f: string) => boolean): { t: string; by: string } {
    const index = galaxyIndex(sim.galaxy);
    const lanes = sectorNeighbours(index);
    for (const id of [...index.sectors.keys()].sort()) {
      if (sectorOwner(sim, id) || index.sectors.get(id)?.hub) continue;
      const by = (lanes.get(id) ?? []).map((a) => sectorOwner(sim, a)).find((o): o is string => !!o && ok(o));
      if (by && id !== startSector(sim)) return { t: id, by };
    }
    throw new Error('no unowned sector beside a matching faction');
  }
  const kind = (sim: Sim, f: string): string | undefined => galaxyOf(sim).factions[f]?.kind;

  it('a settling faction claims an unowned sector once its pressure has held, and says so', () => {
    const sim = base();
    const { t, by } = claim(sim, (f) => kind(sim, f) !== 'pirates' && kind(sim, f) !== 'rogue' && !!galaxyOf(sim).factions[f]?.fleet);
    sim.galaxy.control[t] = { owner: null, since: 0, pressure: { by, value: PRESSURE_MAX, ticks: FLIP_TICKS - 1 } };
    freezeOthers(sim, [t]);
    stepCoarse(sim, tickAt(1));
    expect(sectorOwner(sim, t)).toBe(by);
    expect(sim.galaxy.news.some((n) => n.kind === 'fell' && n.faction === by && !n.foeFaction)).toBe(true);
  });

  it('pirates raid rather than settle: a sector beside only a pirate one gets no push', () => {
    const sim = base();
    const { t } = claim(sim, (f) => kind(sim, f) === 'pirates');
    const lanes = sectorNeighbours(galaxyIndex(sim.galaxy));
    // Leave the unowned sector with pirate neighbours only.
    for (const a of lanes.get(t) ?? []) if (sectorOwner(sim, a) && kind(sim, sectorOwner(sim, a) as string) !== 'pirates') sim.galaxy.control[a] = { owner: null, since: 1 };
    stepCoarse(sim, tickAt(1));
    expect(sim.galaxy.control[t]?.pressure).toBeUndefined();
  });
});

describe('the player\'s fights', () => {
  it('destroying or taking a ship of the faction holding the sector pushes for an enemy of it that borders the sector', () => {
    const sim = base();
    const [t] = candidates(sim, 1) as [string];
    const owner = sectorOwner(sim, t) as string;
    const by = arm(sim, t, 0);
    delete (sim.galaxy.control[t] as NonNullable<(typeof sim.galaxy.control)[string]>).pressure;
    sim.galaxy.current = firstNode(sim, t);
    playerFightPressure(sim, 'nobody');
    expect(sim.galaxy.control[t]?.pressure).toBeUndefined();
    playerFightPressure(sim, owner);
    expect(sim.galaxy.control[t]?.pressure?.by).toBe(by);
    expect(sim.galaxy.control[t]?.pressure?.value ?? 0).toBeGreaterThan(0);
  });
});

describe('review fixes', () => {
  it('a port does not owe a ship of a faction at war with its owner (a fleet left homed at a captured port)', () => {
    const sim = base();
    const port = [...galaxyIndex(sim.galaxy).nodes.keys()].flatMap((id) => portsAt(sim, id)).find((p) => p.owner === 'navy');
    expect(port).toBeDefined();
    owe(sim, port!.id, 'pirates', 'pirate', 'small', 5);
    expect(sim.galaxy.ports[port!.id]).toBeUndefined();
    owe(sim, port!.id, 'navy', 'patrol', 'small', 5);
    expect(sim.galaxy.ports[port!.id]?.queue).toEqual([{ faction: 'navy', role: 'patrol', size: 'small' }]);
  });

  it('a retaken sector keeps its control entry (and so its consolidation) until the longer of the cooldown and the consolidation has run out', () => {
    const sim = base();
    const [id] = candidates(sim, 1);
    const owner = sectorOwner(sim, id as string);
    const by = enemyOf(sim, owner as string);
    flipSector(sim, id as string, by, tickAt(1));
    flipSector(sim, id as string, owner as string, tickAt(2));
    sim.galaxy.turn = tickAt(2 + FLIP_COOLDOWN + 1);
    tidyControl(sim, id as string);
    expect(sim.galaxy.control[id as string]).toBeDefined();
    sim.galaxy.turn = tickAt(2 + CONSOLIDATE_TICKS);
    tidyControl(sim, id as string);
    expect(sim.galaxy.control[id as string]).toBeUndefined();
  });

  it("a port that changes hands trades as its new owner's market, even when its old economy was already built", () => {
    const sim = base();
    const sectors = galaxyIndex(sim.galaxy).sectors;
    const found = candidates(sim, sectors.size).flatMap((id) => sectors.get(id)!.nodes.flatMap((n) => portsAt(sim, n)).filter((p) => econOf(sim, p)).map((p) => [id, p] as const))[0];
    expect(found).toBeDefined();
    const [id, port] = found!;
    const before = econOf(sim, port);
    flipSector(sim, id, enemyOf(sim, sectorOwner(sim, id) as string), tickAt(1));
    const after = portsAt(sim, port.node).find((p) => p.id === port.id)!;
    expect(after.owner).not.toBe(port.owner);
    expect(econOf(sim, after)).not.toBe(before);
  });
});

describe('the pace guard', () => {
  it('flips now and then, with little ping-pong, and never twice in one region at once (the long sweep is in galaxyCoarse.slow.test.ts)', () => {
    const { sim, walker } = exploredWorld(3, 30);
    const pace = measurePace(sim, walker, 45);
    expect(pace.doubles).toBe(0);
    expect(pace.galaxy).toBeGreaterThan(0);
    expect(pace.retakes).toBeLessThanOrEqual(0.45);
  });
});
