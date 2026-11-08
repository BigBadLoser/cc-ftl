import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, ShipC, TraderC, newGame, type Sim } from '../../sim';
import { content } from '../../content';
import { AllegianceC } from '../../sim/fight/components';
import { AwayC } from '../../sim/away/components';
import { hostileAct } from '../../sim/combat/provoke';
import { abortInspections } from '../../sim/inspect/flow';
import { InspectionC, type Inspection } from '../../sim/inspect/types';
import { repKey } from '../../sim/galaxy/standing';
import { shipIdOf } from '../../sim/regions';
import { reputationOf } from '../../sim/story/state';
import { INSPECT_FIGHT_BAN_TURNS, INSPECT_FIGHT_HIT } from '../../sim/blackmarket/tuning';
import { inspectCommands, inspectStation } from './inspect';
import { patrolCommands, patrolNode } from './patrol';

const live = (sim: Sim): [number, Inspection] => {
  const [id] = sim.world.query(InspectionC);
  return [id!, sim.world.get(id!, InspectionC)!];
};

/** Step until `done` holds (or `n` ticks), collecting the events. */
function until(sim: Sim, done: () => boolean, n = 6000): string[] {
  const seen: string[] = [];
  for (let i = 0; i < n && !done(); i++) {
    sim.step();
    for (const e of sim.events.drain()) seen.push(e.type);
    sim.story.active = null;
  }
  return seen;
}

/** A station inspection with the inspectors aboard and searching. */
function stationSearch(): Sim {
  const sim = newGame(3, content);
  for (let i = 0; i < 20; i++) sim.step();
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy' });
  sim.step();
  for (const cmd of inspectCommands(sim, inspectStation(sim)!)) sim.enqueue(cmd);
  sim.step();
  until(sim, () => live(sim)[1].phase === 'search');
  return sim;
}

/** A patrol inspection (hailed, complied, deployed) with the inspectors aboard and searching. */
function patrolSearch(): Sim {
  const sim = newGame(3, content);
  for (let i = 0; i < 20; i++) sim.step();
  for (const cmd of patrolCommands(sim, patrolNode(sim)!)) sim.enqueue(cmd);
  until(sim, () => sim.galaxy.travel?.phase === 'interdicted', 400);
  const e = sim.galaxy.encounters.find((x) => x.scan)!;
  sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'comply' });
  sim.step();
  sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
  until(sim, () => sim.world.query(InspectionC).length > 0 && live(sim)[1].phase === 'search');
  return sim;
}

/** Draft one of the player's crew on the inspected ship and order them to attack the lead inspector. */
function attackLead(sim: Sim): void {
  const [, insp] = live(sim);
  const me = sim.world.query(CrewC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(c, PositionC)!) === insp.ship)!;
  sim.enqueue({ type: 'crew.draft', id: me, drafted: true });
  sim.step();
  sim.enqueue({ type: 'crew.attack', id: me, target: insp.crew[0]! });
  sim.step();
}

describe('fighting and refusing the inspectors (#138 step 3)', () => {
  it('attacking a station inspector: a big standing hit, the inspectors and the station turn hostile, service is barred longer, and they fight back', () => {
    const sim = stationSearch();
    const [, insp] = live(sim);
    const key = repKey(sim, insp.faction);
    const before = reputationOf(sim.story, key);
    attackLead(sim);
    expect(insp.phase).toBe('fight');
    expect(reputationOf(sim.story, key)).toBe(before - INSPECT_FIGHT_HIT);
    for (const c of insp.crew) expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
    expect(sim.world.get(insp.station, TraderC)?.barredUntil).toBeGreaterThanOrEqual(sim.galaxy.turn + INSPECT_FIGHT_BAN_TURNS);
    // The inspectors fight back (they are boarders now), and the station's guns engage.
    const struck: number[] = [];
    for (let i = 0; i < 1800 && !(struck.length && sim.sector.inCombat); i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'crew.attacked' && insp.crew.includes(e.crew)) struck.push(e.crew);
    }
    expect(sim.sector.inCombat).toBe(true);
    expect(struck.length).toBeGreaterThan(0);
  });

  it('attacking a patrol\'s inspector turns the patrol ship hostile', () => {
    const sim = patrolSearch();
    const [, insp] = live(sim);
    expect(insp.patrol).toBeDefined();
    attackLead(sim);
    expect(insp.phase).toBe('fight');
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
  });

  it('refusing a patrol\'s inspectors: they leave with the goods, then the patrol turns hostile', () => {
    const sim = patrolSearch();
    const [id, insp] = live(sim);
    until(sim, () => insp.phase === 'settle');
    const key = repKey(sim, insp.faction);
    const before = reputationOf(sim.story, key);
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'refuse' });
    sim.step();
    expect(insp.phase).toBe('leave');
    expect(reputationOf(sim.story, key)).toBeLessThan(before);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('neutral'); // a beat first
    const seen = until(sim, () => sim.world.get(insp.station, ShipC)?.faction === 'hostile', 2000);
    expect(seen).toContain('inspect.turned');
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
  });

  it('firing on the patrol ship while its inspectors search makes them fight too', () => {
    const sim = patrolSearch();
    const [, insp] = live(sim);
    hostileAct(sim, insp.station, 'fired');
    sim.step();
    expect(insp.phase).toBe('fight');
    for (const c of insp.crew) expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
  });

  it('leaving mid-fight keeps the inspectors aboard as hostile crew; the inspection ends', () => {
    const sim = stationSearch();
    attackLead(sim);
    const [, insp] = live(sim);
    const aboard = insp.crew.filter((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && shipIdOf(sim, p) === insp.ship;
    });
    expect(aboard.length).toBeGreaterThan(0);
    abortInspections(sim);
    expect(sim.world.query(InspectionC)).toEqual([]);
    for (const c of aboard) {
      expect(sim.world.has(c, CrewC)).toBe(true);
      expect(sim.world.has(c, AwayC)).toBe(false);
      expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
    }
  });

  it('a station refusal stays as built: barred and a hit, the station stays neutral', () => {
    const sim = stationSearch();
    const [id, insp] = live(sim);
    until(sim, () => insp.phase === 'settle');
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'refuse' });
    until(sim, () => sim.world.query(InspectionC).length === 0, 3000);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('neutral');
    expect(sim.world.get(insp.station, TraderC)?.barredUntil).toBeGreaterThan(sim.galaxy.turn);
  });
});
