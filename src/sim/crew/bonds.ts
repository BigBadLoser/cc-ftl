import { defineComponent } from '../ecs';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  BOND_FADE_SEC, BOND_FRIEND, BOND_KEEP, BOND_MAX, BOND_MAX_FRIENDS, BOND_MAX_RIVALS, BOND_REASONS,
} from '../tuning';
import { CrewC } from './components';
import { traitMult } from './traits';

/**
 * The bond store (docs/TRAITS.md section 6): one opinion record per ordered pair of *people*, kept on `sim.bonds` (saved with the game).
 * People are keyed by a stable person id (`PersonC.id`, never reused), not an entity id, so anyone with a lasting identity can hold or be
 * the subject of an opinion: crew now, a passenger or a recurring pirate when they get an identity. A record is an object so that more can
 * grow into it later (a partner, a shared bed, jealousy) without reshaping the store; only the score, its reasons and the friend / rival
 * label exist today.
 */

/** A crew member's lasting identity. Allocated by `ensurePerson`; the first crew spawn or the first bond pass that meets them. */
export interface Person {
  id: number;
}
export const PersonC = defineComponent<Person>('person');

/** One cause of an opinion: `id` names it (the UI words it), `d` the points it has added in total (merged by id), `tick` when it last did, `at` the node it happened at. */
export interface BondReason {
  id: string;
  d: number;
  tick: number;
  at?: string;
}

/** What one person thinks of another. */
export interface Opinion {
  /** -100..100, to one decimal place or so. */
  score: number;
  reasons: BondReason[];
  /** Tick of the last shared event (a chat, a fight...): the fade counts from here. */
  touched: number;
  /** Set while the score holds a friend / rival label (hysteresis: kept down to BOND_KEEP). */
  kind?: 'friend' | 'rival';
  /** Tick of the last time a source or interaction applied to this pair (cooldowns by source id). */
  last?: Record<string, number>;
}

export interface BondState {
  /** The next person id. */
  next: number;
  /** `opinions[from][to]`. Sparse. */
  opinions: Record<number, Record<number, Opinion>>;
  /** Person id to entity id and display name (a person outlives the screen they were last seen on). */
  entity: Record<number, number>;
  names: Record<number, string>;
  /** Deaths already mourned: person id to the tick. */
  dead: Record<number, number>;
}

export const newBonds = (): BondState => ({ next: 1, opinions: {}, entity: {}, names: {}, dead: {} });

/** The person id of an entity, or 0 when it has none yet. */
export const personOf = (sim: Sim, entity: number): number => sim.world.get(entity, PersonC)?.id ?? 0;

/** Give an entity a person id (once) and return it. */
export function ensurePerson(sim: Sim, entity: number): number {
  const had = sim.world.get(entity, PersonC);
  if (had) return had.id;
  const id = sim.bonds.next++;
  sim.world.add(entity, PersonC, { id });
  sim.bonds.entity[id] = entity;
  sim.bonds.names[id] = sim.world.get(entity, CrewC)?.name ?? 'Crew';
  return id;
}

export const opinionOf = (sim: Sim, from: number, to: number): Opinion | undefined => sim.bonds.opinions[from]?.[to];

/** The entity of a person id (0 when unknown). */
export const entityOf = (sim: Sim, person: number): number => sim.bonds.entity[person] ?? 0;

/** Everyone `from` holds a friend (or rival) label for, strongest first. */
export function labelled(sim: Sim, from: number, kind: 'friend' | 'rival'): { person: number; op: Opinion }[] {
  const out: { person: number; op: Opinion }[] = [];
  const row = sim.bonds.opinions[from];
  if (!row) return out;
  for (const k of Object.keys(row)) if (row[+k]!.kind === kind) out.push({ person: +k, op: row[+k]! });
  return out.sort((a, b) => Math.abs(b.op.score) - Math.abs(a.op.score) || a.person - b.person);
}

export const friendsOf = (sim: Sim, from: number): { person: number; op: Opinion }[] => labelled(sim, from, 'friend');
export const rivalsOf = (sim: Sim, from: number): { person: number; op: Opinion }[] => labelled(sim, from, 'rival');

/** The main reason of an opinion: the one that moved the score most, the latest on a tie. */
export function mainReason(op: Opinion): BondReason | undefined {
  let best: BondReason | undefined;
  for (const r of op.reasons) if (!best || Math.abs(r.d) > Math.abs(best.d) || (Math.abs(r.d) === Math.abs(best.d) && r.tick > best.tick)) best = r;
  return best;
}

export interface Crossing {
  from: number;
  to: number;
  kind: 'friend' | 'rival';
}

function addReason(op: Opinion, id: string, d: number, tick: number, at?: string): void {
  const had = op.reasons.find((r) => r.id === id);
  if (had) {
    had.d += d;
    had.tick = tick;
    if (at) had.at = at;
  } else {
    op.reasons.push({ id, d, tick, ...(at ? { at } : {}) });
    if (op.reasons.length > BOND_REASONS) {
      // Drop the reason that matters least (smallest total), the oldest on a tie.
      let drop = 0;
      op.reasons.forEach((r, i) => {
        const w = op.reasons[drop]!;
        if (Math.abs(r.d) < Math.abs(w.d) || (Math.abs(r.d) === Math.abs(w.d) && r.tick < w.tick)) drop = i;
      });
      op.reasons.splice(drop, 1);
    }
  }
}

/** Change what `from` thinks of `to` by `delta`, for `reason`. `shared`: the change is a shared event, so it resets the fade. Returns a crossing when it made a friend or a rival. */
export function bump(sim: Sim, from: number, to: number, delta: number, reason: string, opts: { shared?: boolean; at?: string; source?: string } = {}): Crossing | null {
  if (from === to || from <= 0 || to <= 0) return null;
  const row = (sim.bonds.opinions[from] ??= {});
  const op = (row[to] ??= { score: 0, reasons: [], touched: sim.tick });
  if (delta !== 0) addReason(op, reason, delta, sim.tick, opts.at);
  if (opts.source) (op.last ??= {})[opts.source] = sim.tick;
  if (opts.shared !== false) op.touched = sim.tick;
  return setScore(sim, from, to, op, op.score + delta);
}

/** Set a score under the friend / rival rules: the caps, the labels and their hysteresis. */
function setScore(sim: Sim, from: number, to: number, op: Opinion, raw: number): Crossing | null {
  let s = Math.max(-BOND_MAX, Math.min(BOND_MAX, Math.round(raw * 100) / 100));
  let crossing: Crossing | null = null;
  const kind = s >= BOND_FRIEND ? 'friend' : s <= -BOND_FRIEND ? 'rival' : null;
  if (kind && op.kind !== kind) {
    const peers = labelled(sim, from, kind).filter((p) => p.person !== to);
    const cap = kind === 'friend' ? BOND_MAX_FRIENDS : BOND_MAX_RIVALS;
    const weakest = peers.length >= cap ? peers[peers.length - 1]! : null; // strongest first, so the last is the weakest
    if (!weakest) {
      op.kind = kind;
      crossing = { from, to, kind };
    } else if (Math.abs(s) > Math.abs(weakest.op.score)) {
      delete weakest.op.kind;
      weakest.op.score = (kind === 'friend' ? 1 : -1) * (BOND_FRIEND - 1);
      op.kind = kind;
      crossing = { from, to, kind };
    } else s = (kind === 'friend' ? 1 : -1) * (BOND_FRIEND - 1);
  } else if (op.kind === 'friend' && s < BOND_KEEP) delete op.kind;
  else if (op.kind === 'rival' && s > -BOND_KEEP) delete op.kind;
  op.score = s;
  return crossing;
}

/** Trait scaling of a change the way `from` takes it: Peacemaker gains faster, Hot-headed loses faster, Protective bonds faster in shared danger. */
export function bondScale(sim: Sim, entity: number, delta: number, danger: boolean): number {
  if (!entity) return delta;
  let m = delta > 0 ? traitMult(sim, entity, 'bondGain') : traitMult(sim, entity, 'bondLoss');
  if (danger && delta > 0) m *= traitMult(sim, entity, 'dangerBond');
  return delta * m;
}

/** One score drifts a point toward 0 for each BOND_FADE_SEC since it was last touched. Called by the bond system every pass. */
export function fadeBonds(sim: Sim): void {
  const span = BOND_FADE_SEC * TICK_HZ;
  for (const fk of Object.keys(sim.bonds.opinions)) {
    const row = sim.bonds.opinions[+fk]!;
    for (const tk of Object.keys(row)) {
      const op = row[+tk]!;
      let faded = false;
      while (sim.tick - op.touched >= span) {
        op.touched += span;
        faded = true;
        const s = op.score > 0 ? Math.max(0, op.score - 1) : Math.min(0, op.score + 1);
        setScore(sim, +fk, +tk, op, s);
      }
      if (faded && op.score === 0 && !op.kind) delete row[+tk]; // faded to nothing: let it go
    }
    if (Object.keys(row).length === 0) delete sim.bonds.opinions[+fk];
  }
}

export interface ChangeOpts {
  /** Counts as a shared event (default true): resets the fade. A passive trickle passes false. */
  shared?: boolean;
  /** A shared-danger change: Protective crew take it twice as fast. */
  danger?: boolean;
  /** Cooldown key stored on the record (`Opinion.last`). */
  source?: string;
}

/** Tell the log about a new friend or rival, once per pair: the first side to cross speaks, the other way is quiet. */
function announce(sim: Sim, c: Crossing | null): void {
  if (!c) return;
  const other = sim.bonds.opinions[c.to]?.[c.from];
  if (other?.kind === c.kind) return;
  const crew = entityOf(sim, c.from), who = entityOf(sim, c.to);
  if (crew && who) sim.events.emit({ type: c.kind === 'friend' ? 'crew.befriended' : 'crew.rivalry', crew, other: who });
}

/** Change what crew member `from` thinks of `to` (entities), scaled by `from`'s traits. Both get a person id if they lack one. */
export function bondTo(sim: Sim, from: number, to: number, delta: number, reason: string, opts: ChangeOpts = {}): void {
  const f = ensurePerson(sim, from), t = ensurePerson(sim, to);
  announce(sim, bump(sim, f, t, bondScale(sim, from, delta, !!opts.danger), reason, { shared: opts.shared, source: opts.source, at: sim.sector.node }));
}

/** The same change both ways (each scaled by their own traits). */
export function bondBoth(sim: Sim, a: number, b: number, delta: number, reason: string, opts: ChangeOpts = {}): void {
  bondTo(sim, a, b, delta, reason, opts);
  bondTo(sim, b, a, delta, reason, opts);
}

/** True when this pair's `source` last applied under `sec` seconds ago (from `a`'s record). */
export function onCooldownFor(sim: Sim, a: number, b: number, source: string, sec: number): boolean {
  const at = opinionOf(sim, personOf(sim, a), personOf(sim, b))?.last?.[source];
  return at !== undefined && sim.tick - at < sec * TICK_HZ;
}
