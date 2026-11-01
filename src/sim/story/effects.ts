import { shipIdAt , shipIdOf } from '../regions';
import { CrewC, HealthC } from '../crew/components';
import { ItemStackC } from '../items/components';
import { spillItems, takeFromStack } from '../items/stacks';
import { storageAdd, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { grantXp } from '../crew/xp';
import type { CrewTarget, EventEffect } from './defs';
import { describeQty } from './requirements';
import { PHYSICAL_LOG_MAX, flagValue, reputationOf, withRng } from './state';
import { inPacketView, playerCrew, playerShips, playerStorages, withPlayerAboard } from './world';

/** Who an effect applies to and the event it belongs to. */
export interface EffectCtx {
  event: string;
  /** The crew member who made the skill check, if any. */
  actor: number | null;
}

function targets(sim: Sim, who: CrewTarget | undefined, ctx: EffectCtx): number[] {
  const crew = playerCrew(sim);
  if (!crew.length) return [];
  if (who === 'all') return crew;
  if (who === 'actor' && ctx.actor !== null && crew.includes(ctx.actor)) return [ctx.actor];
  return [withRng(sim.story, (rng) => rng.pick(crew))];
}

const nameOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)?.name ?? 'Crew';
const names = (sim: Sim, ids: number[]): string => (ids.length > 1 ? `${ids.length} crew` : ids[0] === undefined ? 'nobody' : nameOf(sim, ids[0]));

/** Put items in the player's storage; what does not fit lands on the floor beside it. Returns units that found no room. */
export const giveItems = (sim: Sim, item: string, count: number): number => withPlayerAboard(sim, () => giveNow(sim, item, count));
/** In a packet view there is no floor to spill onto: what does not fit in storage is lost. */
function giveNow(sim: Sim, item: string, count: number): number {
  let left = count;
  const stores = playerStorages(sim);
  for (const id of stores) left -= storageAdd(sim, id, item, left);
  const first = stores[0] === undefined ? undefined : sim.world.get(stores[0], ModuleC);
  if (left > 0 && first && !inPacketView(sim)) left = spillItems(sim, shipIdOf(sim, first), first.x, first.y, item, left);
  return left;
}

/** Take items from the player's storage, then loose stacks on player ships. Returns units taken. */
export const takeItems = (sim: Sim, item: string, count: number): number => withPlayerAboard(sim, () => takeNow(sim, item, count));
function takeNow(sim: Sim, item: string, count: number): number {
  let left = count;
  for (const id of playerStorages(sim)) left -= storageTake(sim, id, item, left);
  const grids = playerShips(sim);
  for (const id of sim.world.query(ItemStackC)) {
    if (left <= 0) break;
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === item && grids.has(shipIdAt(sim, s.x, s.y))) left -= takeFromStack(sim, id, left);
  }
  return count - left;
}

/** Set a flag (or counter) and queue any event that triggers on it reaching its level. */
export function setFlag(sim: Sim, flag: string, value: number): void {
  const story = sim.story;
  const before = flagValue(story, flag);
  if (value === 0) delete story.flags[flag];
  else story.flags[flag] = value;
  for (const [id, def] of Object.entries(sim.content.events ?? {})) {
    for (const t of def.triggers) {
      if (t.kind !== 'flag' || t.flag !== flag) continue;
      const level = t.atLeast ?? 1;
      if (before < level && value >= level) story.queue.push({ event: id, due: sim.tick + Math.round((t.delaySec ?? 0) * TICK_HZ) });
    }
  }
}

const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

/** Apply one effect; always emits `story.effect` (text '' when there is nothing to show) and returns its one-line summary or null. */
export function applyEffect(sim: Sim, eff: EventEffect, ctx: EffectCtx): string | null {
  const text = withPlayerAboard(sim, () => run(sim, eff, ctx));
  sim.events.emit({ type: 'story.effect', event: ctx.event, effect: eff.type, text: text ?? '' });
  return text;
}

function run(sim: Sim, eff: EventEffect, ctx: EffectCtx): string | null {
  const story = sim.story;
  switch (eff.type) {
    case 'items': {
      if (eff.count >= 0) {
        giveItems(sim, eff.item, eff.count);
        return `+${describeQty(sim, eff)}`;
      }
      const got = takeItems(sim, eff.item, -eff.count);
      return `-${describeQty(sim, { item: eff.item, count: got })}`;
    }
    case 'crewDamage': {
      const ids = targets(sim, eff.who, ctx);
      for (const id of ids) {
        const h = sim.world.get(id, HealthC);
        if (h) h.hp = Math.max(0, h.hp - eff.amount);
      }
      return `${names(sim, ids)} takes ${eff.amount} damage`;
    }
    case 'crewHeal': {
      const ids = targets(sim, eff.who, ctx);
      for (const id of ids) {
        const h = sim.world.get(id, HealthC);
        if (h) h.hp = Math.min(h.max, h.hp + eff.amount);
      }
      return `${names(sim, ids)} heals ${eff.amount}`;
    }
    case 'skillXp': {
      const ids = targets(sim, eff.who, ctx);
      for (const id of ids) {
        grantXp(sim, id, eff.skill, eff.amount);
      }
      return `${names(sim, ids)}: ${eff.skill} ${sign(eff.amount)} xp`;
    }
    case 'reputation': {
      story.reputation[eff.faction] = reputationOf(story, eff.faction) + eff.delta;
      return `${eff.faction} standing ${sign(eff.delta)}`;
    }
    case 'flag': {
      const op = eff.op ?? 'set';
      const v = eff.value ?? 1;
      setFlag(sim, eff.flag, op === 'clear' ? 0 : op === 'add' ? flagValue(story, eff.flag) + v : v);
      return null;
    }
    case 'chain':
      story.queue.push({ event: eff.event, due: sim.tick + Math.round((eff.delaySec ?? 0) * TICK_HZ), force: true });
      return null;
    case 'physical': {
      story.physical.push({ id: story.nextId++, tick: sim.tick, event: ctx.event, outcome: eff.outcome });
      if (story.physical.length > PHYSICAL_LOG_MAX) story.physical.shift();
      return null;
    }
  }
}
