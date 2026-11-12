import { releaseBedClaim } from '../ai/task';
import { ModuleC, type Module } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { POD_HEAL_PER_SEC } from '../tuning';
import { bedStandTile, bedUsable } from './beds';
import { CrewC, DownedC, PathC, PositionC, RecoveringC, type Crew, type Downed, type Health, type Position, type Recovering } from './components';
import { clearPath } from './helpers';
import { treatmentMult } from './treatment';

/**
 * Recovery pods (DESIGN.md "Recovery pod"; `ModuleDef.recovery`). A powered tank a hurt crew member lies in and heals to full with no medic, out of
 * action meanwhile (`RecoveringC`, counted by `isIncapacitated`); a downed patient carried there is stabilised, heals to `GET_UP_HP` as `Downed`
 * and carries on to full as `Recovering`. HP only: lasting injuries and surgery would slot in at `podHealStep`. The patient lies on the pod's anchor
 * tile (the render draws them floating in the tank); they get out onto its access tile. A pod that loses power ejects a walking patient and
 * pauses a downed one (no healing, no bleeding).
 */

/** The pod module `bed` names, or undefined when it is not an intact recovery pod. */
export function podModule(sim: Sim, bed: number): Module | undefined {
  const m = sim.world.get(bed, ModuleC);
  return m && m.hp > 0 && sim.content.modules[m.def]?.recovery ? m : undefined;
}

/** Is a recovery pod on the crew member's ship theirs to use now: free (powered, intact, nobody in it) or the one they have claimed? The `pod` drive input, before the walk is planned. */
export function podAvailable(sim: Sim, crew: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return false;
  const ship = shipIdOf(sim, pos);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    if (def?.recovery && (bedUsable(def, m) || (m.reservedBy === crew && m.hp > 0 && m.powered)) && shipIdOf(sim, m) === ship) return true;
  }
  return false;
}

/** Lay a crew member (already holding the pod, `reservedBy`) in the pod. The caller ends their walk and any task hold first. */
export function enterPod(sim: Sim, crew: number, bed: number, treated?: number): void {
  const m = sim.world.get(bed, ModuleC) as Module;
  const pos = sim.world.get(crew, PositionC) as Position;
  pos.x = pos.toX = m.x;
  pos.y = pos.toY = m.y;
  pos.progress = 0;
  m.reservedBy = crew;
  clearPath(sim, crew);
  const rec: Recovering = treated ? { bed, treated } : { bed };
  sim.world.add(crew, RecoveringC, rec);
  (sim.world.get(crew, CrewC) as Crew).activity = 'recovering';
  sim.events.emit({ type: 'crew.enteredPod', crew, bed });
}

/** A walking crew member arrives at the pod they claimed: the claim (a sleep-machine hold) becomes the stay. */
export function lieDownInPod(sim: Sim, crew: number, bed: number): void {
  releaseBedClaim(sim, crew); // the task's hold goes (and frees the pod); the stay re-reserves it
  enterPod(sim, crew, bed);
}

/** Get out: onto the pod's access tile, the pod free again. */
export function leavePod(sim: Sim, crew: number, rec: Recovering): void {
  const m = sim.world.get(rec.bed, ModuleC);
  if (m && m.reservedBy === crew) m.reservedBy = 0;
  const def = m && sim.content.modules[m.def];
  const pos = sim.world.get(crew, PositionC);
  if (m && def && pos) {
    const at = bedStandTile(def, m);
    pos.x = pos.toX = at.x;
    pos.y = pos.toY = at.y;
    pos.progress = 0;
  }
  sim.world.remove(crew, RecoveringC);
  const path = sim.world.get(crew, PathC);
  if (path) path.steps = [];
  (sim.world.get(crew, CrewC) as Crew).activity = 'idle';
  sim.events.emit({ type: 'crew.leftPod', crew, bed: rec.bed });
}

/**
 * One tick of healing in a pod for a patient `who` (their `Recovering` or `Downed`, which carry `bed` and `treated`): hp up at `POD_HEAL_PER_SEC`
 * (times a medicinal item's multiplier), less the tile's `harm`. False when the pod gives no care (it has no power).
 */
export function podHealStep(sim: Sim, crew: number, who: Pick<Downed, 'bed' | 'treated'>, health: Health, harm: number): boolean {
  const pod = podModule(sim, who.bed);
  if (!pod?.powered) return false;
  const care = treatmentMult(sim, shipIdOf(sim, pod), who);
  health.hp = Math.min(health.max, health.hp + (POD_HEAL_PER_SEC * care - harm) / TICK_HZ);
  return true;
}

/** A patient lying in a pod, one tick: heal to full and get out; out at once (taking the harm) when the pod is gone, wrecked or without power, or the air or fire harms them. */
export function restInPod(sim: Sim, crew: number, rec: Recovering, health: Health, harm: number): void {
  const pod = podModule(sim, rec.bed);
  if (!pod?.powered || harm > 0) {
    health.hp = Math.max(0, health.hp - harm / TICK_HZ);
    leavePod(sim, crew, rec);
    return;
  }
  podHealStep(sim, crew, rec, health, harm);
  if (health.hp >= health.max) leavePod(sim, crew, rec);
}

/** A stabilised downed patient in a pod has reached `GET_UP_HP`: they are no longer downed, and stay to full. */
export function startRecovery(sim: Sim, crew: number, downed: Downed): void {
  sim.world.remove(crew, DownedC);
  enterPod(sim, crew, downed.bed, downed.treated);
}

/** The pod a crew member lies in, or 0. */
export const podOf = (sim: Sim, crew: number): number => sim.world.get(crew, RecoveringC)?.bed ?? 0;
