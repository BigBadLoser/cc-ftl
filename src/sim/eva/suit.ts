import { shipIdOf } from '../regions';
import { CrewC, JobC, PositionC, type Job } from '../crew/components';
import type { Grid } from '../grid';
import { ModuleC } from '../modules/components';
import { airlockTiles } from '../modules/airlock';
import { SuitC } from './components';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import type { SuitDef } from '../registry';
import { DEFAULT_SUIT, EVA_THIN_AIR_BELOW } from '../tuning';

/** The suit in force: content's, else the tuning default. */
export function suitDef(sim: Sim): SuitDef {
  return sim.content.suit ?? DEFAULT_SUIT;
}

/** True if the species breathes (robots and other `airless` bodies never need a suit). */
export function needsAir(sim: Sim, crew: number): boolean {
  const c = sim.world.get(crew, CrewC);
  const sp = c && sim.content.species[c.species];
  return !!sp && !sp.airless;
}

/** True if the crew member wears a suit (whatever is left in its tank). */
export function isSuited(sim: Sim, crew: number): boolean {
  return sim.world.has(crew, SuitC);
}

/** Seconds of air left in the worn suit (0 when not suited). A suit made by `suit.set` has a full tank. */
export function suitAir(sim: Sim, crew: number): number {
  const s = sim.world.get(crew, SuitC);
  return s ? (s.air ?? suitDef(sim).airSec) : 0;
}

/** True if the crew member wears a suit with air in it: they breathe from the tank and shrug off vacuum. */
export function hasSuitAir(sim: Sim, crew: number): boolean {
  return suitAir(sim, crew) > 0;
}

/** True if the tile's air is thin: nothing a bare crew member should breathe. */
export function isThin(grid: Grid, x: number, y: number): boolean {
  return grid.has('o2') && grid.inBounds(x, y) && grid.get('o2', x, y) < EVA_THIN_AIR_BELOW;
}

/** Suits stowed in an airlock module. */
export function airlockSuits(sim: Sim, airlock: number): number {
  const a = sim.world.get(airlock, AirlockC);
  const m = sim.world.get(airlock, ModuleC);
  return a ? (a.suits ?? (m && sim.content.modules[m.def]?.airlock?.suits) ?? 0) : 0;
}

/** Suits in an airlock that nobody has a suit-up errand for yet. */
export function freeSuits(sim: Sim, airlock: number): number {
  let wanted = 0;
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (j.kind === 'suitUp' && j.target === airlock) wanted++;
  }
  return airlockSuits(sim, airlock) - wanted;
}

/** An airlock module that exists and is intact (suits can be fitted without power). */
export function airlockUsable(sim: Sim, airlock: number): boolean {
  const m = sim.world.get(airlock, ModuleC);
  return !!m && m.hp > 0 && m.enabled && sim.world.has(airlock, AirlockC);
}

/** The tile crew stand on to fit or remove a suit at an airlock: the tile just inside its inner door. */
export function suitTile(sim: Sim, airlock: number): { x: number; y: number } | null {
  const m = sim.world.get(airlock, ModuleC);
  const def = m && sim.content.modules[m.def];
  return m && def?.airlock ? airlockTiles(def, m).inside : null;
}

/** Fit a stowed suit (full tank) to a crew member. False when the airlock has none. */
export function donSuit(sim: Sim, crew: number, airlock: number): boolean {
  const a = sim.world.get(airlock, AirlockC);
  if (!a || airlockSuits(sim, airlock) <= 0 || sim.world.has(crew, SuitC)) return false;
  a.suits = airlockSuits(sim, airlock) - 1;
  sim.world.add(crew, SuitC, { worn: true, air: suitDef(sim).airSec, airlock });
  sim.events.emit({ type: 'suit.donned', crew, airlock });
  return true;
}

/** Take the suit off and stow it at this airlock (its tank refills). */
export function doffSuit(sim: Sim, crew: number, airlock: number): boolean {
  const a = sim.world.get(airlock, AirlockC);
  if (!a || !sim.world.has(crew, SuitC)) return false;
  a.suits = airlockSuits(sim, airlock) + 1;
  sim.world.remove(crew, SuitC);
  sim.events.emit({ type: 'suit.doffed', crew, airlock });
  return true;
}

/** Ship id and tile of a crew member (the tile they stand on). */
export function crewTile(sim: Sim, crew: number): { shipId: number; x: number; y: number } | null {
  const p = sim.world.get(crew, PositionC);
  return p ? { shipId: shipIdOf(sim, p), x: p.x, y: p.y } : null;
}
