import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { applyEffect, takeItems } from './effects';
import type { EventDef, EventTrigger, Outcome } from './defs';
import { checkOdds, describeQty, eligible, unmetReasons } from './requirements';
import { withRng } from './state';

/** Seconds an unopened lead notice stays before it lapses. */
export const NOTICE_LIFE_SEC = 45;

type TriggerKind = EventTrigger['kind'];

function rejected(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** True when `id` may be drawn now: context range, territory, eligibility, once and cooldown. */
function drawable(sim: Sim, id: string, def: EventDef): boolean {
  const ctx = sim.story.context;
  if (def.danger && (ctx.danger < (def.danger.min ?? -Infinity) || ctx.danger > (def.danger.max ?? Infinity))) return false;
  if (def.factions && !def.factions.includes(ctx.faction)) return false;
  return allowedAgain(sim, id, def) && eligible(sim, def);
}

function allowedAgain(sim: Sim, id: string, def: EventDef): boolean {
  const seen = sim.story.seen[id];
  if (!seen) return true;
  if (def.once) return false;
  return !def.cooldownSec || sim.tick - seen.last >= def.cooldownSec * TICK_HZ;
}

/** Candidates of a pool with their weights, in content order (stable). */
export function poolFor(sim: Sim, kind: 'arrival' | 'periodic'): { id: string; weight: number }[] {
  const out: { id: string; weight: number }[] = [];
  for (const [id, def] of Object.entries(sim.content.events ?? {})) {
    if (!drawable(sim, id, def)) continue;
    const weight = def.triggers.reduce((w, t) => (t.kind === kind ? w + t.weight : w), 0);
    if (weight > 0) out.push({ id, weight });
  }
  return out;
}

/** Draw one event from a pool by weight with the story Rng and start it. Returns its id, or null when the pool is empty. */
export function drawEvent(sim: Sim, kind: Extract<TriggerKind, 'arrival' | 'periodic'>): string | null {
  const pool = poolFor(sim, kind);
  const total = pool.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return null;
  let roll = withRng(sim.story, (rng) => rng.next()) * total;
  const pick = pool.find((p) => (roll -= p.weight) < 0) ?? (pool[pool.length - 1] as { id: string });
  startEvent(sim, pick.id);
  return pick.id;
}

/**
 * Start an event now. A decision becomes the active one (the UI pauses on it); with one already open it waits in the
 * queue. A notice applies its effects and is announced. Returns false for an unknown id.
 */
export function startEvent(sim: Sim, id: string): boolean {
  const def = sim.content.events?.[id];
  if (!def) return false;
  const story = sim.story;
  if (def.mode === 'decision' && story.active) {
    story.queue.push({ event: id, due: sim.tick, force: true });
    return true;
  }
  const seen = story.seen[id];
  story.seen[id] = { count: (seen?.count ?? 0) + 1, last: sim.tick };
  if (def.mode === 'decision') {
    story.active = { event: id, since: sim.tick };
    sim.events.emit({ type: 'story.started', event: id, mode: 'decision', notice: 0 });
    return true;
  }
  for (const eff of def.effects ?? []) applyEffect(sim, eff, { event: id, actor: null });
  let notice = 0;
  if (def.lead) {
    notice = story.nextId++;
    story.notices.push({ id: notice, event: id, expires: sim.tick + Math.round((def.expireSec ?? NOTICE_LIFE_SEC) * TICK_HZ) });
  }
  sim.events.emit({ type: 'story.started', event: id, mode: 'notice', notice });
  return true;
}

/** Start queued events that are due (skipping ones that stopped being eligible). Runs until a decision opens. */
export function pump(sim: Sim): void {
  const story = sim.story;
  for (let i = 0; i < story.queue.length && !story.active; ) {
    const q = story.queue[i] as (typeof story.queue)[number];
    if (q.due > sim.tick) {
      i++;
      continue;
    }
    story.queue.splice(i, 1);
    const def = sim.content.events?.[q.event];
    if (def && (q.force || (allowedAgain(sim, q.event, def) && eligible(sim, def)))) startEvent(sim, q.event);
  }
  // Notices queued behind nothing still start even while a decision is open.
  for (let i = 0; i < story.queue.length; ) {
    const q = story.queue[i] as (typeof story.queue)[number];
    if (q.due <= sim.tick && sim.content.events?.[q.event]?.mode === 'notice') {
      story.queue.splice(i, 1);
      startEvent(sim, q.event);
    } else i++;
  }
}

function outcomeOf(choice: NonNullable<EventDef['choices']>[number], success: boolean | null): Outcome {
  if (success === null) return choice.outcome ?? {};
  return (success ? choice.success : choice.failure) ?? {};
}

/** Resolve the open decision with a choice. Rejects (and changes nothing) when it is not open or the choice is unmet. */
export function choose(sim: Sim, choiceId: string): void {
  const story = sim.story;
  const active = story.active;
  const def = active && sim.content.events?.[active.event];
  const choice = def?.choices?.find((c) => c.id === choiceId);
  if (!active || !def || !choice) return rejected(sim, 'story.choose', 'noChoice');
  if (unmetReasons(sim, choice).length) return rejected(sim, 'story.choose', 'unmet');

  const lines: string[] = [];
  for (const c of choice.cost ?? []) {
    takeItems(sim, c.item, c.count);
    lines.push(`-${describeQty(sim, c)}`);
  }
  let success: boolean | null = null;
  let actor: number | null = null;
  if (choice.check) {
    const odds = checkOdds(sim, choice.check);
    actor = odds?.crew ?? null;
    success = odds ? withRng(story, (rng) => rng.next()) < odds.chance : false;
  }
  story.active = null;
  const outcome = outcomeOf(choice, success);
  for (const eff of outcome.effects ?? []) {
    const line = applyEffect(sim, eff, { event: active.event, actor });
    if (line) lines.push(line);
  }
  story.last = { tick: sim.tick, event: active.event, choice: choice.id, success, text: outcome.text ?? '', lines };
  sim.events.emit({ type: 'story.resolved', event: active.event, choice: choice.id, success });
  pump(sim);
}

/** Open the decision a lead notice points at (the player tapped it). */
export function openNotice(sim: Sim, noticeId: number): void {
  const story = sim.story;
  const i = story.notices.findIndex((n) => n.id === noticeId);
  const notice = story.notices[i];
  const lead = notice && sim.content.events?.[notice.event]?.lead;
  if (!notice || !lead) return rejected(sim, 'story.openNotice', 'noNotice');
  story.notices.splice(i, 1);
  startEvent(sim, lead);
}

export function dismissNotice(sim: Sim, noticeId: number): void {
  const story = sim.story;
  story.notices = story.notices.filter((n) => n.id !== noticeId);
}

/** Per tick: lapse old leads, run the periodic draw, start due queued events. */
export function tickStory(sim: Sim): void {
  const story = sim.story;
  if (story.notices.length) story.notices = story.notices.filter((n) => n.expires > sim.tick);
  if (story.periodicSec > 0 && sim.tick >= story.nextPeriodic && !story.active && !sim.sector.inCombat) {
    drawEvent(sim, 'periodic');
    const jitter = withRng(story, (rng) => 0.75 + rng.next() * 0.5);
    story.nextPeriodic = sim.tick + Math.round(story.periodicSec * TICK_HZ * jitter);
  }
  pump(sim);
}
