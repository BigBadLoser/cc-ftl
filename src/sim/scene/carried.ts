import { ShipC } from '../combat/components';
import { ConsentC } from '../consent/components';
import { dropPassenger } from '../consent/passage';
import { CrewC, DeadC, DownedC, PositionC } from '../crew/components';
import type { Sim } from '../sim';
import { fireRules, rulesOf } from './rules';
import type { SceneFact } from './types';

/**
 * Rules a person carries out of a scene (DESIGN.md "Medical pod": carried rules). A passenger the scene handed on (scene/pods.ts `handOn`) keeps the event
 * on their passage grant (`Grant.carry`), so the event's `of: 'person'` rules (the shared `helpedPerson`, `personDied`) fire about them wherever the ship is
 * now, long after the pocket is gone: once each, the fired keys saved on the grant. A dead passenger's grant goes once its rules have fired.
 */

/** The facts true of a carried person now: back on their feet aboard (`treated`), or dead (`died`). */
function personFacts(sim: Sim, crew: number): Set<SceneFact> {
  const out = new Set<SceneFact>();
  if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC)) return out.add('died');
  if (sim.world.has(crew, PositionC) && !sim.world.has(crew, DownedC)) out.add('treated');
  return out;
}

/** Once a second (systems/passengers.ts): fire the carried rules whose facts are now true, for every carried person on every ship. */
export function tendCarried(sim: Sim): void {
  for (const ship of sim.world.query(ShipC)) {
    for (const g of [...(sim.world.get(ship, ConsentC)?.grants ?? [])]) {
      const carry = g.carry;
      if (g.by !== 'passage' || !carry) continue;
      const rules = rulesOf(sim, carry.event).filter(([, r]) => r.of === 'person');
      for (const crew of [...(g.crew ?? [])]) {
        const facts = personFacts(sim, crew);
        fireRules(sim, carry, rules, { person: { crew, origin: carry.origin, purse: carry.purse } }, (r) => facts.has(r.on));
        if (facts.has('died')) dropPassenger(sim, ship, crew);
      }
    }
  }
}

/** Something happened to a carried person that only its caller sees (`delivered`: handed over at their destination, galaxy/passage.ts): fire the rules on it, once. */
export function firePersonFact(sim: Sim, crew: number, fact: SceneFact): void {
  for (const ship of sim.world.query(ShipC)) {
    const g = sim.world.get(ship, ConsentC)?.grants.find((x) => x.by === 'passage' && x.carry && x.crew?.includes(crew));
    const carry = g?.carry;
    if (!carry) continue;
    const rules = rulesOf(sim, carry.event).filter(([, r]) => r.of === 'person');
    fireRules(sim, carry, rules, { person: { crew, origin: carry.origin, purse: carry.purse } }, (r) => r.on === fact);
  }
}
