import { releaseBedClaim } from '../ai/task';
import { ModuleC, type Module } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { BED_HEAL_PER_SEC, POD_HEAL_PER_SEC, XP_PER_HP_HEALED } from '../tuning';
import { bedStandTile, bedUsable } from './beds';
import { CrewC, DownedC, PathC, PositionC, RecoveringC, type Crew, type Downed, type Health, type Position, type Recovering } from './components';
import { clearPath } from './helpers';
import { tendingOf, treatmentMult } from './treatment';
import { grantXp } from './xp';

/**
 * Recovery pods (DESIGN.md "Recovery pod"; `ModuleDef.recovery`). A powered tank a hurt crew member lies in and heals to full with no medic, out of
 * action meanwhile (`RecoveringC`, counted by `isIncapacitated`); a downed patient carried there is stabilised, heals to `GET_UP_HP` as `Downed`
 * and carries on to full as `Recovering`. HP only: lasting injuries and surgery would slot in at `careHealStep`. The patient lies on the pod's anchor
 * tile (the render draws them floating in the tank); they get out onto its access tile. A pod that loses power ejects a walking patient and
 * pauses a downed one (no healing, no bleeding).
 */

/** The pod module `bed` names, or undefined when it is not an intact recovery pod. */
export function podModule(sim: Sim, bed: number): Module | undefined {
  const m = sim.world.get(bed, ModuleC);
  return m && m.hp > 0 && sim.content.modules[m.def]?.recovery ? m : undefined;
}

/** The treatment bed `bed` names (a medical bed or a recovery pod), or undefined when it is neither or is wrecked. */
export function careBed(sim: Sim, bed: number): Module | undefined {
  const m = sim.world.get(bed, ModuleC);
  return m && m.hp > 0 && sim.content.modules[m.def]?.medical ? m : undefined;
}

/** Is a treatment bed (a medical bed or a recovery pod) on the crew member's ship theirs to use now: free (a pod also powered) or the one they have claimed? The `care` drive input, before the walk is planned. */
export function careAvailable(sim: Sim, crew: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return false;
  const ship = shipIdOf(sim, pos);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    if (def?.medical && (bedUsable(def, m) || (m.reservedBy === crew && m.hp > 0 && (!def.recovery || m.powered))) && shipIdOf(sim, m) === ship) return true;
  }
  return false;
}

/** Lay a crew member (already holding the pod, `reservedBy`) in the pod. The caller ends their walk and any task hold first. */
export function enterCare(sim: Sim, crew: number, bed: number, treated?: number): void {
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
  sim.events.emit({ type: 'crew.enteredCare', crew, bed });
}

/** A walking crew member arrives at the pod they claimed: the claim (a sleep-machine hold) becomes the stay. */
export function lieDownInCare(sim: Sim, crew: number, bed: number): void {
  releaseBedClaim(sim, crew); // the task's hold goes (and frees the pod); the stay re-reserves it
  enterCare(sim, crew, bed);
}

/** Get out: onto the pod's access tile, the pod free again. */
export function leaveCare(sim: Sim, crew: number, rec: Recovering): void {
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
  sim.events.emit({ type: 'crew.leftCare', crew, bed: rec.bed });
}

/**
 * One tick of healing in a treatment bed for a patient `who` (their `Recovering` or `Downed`, which carry `bed` and `treated`): hp up at `POD_HEAL_PER_SEC` in a pod
 * or `BED_HEAL_PER_SEC` in a medical bed (times the tending medic's care, `tendingOf`, who earns the XP), times a medicinal item's multiplier, less the tile's `harm`.
 * False when the bed gives no care (a pod without power, or not a treatment bed).
 */
export function careHealStep(sim: Sim, crew: number, who: Pick<Downed, 'bed' | 'treated'>, health: Health, harm: number): boolean {
  const bed = careBed(sim, who.bed);
  const pod = !!bed && !!sim.content.modules[bed.def]?.recovery;
  if (!bed || (pod && !bed.powered)) return false;
  const tend = pod ? { medic: 0, mult: 1 } : tendingOf(sim, who.bed); // a pod needs no medic; a medical bed heals faster while one tends it
  const care = tend.mult * treatmentMult(sim, shipIdOf(sim, bed), who);
  const before = health.hp;
  health.hp = Math.min(health.max, health.hp + ((pod ? POD_HEAL_PER_SEC : BED_HEAL_PER_SEC) * care - harm) / TICK_HZ);
  if (tend.medic && health.hp > before) grantXp(sim, tend.medic, 'medicine', (health.hp - before) * XP_PER_HP_HEALED);
  return true;
}

/** A patient lying in a treatment bed, one tick: heal to full and get out; out at once (taking the harm) when the bed is gone, wrecked or (a pod) without power, or the air or fire harms them. */
export function restInCare(sim: Sim, crew: number, rec: Recovering, health: Health, harm: number): void {
  if (harm > 0 || !careHealStep(sim, crew, rec, health, harm)) {
    health.hp = Math.max(0, health.hp - harm / TICK_HZ);
    leaveCare(sim, crew, rec);
    return;
  }
  if (health.hp >= health.max) leaveCare(sim, crew, rec);
}

/** A stabilised downed patient in a pod has reached `GET_UP_HP`: they are no longer downed, and stay to full. */
export function startRecovery(sim: Sim, crew: number, downed: Downed): void {
  sim.world.remove(crew, DownedC);
  enterCare(sim, crew, downed.bed, downed.treated);
}

/** The pod a crew member lies in, or 0. */
export const podOf = (sim: Sim, crew: number): number => sim.world.get(crew, RecoveringC)?.bed ?? 0;
