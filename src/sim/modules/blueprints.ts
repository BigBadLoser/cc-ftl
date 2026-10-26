import type { Sim } from '../sim';
import type { ModuleDef } from '../registry';

/**
 * Blueprints. A module def with `ModuleDef.blueprint` can only be built once its blueprint is known; every other def is a basic one,
 * known from the start. Buying one at a station (galaxy/blueprintShop.ts) adds its id to `sim.story.blueprints` at once. Not items.
 */
export function isKnown(sim: Sim, def: string): boolean {
  const d = sim.content.modules[def];
  return !!d && (!d.blueprint || sim.story.blueprints.includes(def));
}

/** Learn a blueprint (idempotent). */
export function learn(sim: Sim, def: string): void {
  if (!sim.story.blueprints.includes(def)) sim.story.blueprints.push(def);
}

/** Which station type sells a blueprint: military stations sell defence modules (weapons, shields), research stations the rest. */
export function blueprintVenue(d: ModuleDef): 'research' | 'military' {
  return d.category === 'defence' ? 'military' : 'research';
}
