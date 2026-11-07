import { tendAid } from '../scene/aid';
import { tendClocks } from '../scene/clock';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * The scene's hold on the world, once a second while an event grid is open (DESIGN.md "Physical encounters"): timers that act (a failing reactor's
 * fires and its end, scene/clock.ts) and help agreed with a scene ship (its away site for the guests, scene/aid.ts). Before the provocation system, so
 * an agreement that holds this tick covers the guests standing aboard.
 */
export function sceneSystem(sim: Sim): void {
  const ev = sim.galaxy.event;
  if (!ev || sim.tick % TICK_HZ !== 0) return;
  const a = tendClocks(sim, ev.scene);
  const b = tendAid(sim, ev.scene);
  if (a || b) sim.galaxy.rev++;
}
