import { describe, expect, it } from 'vitest';
import { AssignmentC, BedOwnerC, CrewC, DraftedC, JobC, NeedsC, PositionC, newGame, type Sim } from '../sim';
import { PASSENGER_CHORES } from '../sim/consent/passage';
import { hasMood } from '../sim/crew/mood';
import { playerShip } from '../sim/trade/player';
import { playerCrew } from '../sim/story/world';
import { grant } from '../sim/consent/guests';
import { content } from '.';

/** A neutral person spawned on the tile of the first crew member, as a lodging guest (a passenger) or a plain visitor. */
function guestAboard(sim: Sim, lodge: boolean): number {
  const ship = playerShip(sim);
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  const before = new Set(sim.world.query(CrewC));
  sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.engineer', faction: 'neutral', ...(lodge ? { lodge: true as const } : {}) });
  if (!lodge) sim.step();
  sim.step();
  const id = sim.world.query(CrewC).find((c) => !before.has(c))!;
  if (!lodge) grant(sim, ship, { by: 'visit', faction: 'neutral', crew: [id] });
  return id;
}

const run = (sim: Sim, secs: number, each?: () => void): void => {
  for (let i = 0; i < secs * 20; i++) { sim.step(); each?.(); }
};

/** Free a bed for the guest: the starter ship has one per crew member, so one of them stays behind. */
function spareBed(sim: Sim): void {
  sim.world.destroyEntity(playerCrew(sim)[1]!);
}

/** Jobs the guest held outside a passenger's chores. */
function strayJob(sim: Sim, id: number): boolean {
  const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
  return !!job && !PASSENGER_CHORES.includes(job.category);
}

describe('lodging guests (passengers)', () => {
  it('own a bed, get hungry and eat from stock, sleep, and take only their chores', () => {
    const sim = newGame(3, content);
    spareBed(sim);
    const id = guestAboard(sim, true);
    let jobs = 0;
    run(sim, 3, () => { if (strayJob(sim, id)) jobs++; });
    expect(sim.world.get(id, BedOwnerC)?.bed).toBeGreaterThan(0);
    expect(hasMood(sim, id)).toBe(true); // a person living aboard has the ordinary crew mood
    const needs = sim.world.get(id, NeedsC)!;
    expect(needs.hunger).toBeDefined();
    needs.hunger = 20; // hungry: they go and eat
    let ate = false;
    run(sim, 60, () => {
      if (strayJob(sim, id)) jobs++;
      if (sim.world.get(id, CrewC)?.activity === 'eating') ate = true;
    });
    expect(ate).toBe(true);
    expect(needs.hunger!).toBeGreaterThan(20);
    needs.rest = 5; // exhausted: they sleep, in their bed
    let slept = false;
    run(sim, 30, () => {
      if (strayJob(sim, id)) jobs++;
      if (sim.world.get(id, CrewC)?.activity === 'sleeping') slept = true;
    });
    expect(slept).toBe(true);
    expect(jobs).toBe(0);
  });

  it('are never drafted', () => {
    const sim = newGame(3, content);
    const id = guestAboard(sim, true);
    sim.enqueue({ type: 'crew.draft', id, drafted: true });
    run(sim, 1);
    expect(sim.world.has(id, DraftedC)).toBe(false);
  });

  it('a guest who does not lodge (a visiting party) owns no bed and never gets hungry', () => {
    const sim = newGame(3, content);
    const id = guestAboard(sim, false);
    run(sim, 3);
    expect(sim.world.has(id, BedOwnerC)).toBe(false);
    expect(sim.world.get(id, NeedsC)?.hunger).toBeUndefined();
    expect(sim.world.has(id, AssignmentC)).toBe(false);
  });
});
