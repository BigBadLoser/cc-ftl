import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, DeadC, ForHireC, PositionC, VehicleC, deserialize, galaxyIndex, newGame, serialize, type Sim } from '../sim';
import { AllegianceC } from '../sim/fight/components';
import { portsAt } from '../sim/galaxy/portIndex';
import { portRecruits, recruitsHere } from '../sim/galaxy/recruit';
import { ensureAround } from '../sim/galaxy/state';
import { RECRUIT_TURNS } from '../sim/galaxy/tuningRecruit';
import { placementGapError } from '../sim/regions';
import { content } from '.';

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};
/** Deploy at the first free spot (a node's structures stand east of the west margin). */
function deploy(sim: Sim): void {
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return step(sim);
    }
  }
  throw new Error('no room to deploy');
}

/** A game whose player has dropped into a node with a trade station that posts candidates, run until the station's people have appeared. */
function atStation(): Sim {
  const sim = newGame(7, content);
  step(sim, 2);
  ensureAround(sim, sim.galaxy.current);
  const node = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
    .find((n) => portsAt(sim, n.id).some((p) => portRecruits(sim, p).length > 0));
  expect(node).toBeDefined();
  sim.enqueue({ type: 'debug.galaxyTeleport', node: node!.id });
  step(sim);
  deploy(sim);
  step(sim, 25);
  sim.events.drain();
  return sim;
}

const people = (sim: Sim): readonly number[] => sim.world.query(ForHireC);
const keyOf = (sim: Sim, id: number): string => sim.world.get(id, ForHireC)?.key ?? '';
const hire = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'crew.hire', key });
  sim.step();
  return sim.events.drain();
};
const rejected = (ev: ReturnType<Sim['events']['drain']>): string[] => ev.flatMap((e) => (e.type === 'command.rejected' && e.command === 'crew.hire' ? [e.reason] : []));
const playerCrew = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, AllegianceC)?.faction === 'player');
/** Step until `done` or the budget runs out; returns the events seen. */
function run(sim: Sim, done: () => boolean, max = 6000): ReturnType<Sim['events']['drain']> {
  const all: ReturnType<Sim['events']['drain']> = [];
  for (let i = 0; i < max && !done(); i++) {
    sim.step();
    all.push(...sim.events.drain());
  }
  return all;
}

describe('crew for hire', () => {
  it('the candidates are people aboard the station, with a stable derived identity', () => {
    const sim = atStation();
    const derived = recruitsHere(sim);
    expect(derived.length).toBeGreaterThan(0);
    const aboard = people(sim);
    expect(aboard.map((id) => keyOf(sim, id)).sort()).toEqual(derived.map((r) => r.key).sort());
    for (const id of aboard) {
      const fh = sim.world.get(id, ForHireC)!;
      const r = derived.find((x) => x.key === fh.key)!;
      expect(fh.cost).toBe(r.cost);
      expect(sim.world.get(id, CrewC)!.role).toBe(r.role);
      expect(sim.world.get(id, AllegianceC)!.faction).not.toBe('player');
      expect(sim.world.has(id, PositionC)).toBe(true);
    }
    sim.galaxy.turn += RECRUIT_TURNS;
    for (let i = 0; i < 25; i++) sim.step();
    expect(people(sim).map((id) => keyOf(sim, id)).sort()).toEqual(recruitsHere(sim).map((r) => r.key).sort());
    expect(people(sim).map((id) => keyOf(sim, id))).not.toEqual(aboard.map((id) => keyOf(sim, id)));
  });

  it('hiring holds the credits and sends the shuttle; the recruit ends up as player crew at home', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    const credits = (sim.trade.credits = 1000);
    const crew = playerCrew(sim).length;
    const ev = hire(sim, fh.key);
    expect(rejected(ev)).toEqual([]);
    expect(sim.trade.credits).toBe(credits - fh.cost);
    expect(sim.trade.deals[0]?.held).toBe(fh.cost);
    expect(rejected(hire(sim, fh.key))).toEqual(['dealOpen']);
    expect(playerCrew(sim).length).toBe(crew);
    const seen = run(sim, () => sim.world.get(c, AllegianceC)?.faction === 'player');
    expect(sim.world.get(c, AllegianceC)?.faction).toBe('player');
    expect(seen.some((e) => e.type === 'crew.hired')).toBe(true);
    expect(sim.world.has(c, ForHireC)).toBe(false);
    expect(sim.world.has(c, AboardC)).toBe(false);
    expect(playerCrew(sim).length).toBe(crew + 1);
    const pos = sim.world.get(c, PositionC)!;
    expect(pos).toBeDefined();
    run(sim, () => sim.trade.deals.every((d) => d.phase === 'done'));
    expect(sim.trade.deals[0]?.phase).toBe('done');
    expect(sim.trade.credits).toBe(credits - fh.cost);
    expect(sim.galaxy.recruitLog).toContain(fh.key);
    run(sim, () => sim.world.query(VehicleC).every((v) => sim.world.get(v, VehicleC)?.state === 'stowed'), 3000);
    expect(people(sim).some((id) => keyOf(sim, id) === fh.key)).toBe(false);
  });

  it('refunds when the run is called off, and the candidate stays hireable', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    const credits = (sim.trade.credits = 1000);
    hire(sim, fh.key);
    run(sim, () => sim.trade.deals[0]?.phase === 'out' || sim.trade.deals[0]?.phase === 'dockStation', 400);
    sim.enqueue({ type: 'trade.cancel', id: sim.trade.deals[0]!.id });
    run(sim, () => sim.trade.deals[0]?.phase === 'failed', 50);
    expect(sim.trade.deals[0]?.phase).toBe('failed');
    expect(sim.trade.credits).toBe(credits);
    expect(sim.world.get(c, AllegianceC)?.faction).not.toBe('player');
    expect(sim.world.has(c, ForHireC)).toBe(true);
    run(sim, () => sim.world.query(VehicleC).every((v) => sim.world.get(v, VehicleC)?.state === 'stowed'), 3000);
    expect(rejected(hire(sim, fh.key))).toEqual([]);
  });

  it('refunds when the recruit dies before the pickup', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    const credits = (sim.trade.credits = 1000);
    hire(sim, fh.key);
    sim.world.add(c, DeadC, {} as never);
    run(sim, () => sim.trade.deals[0]?.phase === 'failed', 200);
    expect(sim.trade.deals[0]?.reason).toBe('recruitGone');
    expect(sim.trade.credits).toBe(credits);
  });

  it('a candidate who dies is no longer for hire, and is not replaced in that window', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const key = keyOf(sim, c);
    sim.trade.credits = 1000;
    sim.world.add(c, DeadC, {} as never);
    expect(rejected(hire(sim, key))).toEqual(['noCandidate']);
    step(sim, 25);
    expect(sim.world.has(c, ForHireC)).toBe(false);
    expect(people(sim).map((id) => keyOf(sim, id))).not.toContain(key);
    expect(sim.trade.deals).toHaveLength(0);
  });

  it('rejects an unknown candidate, a poor player, no shuttle and a player away from a node', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    expect(rejected(hire(sim, 'nobody'))).toEqual(['noCandidate']);
    sim.trade.credits = fh.cost - 1;
    expect(rejected(hire(sim, fh.key))).toEqual(['cantAfford']);
    expect(sim.trade.credits).toBe(fh.cost - 1);
    sim.trade.credits = 1000;
    for (const v of sim.world.query(VehicleC)) sim.world.destroyEntity(v);
    expect(rejected(hire(sim, fh.key))).toEqual(['noShuttle']);
    expect(sim.trade.credits).toBe(1000);
    sim.galaxy.event = { encounter: 0 } as never;
    expect(rejected(hire(sim, fh.key))).toEqual(['notHere']);
  });

  it('survives a save and load in the middle of a run', () => {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    sim.trade.credits = 1000;
    hire(sim, fh.key);
    run(sim, () => sim.trade.deals[0]?.phase === 'stationWork', 3000);
    const back = deserialize(serialize(sim), content);
    expect(back.trade.deals[0]?.crew).toEqual([c]);
    run(back, () => back.world.get(c, AllegianceC)?.faction === 'player');
    expect(back.world.get(c, AllegianceC)?.faction).toBe('player');
    run(back, () => back.trade.deals[0]?.phase === 'done');
    expect(back.trade.credits).toBe(1000 - fh.cost);
    expect(back.galaxy.recruitLog).toContain(fh.key);
  });

  it('military stations offer nobody', () => {
    const sim = atStation();
    const mil = [...galaxyIndex(sim.galaxy).nodes.values()].find((n) => n.structures.some((s) => s.def === 'structure.station_military'));
    expect(mil).toBeDefined();
    const ports = portsAt(sim, mil!.id);
    expect(ports.length).toBeGreaterThan(0);
    for (const p of ports) expect(portRecruits(sim, p)).toEqual([]);
  });
});
