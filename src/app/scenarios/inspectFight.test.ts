import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, ShipC, TraderC, galaxyIndex, newGame, playerShip, type Sim } from '../../sim';
import { content } from '../../content';
import { AllegianceC } from '../../sim/fight/components';
import { AwayC } from '../../sim/away/components';
import { hostileAct } from '../../sim/combat/provoke';
import { abortInspections } from '../../sim/inspect/flow';
import { InspectionC, type Inspection } from '../../sim/inspect/types';
import { repKey } from '../../sim/galaxy/standing';
import { shipIdOf } from '../../sim/regions';
import { reputationOf } from '../../sim/story/state';
import { INSPECT_FIGHT_BAN_TURNS, INSPECT_FIGHT_HIT, INSPECT_PATROL_REFUSE_HIT } from '../../sim/blackmarket/tuning';
import { AWAY_LIFT_SEC } from '../../sim/tuning';
import { TICK_HZ } from '../../sim/time';
import { DeadC, HealthC } from '../../sim/crew/components';
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

  it('refusing a patrol\'s inspectors: a bigger standing hit, they leave with the goods, and the patrol stays peaceful', () => {
    const sim = patrolSearch();
    const [id, insp] = live(sim);
    until(sim, () => insp.phase === 'settle');
    const key = repKey(sim, insp.faction);
    const before = reputationOf(sim.story, key);
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'refuse' });
    sim.step();
    expect(insp.phase).toBe('leave');
    expect(reputationOf(sim.story, key)).toBe(before - INSPECT_PATROL_REFUSE_HIT);
    until(sim, () => sim.world.query(InspectionC).length === 0, 8000);
    expect(sim.world.query(InspectionC)).toEqual([]);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('neutral');
    expect(sim.sector.inCombat).toBe(false);
  });

  it('leaving the node with inspectors aboard carries them off: a fight (hostile source, the fight\'s hit and bar), and they come along as boarders', () => {
    const sim = stationSearch();
    const [, insp] = live(sim);
    const key = repKey(sim, insp.faction);
    const before = reputationOf(sim.story, key);
    const aboard = insp.crew.filter((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && shipIdOf(sim, p) === insp.ship;
    });
    expect(aboard.length).toBeGreaterThan(0);
    abortInspections(sim); // what galaxy.jump and the flee call on the way out
    expect(reputationOf(sim.story, key)).toBe(before - INSPECT_FIGHT_HIT);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
    expect(sim.world.get(insp.station, TraderC)?.barredUntil).toBeGreaterThanOrEqual(sim.galaxy.turn + INSPECT_FIGHT_BAN_TURNS);
    for (const c of aboard) expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
  });

  it('leaving a patrol with its inspectors aboard turns the patrol hostile too', () => {
    const sim = patrolSearch();
    const [, insp] = live(sim);
    abortInspections(sim);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
  });

  it('leaving before the inspectors are aboard is refusing them: no hostility', () => {
    const sim = newGame(3, content);
    for (let i = 0; i < 20; i++) sim.step();
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy' });
    sim.step();
    for (const cmd of inspectCommands(sim, inspectStation(sim)!)) sim.enqueue(cmd);
    sim.step();
    const [, insp] = live(sim);
    expect(insp.phase).toBe('fly');
    const key = repKey(sim, insp.faction);
    const before = reputationOf(sim.story, key);
    abortInspections(sim);
    expect(reputationOf(sim.story, key)).toBeLessThan(before);
    expect(reputationOf(sim.story, key)).toBeGreaterThan(before - INSPECT_FIGHT_HIT);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('neutral');
    expect(sim.world.get(insp.station, TraderC)?.barredUntil).toBeGreaterThan(sim.galaxy.turn);
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

  it('jumping away mid-fight: the hostile inspectors aboard travel with the ship and fight on after arrival', () => {
    const sim = stationSearch();
    attackLead(sim);
    const [, insp] = live(sim);
    const ship = insp.ship;
    const aboard = insp.crew.filter((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && shipIdOf(sim, p) === ship;
    });
    expect(aboard.length).toBeGreaterThan(0);
    const g = sim.galaxy;
    const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'debug.giveItems', item: 'item.fuel', count: 30 });
    sim.enqueue({ type: 'debug.chargeFtl' });
    sim.step();
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.world.query(InspectionC)).toEqual([]);
    until(sim, () => sim.galaxy.travel?.phase !== 'hop', 2000);
    sim.galaxy.travel!.stopping = true;
    sim.enqueue({ type: 'galaxy.drop' });
    until(sim, () => sim.sector.state === 'deploying', 200);
    sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
    until(sim, () => sim.sector.state === 'active', 50);
    expect(sim.sector.state).toBe('active');
    const me = playerShip(sim);
    for (const c of aboard) {
      expect(sim.world.has(c, CrewC)).toBe(true);
      expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
      expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(me);
    }
    // They fight on: an inspector strikes again.
    let struck = false;
    for (let i = 0; i < 1800 && !struck; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'crew.attacked' && aboard.includes(e.crew)) struck = true;
    }
    expect(struck).toBe(true);
  });

  it('a fight longer than the away run\'s lift time: the inspectors are not lifted off mid-fight', () => {
    const sim = stationSearch();
    attackLead(sim);
    const [, insp] = live(sim);
    const ship = insp.ship;
    const aboard = insp.crew.filter((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && shipIdOf(sim, p) === ship;
    });
    expect(aboard.length).toBeGreaterThan(0);
    // Keep the fight going past the lift time: the inspectors are topped up each tick, so it cannot end before the recall would lift them.
    for (let i = 0; i < (AWAY_LIFT_SEC + 60) * TICK_HZ; i++) {
      for (const c of aboard) {
        const h = sim.world.get(c, HealthC);
        if (h) h.hp = h.max;
      }
      sim.step();
    }
    expect(sim.world.query(InspectionC).length).toBe(1); // still the fight
    expect(live(sim)[1].phase).toBe('fight');
    for (const c of aboard) {
      // Still on the ship: standing and hostile, or fallen there. Never carried off by the shuttle's recall.
      const p = sim.world.get(c, PositionC);
      expect(!!p && shipIdOf(sim, p) === ship).toBe(true);
      if (!sim.world.has(c, DeadC)) expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
    }
  });

  it('leaving while the inspectors walk back after the answer, still aboard, is a fight too', () => {
    const sim = stationSearch();
    const [id, insp] = live(sim);
    until(sim, () => insp.phase === 'settle');
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'fine' });
    sim.step();
    expect(insp.phase).toBe('leave');
    const onShip = insp.crew.some((c) => {
      const p = sim.world.get(c, PositionC);
      return !!p && shipIdOf(sim, p) === insp.ship;
    });
    expect(onShip).toBe(true);
    abortInspections(sim);
    expect(sim.world.get(insp.station, ShipC)?.faction).toBe('hostile');
  });
});

