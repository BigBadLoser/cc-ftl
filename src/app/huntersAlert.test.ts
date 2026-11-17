import { describe, expect, it } from 'vitest';
import { newGame, ShipC, type Sim } from '../sim';
import { addNotoriety } from '../sim/galaxy/heat';
import { dispatchHunters, huntersHere } from '../sim/galaxy/hunters';
import { spawnContact } from '../sim/galaxy/arrivals';
import { ensureAround } from '../sim/galaxy/state';
import { content } from '../content';
import { deriveAlerts } from './alertsDerived';

/** A wanted player with a navy hunter fleet sent after them, its ships made real in the player's node. */
function huntedHere(): { sim: Sim; fleet: number; ships: number[] } {
  const sim = newGame(3, content);
  ensureAround(sim, sim.galaxy.current);
  addNotoriety(sim, 60);
  let f = sim.galaxy.fleets.find((x) => x.hunt);
  for (let t = 0; t < 60 && !f; t++) {
    dispatchHunters(sim, ++sim.galaxy.turn);
    f = sim.galaxy.fleets.find((x) => x.hunt && x.faction === 'navy');
  }
  if (!f) throw new Error('no hunter');
  f.node = sim.galaxy.current;
  f.route = [];
  for (const c of f.ships) spawnContact(sim, sim.galaxy.current, c, { reason: 'fleet' });
  return { sim, fleet: f.id, ships: f.ships.map((c) => c.ship).filter((s): s is number => s !== undefined) };
}

describe('hunters arriving (#542)', () => {
  it('raise an urgent alert that jumps to the first hunter ship, and it clears when they are gone', () => {
    const { sim, fleet, ships } = huntedHere();
    expect(ships.length).toBeGreaterThan(0);
    expect(huntersHere(sim).map((h) => h.fleet)).toEqual([fleet]);
    const a = deriveAlerts(sim, () => false).get(`hu${fleet}`);
    expect(a?.kind).toBe('hunters.here');
    expect(a?.text).toMatch(/^Hunters: .+ \(\d+ ships?\)$/);
    expect(a?.subject).toEqual({ kind: 'ship', id: Math.min(...ships) });
    for (const id of ships) sim.world.get(id, ShipC)!.state = 'wreck';
    expect(deriveAlerts(sim, () => false).has(`hu${fleet}`)).toBe(false);
  });

  it('a fleet that is not hunting the player raises none', () => {
    const { sim, fleet } = huntedHere();
    const f = sim.galaxy.fleets.find((x) => x.id === fleet)!;
    delete f.hunt;
    expect(deriveAlerts(sim, () => false).has(`hu${fleet}`)).toBe(false);
  });
});
