import { deathSources, pairSources, rescueSources } from '../crew/bondSources';
import { ensurePerson, fadeBonds } from '../crew/bonds';
import { CrewC, DeadC, PositionC, type Position } from '../crew/components';
import { endInteractions, tryInteractions } from '../crew/interact';
import { hasMood } from '../crew/mood';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { BOND_INTERVAL, BOND_NEAR_RADIUS } from '../tuning';

/**
 * Relationships (docs/TRAITS.md section 6), after mental breaks in the pipeline. Opinions between crew come from interactions
 * (chats, shouting matches: content/interactions.ts), shared danger (fights, rescues, deaths) and a trickle of company; they fade
 * slowly (crew/bonds.ts). Every tick: interactions that ran their time end, rescues are noticed, and every 20 ticks deaths are
 * mourned. Every BOND_INTERVAL ticks each crew member is due once (staggered by id): they meet every other crew member of the
 * player's on the same ship within BOND_NEAR_RADIUS who has a higher id (so each pair is met once per pass), and the pair's sources
 * and interactions run. The output is opinions, mood counters and events; nothing here moves anyone.
 */
export function relationshipSystem(sim: Sim): void {
  endInteractions(sim);
  rescueSources(sim);
  if (sim.tick % 20 === 0) deathSources(sim);
  if (sim.tick % BOND_INTERVAL === 0) fadeBonds(sim);
  let crew: { id: number; pos: Position; ship: number }[] | undefined; // built when someone is due
  for (const id of sim.world.query(CrewC)) {
    if ((sim.tick + id) % BOND_INTERVAL !== 0 || !hasMood(sim, id) || sim.world.has(id, DeadC)) continue;
    ensurePerson(sim, id);
    if (!crew) {
      crew = [];
      for (const o of sim.world.query(CrewC, PositionC)) {
        const pos = sim.world.get(o, PositionC)!;
        if (!sim.world.has(o, DeadC) && hasMood(sim, o)) crew.push({ id: o, pos, ship: shipIdOf(sim, pos) });
      }
    }
    const me = crew.find((c) => c.id === id);
    if (!me) continue;
    for (const o of crew) {
      if (o.id <= id || o.ship !== me.ship) continue;
      const dist = Math.max(Math.abs(o.pos.x - me.pos.x), Math.abs(o.pos.y - me.pos.y));
      if (dist > BOND_NEAR_RADIUS) continue;
      ensurePerson(sim, o.id);
      pairSources(sim, id, o.id, dist);
      tryInteractions(sim, id, o.id, dist);
    }
  }
}
