import { armorOf } from '../robots/core';
import type { Rng } from '../rng';
import type { Sim } from '../sim';
import { canBeInjured, partCondition, partDestroyed } from './body';
import { DeadC, DownedC, HealthC } from './components';
import { InjuriesC, type Injuries, type InjurySource } from './injuryTypes';

/**
 * The one answer to "a crew member takes damage" (#601): hp off the pool and, from a source, maybe an injury on a part rolled from that
 * source's weights (content/injuries.ts). Every crew damage site calls `damageCrew`: ship weapons and arcs (combat/effects.ts), hand weapons
 * (fight/fighter.ts), story events (story/effects.ts), and the tile harm and bleeding the vitals and injury systems deal. Seeded sim rng only.
 */

export interface DamageOpts {
  /** The body's armour (`SpeciesDef.armor`) shrugs off its share: weapons. */
  armor?: boolean;
  /** A dose source (fire, vacuum): the harm adds up, and each `threshold` of it injures. Else a hit, which may injure at once. */
  dose?: boolean;
}

/** Take `amount` hp off a crew member (armour first when `opts.armor`). A source may injure a standing body that can be injured. The hp dealt. */
export function damageCrew(sim: Sim, id: number, amount: number, source: InjurySource | null, opts: DamageOpts = {}): number {
  const health = sim.world.get(id, HealthC);
  if (!health || !(amount > 0)) return 0;
  const dealt = opts.armor ? amount * (1 - armorOf(sim, id)) : amount;
  const standing = health.hp > 0 && !sim.world.has(id, DownedC) && !sim.world.has(id, DeadC);
  health.hp = Math.max(0, health.hp - dealt);
  if (source && standing && dealt > 0 && canBeInjured(sim, id)) {
    if (opts.dose) dose(sim, id, source, dealt);
    else hit(sim, id, source, dealt);
  }
  return dealt;
}

/** Going down always adds one serious injury (vitals' `down`). */
export function injureOnDown(sim: Sim, id: number): void {
  if (canBeInjured(sim, id)) injure(sim, id, 'downed', true);
}

function hit(sim: Sim, id: number, source: InjurySource, dealt: number): void {
  const def = sim.content.injuries?.sources[source];
  if (!def || dealt < def.threshold || !sim.rng.chance(def.chance)) return;
  const ramp = def.seriousAt > def.threshold ? (dealt - def.threshold) / (def.seriousAt - def.threshold) : 1;
  const p = Math.max(def.seriousChance ?? 0, Math.min(1, ramp));
  injure(sim, id, source, p >= 1 || (p > 0 && sim.rng.chance(p)));
}

function dose(sim: Sim, id: number, source: InjurySource, dealt: number): void {
  const def = sim.content.injuries?.sources[source];
  if (!def || def.threshold <= 0) return;
  const inj = injuriesComp(sim, id);
  const d = (inj.dose ??= {});
  d[source] = (d[source] ?? 0) + dealt;
  while ((d[source] ?? 0) >= def.threshold) {
    d[source] = (d[source] ?? 0) - def.threshold;
    injure(sim, id, source, (def.seriousChance ?? 0) > 0 && sim.rng.chance(def.seriousChance ?? 0));
  }
}

function injuriesComp(sim: Sim, id: number): Injuries {
  let inj = sim.world.get(id, InjuriesC);
  if (!inj) {
    inj = { list: [] };
    sim.world.add(id, InjuriesC, inj);
  }
  return inj;
}

/** A weighted pick from `weights` (in key order), or undefined when nothing has weight. */
function weighted(rng: Rng, weights: Readonly<Record<string, number>>): string | undefined {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = rng.next() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of entries) if ((r -= w) < 0) return k;
  return entries.at(-1)?.[0];
}

/** Injure `count` parts (the source's) from `source`: a part by weight (not one already lost), then a fitting kind of the severity (the other when none fits). */
function injure(sim: Sim, id: number, source: InjurySource, serious: boolean): void {
  const c = sim.content.injuries;
  const def = c?.sources[source];
  if (!c || !def) return;
  for (let n = 0; n < (def.count ?? 1); n++) {
    const open = Object.fromEntries(Object.entries(def.parts).filter(([p]) => !partDestroyed(sim, id, p)));
    const part = weighted(sim.rng, open);
    if (!part) return;
    const fits = (list: readonly string[]) => list.filter((k) => { const parts = c.kinds[k]?.parts; return !!c.kinds[k] && (!parts || parts.includes(part)); });
    const first = fits(serious ? def.serious : def.minor);
    const kinds = first.length ? first : fits(serious ? def.minor : def.serious);
    if (kinds.length) addInjury(sim, id, part, sim.rng.pick(kinds), undefined, source);
  }
}

/**
 * Put one injury of `kind` on `part` (the sources, and `debug.setCrew`, which may set it `as` a scar or a lost part at once). A part already lost takes
 * none. A serious injury that leaves the part with no condition destroys it: its injuries go, and one `destroyed` entry stays for good.
 */
export function addInjury(sim: Sim, id: number, part: string, kind: string, as?: 'scar' | 'destroyed', src?: InjurySource): void {
  const k = sim.content.injuries?.kinds[kind];
  if (!k || !sim.content.injuries?.parts[part] || partDestroyed(sim, id, part)) return;
  const inj = injuriesComp(sim, id);
  const from = src ? { src, at: sim.tick } : {};
  if (as === 'scar') {
    inj.list.push({ part, kind, sev: 'scar', age: 0, heal: 0, ...from });
    return;
  }
  inj.list.push({ part, kind, sev: k.severity, age: 0, heal: 0, ...(k.bleed ? { bleeding: true as const } : {}), ...from });
  if (as === 'destroyed' || (k.severity === 'serious' && partCondition(sim, id, part, inj.list) <= 0)) {
    inj.list = inj.list.filter((i) => i.part !== part);
    inj.list.push({ part, kind, sev: 'destroyed', age: 0, heal: 0, ...from });
    sim.events.emit({ type: 'crew.injured', crew: id, part, kind, severity: 'destroyed' });
    return;
  }
  sim.events.emit({ type: 'crew.injured', crew: id, part, kind, severity: k.severity });
}

/** First aid: every bleeding injury stops. True if any was bleeding. */
export function stopBleeding(sim: Sim, id: number): boolean {
  let any = false;
  for (const i of sim.world.get(id, InjuriesC)?.list ?? []) {
    if (!i.bleeding) continue;
    delete i.bleeding;
    any = true;
  }
  return any;
}
