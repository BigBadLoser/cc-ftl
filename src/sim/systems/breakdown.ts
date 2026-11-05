import { survivalCritical } from '../ai/hazard';
import { abortTask, clearJoblessTask } from '../ai/task';
import { InterruptC, TaskC } from '../ai/components';
import { alertable, isInterruptTier } from '../crew/breakTable';
import { BreakdownC, BreakMemoryC, type Breakdown, type BreakMemory } from '../crew/breakTypes';
import { onCooldown, rollBreak, type BreakPick } from '../crew/breakdown';
import { AssignmentC, CrewC, DraftedC, MoodC, NeedsC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { EquipOrderC, FighterC, StowOrderC } from '../fight/components';
import { hasMood } from '../crew/mood';
import { contextPresent } from '../crew/stress';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  BREAK_ALERT_SEC, BREAK_ALERT_SHIP_SEC, BREAK_DESPAIR_EAT, BREAK_GONE_SEC, BREAK_INTERVAL, BREAK_LET_OUT_SEC, BREAK_SCENE_RADIUS, BREAK_SCENE_SEC,
} from '../tuning';

/**
 * Mental breaks (docs/TRAITS.md section 5), right after mood in the pipeline. Every BREAK_INTERVAL ticks (staggered by id) each mood
 * crew member who is able, not in a break and not on a cooldown rolls the hashed check (`crew/breakdown.ts`); a break that starts
 * adds `Breakdown` and, for a tier that takes over the crew member, ends their task through `abortTask`. The break's behaviour is the
 * AI's: the interrupt layer holds the crew member (`ai/interrupt.ts`) and the `break` machine steps it (`ai/machines/break.ts`); a mild
 * break only scores the work drive 0. Every tick the running breaks are checked for their end. The output is events and the
 * components; nothing here moves anyone.
 */
export function breakdownSystem(sim: Sim): void {
  for (const id of sim.world.query(BreakdownC)) {
    if (shouldEnd(sim, id)) endBreak(sim, id);
    else suspendFor(sim, id);
  }
  for (const id of sim.world.query(CrewC)) {
    if ((sim.tick + id) % BREAK_INTERVAL !== 0) continue;
    const m = sim.world.get(id, MoodC);
    if (!m || !hasMood(sim, id) || isIncapacitated(sim, id)) continue;
    if (sim.world.has(id, BreakdownC) || onCooldown(sim, id)) continue;
    // A break never starts mid-escape; a sleeper is left to rest. (The counters keep running in the mood system.)
    if (sim.world.get(id, InterruptC)?.reason === 'hazard' || sim.world.get(id, CrewC)?.activity === 'sleeping') continue;
    const pick = rollBreak(sim, id, m, sim.world.has(id, DraftedC));
    if (pick) startBreak(sim, id, pick);
  }
}

/**
 * While a survival drive is critical the break is suspended (`Breakdown.suspended`): the crew member is handled as if they had none, and resumes
 * when it passes. The timer keeps running. The break's own task is dropped when the suspension begins (the scheduler's path takes over).
 */
function suspendFor(sim: Sim, id: number): void {
  const b = sim.world.get(id, BreakdownC) as Breakdown;
  const now = survivalCritical(sim, id);
  if (now === !!b.suspended) return;
  if (now) {
    b.suspended = true;
    if (sim.world.get(id, TaskC)?.machine === 'break') abortTask(sim, id, 'breakdown');
  } else delete b.suspended;
}

/** Has the running break run its course: the time is up, the crew member is down, a draft ended a break that yields to it, the context has been gone long enough. */
function shouldEnd(sim: Sim, id: number): boolean {
  const b = sim.world.get(id, BreakdownC);
  if (!b || sim.tick >= b.until || isIncapacitated(sim, id)) return true;
  if (b.tier !== 'severe' && sim.world.has(id, DraftedC)) return true;
  if (b.kind === 'despair' && (sim.world.get(id, NeedsC)?.hunger ?? 100) < BREAK_DESPAIR_EAT) return true; // they eat at the urgent line
  if (b.context === 'lowMood' || (sim.tick + id) % BREAK_INTERVAL !== 0) return false;
  if (contextPresent(sim, id, b.context)) b.goneSince = 0;
  else if (b.goneSince === 0) b.goneSince = sim.tick;
  return b.goneSince !== 0 && sim.tick - b.goneSince >= BREAK_GONE_SEC * TICK_HZ;
}

/** Another severe break began on this ship within BREAK_ALERT_SHIP_SEC. */
function recentSevereOnShip(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return false;
  const ship = shipIdOf(sim, pos);
  for (const o of sim.world.query(BreakdownC)) {
    const b = sim.world.get(o, BreakdownC);
    const p = sim.world.get(o, PositionC);
    if (o !== id && b?.tier === 'severe' && sim.tick - b.since < BREAK_ALERT_SHIP_SEC * TICK_HZ && p && shipIdOf(sim, p) === ship) return true;
  }
  return false;
}

/** Is this break worth an urgent alert: loud enough, none for this crew member in 10 min, not a second severe one on the ship within 60 s. */
function wantsAlert(sim: Sim, id: number, pick: BreakPick, mem: BreakMemory): boolean {
  if (!alertable(pick.kind, pick.context)) return false;
  if (mem.alertAt !== undefined && sim.tick - mem.alertAt < BREAK_ALERT_SEC * TICK_HZ) return false;
  return !(pick.tier === 'severe' && recentSevereOnShip(sim, id));
}

function memoryOf(sim: Sim, id: number): BreakMemory {
  let mem = sim.world.get(id, BreakMemoryC);
  if (!mem) sim.world.add(id, BreakMemoryC, (mem = { byContext: {} }));
  return mem;
}

/** Begin a break: the component, the task taken over, witnesses of a tantrum, the event. */
export function startBreak(sim: Sim, id: number, pick: BreakPick): void {
  const alert = wantsAlert(sim, id, pick, memoryOf(sim, id));
  sim.world.add(id, BreakdownC, { kind: pick.kind, tier: pick.tier, context: pick.context, until: sim.tick + pick.ticks, since: sim.tick, goneSince: 0, ...(pick.src ? { src: { x: pick.src.x, y: pick.src.y } } : {}) });
  // A tier that takes over the crew member ends whatever they were doing like any code that takes over a path; a mild break only lets go of a job.
  if (isInterruptTier(pick.tier)) standDown(sim, id);
  if (isInterruptTier(pick.tier) || sim.world.has(id, AssignmentC)) abortTask(sim, id, 'breakdown');
  if (alert) memoryOf(sim, id).alertAt = sim.tick;
  if (pick.kind === 'tantrum') madeAScene(sim, id);
  sim.events.emit({ type: 'crew.break', crew: id, kind: pick.kind, context: pick.context, tier: pick.tier, alert });
}

/** The fight code lets go of a crew member who breaks: no engaging, fleeing or fetching a weapon (the break machine is the only path writer now). */
function standDown(sim: Sim, id: number): void {
  const f = sim.world.get(id, FighterC);
  if (f && f.mode !== 'idle') {
    f.mode = 'idle';
    f.target = 0;
    delete f.goal;
  }
  sim.world.remove(id, EquipOrderC);
  sim.world.remove(id, StowOrderC);
}

/** A tantrum is heard: crew within BREAK_SCENE_RADIUS tiles feel it for a while. (The relationship hit lands with relationships, section 6.) */
function madeAScene(sim: Sim, id: number): void {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return;
  for (const o of sim.world.query(CrewC, PositionC, MoodC)) {
    const p = sim.world.get(o, PositionC);
    if (o === id || !p || !hasMood(sim, o) || shipIdOf(sim, p) !== shipIdOf(sim, pos) || Math.hypot(p.x - pos.x, p.y - pos.y) > BREAK_SCENE_RADIUS) continue;
    (sim.world.get(o, MoodC) as { scene?: number }).scene = BREAK_SCENE_SEC;
  }
}

/** End a break: the component goes (the interrupt lapses at the next detector pass and the scheduler takes the crew member back), the memory and mood remember it. */
export function endBreak(sim: Sim, id: number): void {
  const b = sim.world.get(id, BreakdownC);
  if (!b) return;
  sim.world.remove(id, BreakdownC);
  if (sim.world.get(id, TaskC)?.machine === 'break') clearJoblessTask(sim, id);
  const mem = memoryOf(sim, id);
  mem.last = sim.tick;
  mem.byContext[b.context] = sim.tick;
  const m = sim.world.get(id, MoodC);
  if (m) {
    m.letOut = BREAK_LET_OUT_SEC;
    delete m.underFire;
    delete m.dark;
  }
  sim.events.emit({ type: 'crew.breakEnded', crew: id, kind: b.kind, context: b.context });
}
