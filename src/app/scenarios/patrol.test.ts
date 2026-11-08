import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../../sim';
import { content } from '../../content';
import { InspectionC } from '../../sim/inspect/types';
import { repKey } from '../../sim/galaxy/standing';
import { reputationOf } from '../../sim/story/state';
import { encountersOf } from '../encounterSnapshot';
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
});
