import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../../sim';
import { content } from '../../content';
import { InspectionC } from '../../sim/inspect/types';
import { repKey } from '../../sim/galaxy/standing';
import { reputationOf } from '../../sim/story/state';
import { encountersOf } from '../encounterSnapshot';
import { ShipC, galaxyIndex, playerShip } from '../../sim';
import { onTurn } from '../../sim/galaxy/turn';
import { patrolCommands, patrolNode } from './patrol';

/** The scenario's start, stepped until the patrol's hail halts the trip. */
function hailed(clean = false): Sim {
  const sim = newGame(3, content);
  for (let i = 0; i < 20; i++) sim.step();
  for (const cmd of patrolCommands(sim, patrolNode(sim)!, { clean })) sim.enqueue(cmd);
  for (let i = 0; i < 400 && sim.galaxy.travel?.phase !== 'interdicted' && sim.sector.state !== 'deploying'; i++) {
    sim.step();
    sim.story.active = null;
  }
  return sim;
}

/** Hailed, complied and deployed: stepped until the patrol's inspection is under way (its shuttle on the way). */
function boarding(): { sim: Sim; fleet: number; faction: string } {
  const sim = hailed();
  const e = sim.galaxy.encounters.find((x) => x.scan)!;
  sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'comply' });
  sim.step();
  sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
  for (let i = 0; i < 30 && !sim.world.query(InspectionC).length; i++) sim.step();
  return { sim, fleet: e.fleet, faction: e.faction };
}

describe('?scenario=patrol', () => {
  it('the patrol hails the ship to stop mid-jump; the comms window has the captain and comply / run', () => {
    const sim = hailed();
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
    const card = encountersOf(sim).find((e) => e.contraband);
    expect(card?.choices.map((c) => c.choice)).toEqual(['comply', 'run']);
    expect(card?.hail?.caller.role).toBe('Captain of the');
    expect(card?.hail?.transcript.some((l) => l.kind === 'speech')).toBe(true);
    // The trip waits: no new jump, no drop.
    sim.enqueue({ type: 'galaxy.drop' });
    sim.step();
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
  });

  it('complying drops out beside the patrol, and once deployed its ship sends inspectors who search', () => {
    const sim = hailed();
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'comply' });
    sim.step();
    expect(sim.sector.state).toBe('deploying');
    expect(sim.galaxy.patrolStop?.fleet).toBe(e.fleet);
    sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
    for (let i = 0; i < 30 && !sim.world.query(InspectionC).length; i++) sim.step();
    const [id] = sim.world.query(InspectionC);
    const insp = sim.world.get(id!, InspectionC)!;
    expect(insp.patrol).toBe(e.fleet);
    expect(sim.galaxy.patrolStop).toBeUndefined();
    const ships = sim.galaxy.fleets.find((f) => f.id === e.fleet)!.ships.map((c) => c.ship);
    expect(ships).toContain(insp.station);
    for (let i = 0; i < 6000 && insp.phase !== 'settle'; i++) sim.step();
    expect(insp.phase).toBe('settle');
    expect(insp.value).toBeGreaterThan(0);
  });

  it('running costs standing and carries the trip on; a clean ship is only scanned in passing', () => {
    const sim = hailed();
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    const key = repKey(sim, e.faction);
    const before = reputationOf(sim.story, key);
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'run' });
    sim.step();
    expect(reputationOf(sim.story, key)).toBeLessThan(before);
    expect(sim.galaxy.travel?.phase).not.toBe('interdicted');
    expect(sim.galaxy.encounters.some((x) => x.scan)).toBe(false);

    const clean = hailed(true);
    expect(clean.galaxy.travel?.phase).not.toBe('interdicted');
    expect(clean.galaxy.encounters.find((x) => x.kind === 'scan')?.scan).toBeUndefined();
  });

  it('jumping away while the patrol\'s inspectors are still on the way counts as running', () => {
    const { sim, faction } = boarding();
    const [id] = sim.world.query(InspectionC);
    expect(sim.world.get(id!, InspectionC)!.phase).toBe('fly');
    const key = repKey(sim, faction);
    const before = reputationOf(sim.story, key);
    const g = sim.galaxy;
    const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((x) => (x.a === g.current ? x.b : x.a)).sort()[0]!;
    sim.enqueue({ type: 'debug.chargeFtl' });
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.world.query(InspectionC)).toEqual([]);
    expect(reputationOf(sim.story, key)).toBeLessThan(before);
  });

  it('the patrol stays put through galaxy turns while its stop or its inspection is pending', () => {
    const sim = hailed();
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'comply' });
    sim.step();
    const f = sim.galaxy.fleets.find((x) => x.id === e.fleet)!;
    const node = f.node;
    sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
    for (let i = 0; i < 30 && !sim.world.query(InspectionC).length; i++) sim.step();
    for (let i = 0; i < 8; i++) {
      f.dwell = 0; // it would leave at once if nothing held it
      onTurn(sim, ++sim.galaxy.turn, 'time');
    }
    expect(f.node).toBe(node);
    const [id] = sim.world.query(InspectionC);
    expect(id).toBeDefined();
    const insp = sim.world.get(id!, InspectionC)!;
    expect(f.ships.some((c) => c.ship === insp.station)).toBe(true);
    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.world.has(id!, InspectionC)).toBe(true);
  });

  it('a chasing patrol whose faction running made hostile still hails to stop, inside its encounter cooldown', () => {
    const sim = newGame(3, content);
    for (let i = 0; i < 20; i++) sim.step();
    for (const cmd of patrolCommands(sim, patrolNode(sim)!)) sim.enqueue(cmd);
    sim.step();
    const f = sim.galaxy.fleets.find((x) => x.chase)!;
    expect(f).toBeDefined();
    sim.story.reputation[repKey(sim, f.faction)] = -100; // running from it again and again
    f.met = sim.galaxy.turn - 1; // it hailed the player a turn ago (the run that started the chase)
    for (let i = 0; i < 400 && sim.galaxy.travel?.phase === 'hop'; i++) {
      sim.step();
      sim.story.active = null;
    }
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
    const e = sim.galaxy.encounters.find((x) => x.fleet === f.id);
    expect(e?.kind).toBe('scan');
    expect(e?.scan).toBeDefined();
  });

  it('a patrol its faction now counts hostile comes in peaceful when the player complies, and its inspectors search', () => {
    const sim = hailed();
    const e = sim.galaxy.encounters.find((x) => x.scan)!;
    sim.story.reputation[repKey(sim, e.faction)] = -100; // run from before: the faction is hostile
    sim.enqueue({ type: 'story.skipGoals' }); // past the opening grace, which would keep a hostile fleet out anyway
    sim.step();
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'comply' });
    sim.step();
    sim.enqueue({ type: 'sector.deploy', x: 0, y: 0 });
    for (let i = 0; i < 30 && !sim.world.query(InspectionC).length; i++) sim.step();
    const f = sim.galaxy.fleets.find((x) => x.id === e.fleet)!;
    const ships = f.ships.map((c) => c.ship).filter((s): s is number => s !== undefined);
    expect(ships.length).toBeGreaterThan(0);
    for (const s of ships) expect(sim.world.get(s, ShipC)?.faction).toBe('neutral');
    const [id] = sim.world.query(InspectionC);
    const insp = sim.world.get(id!, InspectionC)!;
    for (let i = 0; i < 6000 && insp.phase !== 'settle'; i++) sim.step();
    expect(sim.sector.inCombat).toBe(false);
    expect(insp.phase).toBe('settle');
  });
});

