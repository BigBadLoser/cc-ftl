import { SuitC } from '../eva/components';
import { hasSuitAir, suitDef } from '../eva/suit';
import { isCombatReady, isHostile } from '../fight/relations';
import { sightLine } from '../fight/los';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import {
  BREAK_BATTLE_SHY_SEC, BREAK_COMBAT_RADIUS, BREAK_COMBAT_SEC, BREAK_DARK_FEAR_SEC, BREAK_DARK_SEC, BREAK_FIRE_RADIUS, EVA_AIR_LOW_FRAC, FIRE_FEAR_RADIUS,
  LIGHT_DARK_BELOW, O2_HARM_BELOW,
} from '../tuning';
import { STRESSOR_P } from './breakTable';
import type { BreakContext, Tile2 } from './breakTypes';
import { CrewC, DeadC, NeedsC, PositionC, type Mood, type Position } from './components';
import { traitDefs, traitFlag } from './traits';

/**
 * The acute stressors of docs/TRAITS.md section 5, read from world state at check time. Each context has a presence test (is it
 * there right now: also what a running break watches to end early) and a chance (presence, the duration counters on `Mood` and the
 * crew member's traits). `grief` is the seam for relationships (section 6): it is never present until a friend's death is recorded.
 */

/** Hostiles in sight within `radius` tiles of the crew member, nearest first. */
export function hostilesInSight(sim: Sim, id: number, radius: number): Position[] {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return [];
  const ship = shipIdOf(sim, pos);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const out: { p: Position; d: number }[] = [];
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === id || !isHostile(sim, id, o) || !isCombatReady(sim, o)) continue;
    const p = sim.world.get(o, PositionC) as Position;
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d > radius || shipIdOf(sim, p) !== ship) continue;
    if (sightLine(sim, grid, pos, p).visible) out.push({ p, d });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.p);
}

/** True when a hostile (fit to fight) stands within `radius` tiles of (x, y) on ship `ship`: the Battle-shy pick penalty for a job site there. */
export function hostileWithin(sim: Sim, id: number, ship: number, x: number, y: number, radius: number): boolean {
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === id || !isHostile(sim, id, o) || !isCombatReady(sim, o)) continue;
    const p = sim.world.get(o, PositionC) as Position;
    if (Math.hypot(p.x - x, p.y - y) <= radius && shipIdOf(sim, p) === ship) return true;
  }
  return false;
}

/** The nearest burning tile within `radius` tiles, or null. */
export function fireNear(sim: Sim, id: number, radius: number): Tile2 | null {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (!pos || !grid?.has('fire')) return null;
  const px = Math.round(pos.x), py = Math.round(pos.y);
  let best: Tile2 | null = null, bestD = Infinity;
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (!grid.inBounds(x, y) || grid.get('fire', x, y) <= 0) continue;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

const fireRadius = (sim: Sim, id: number): number => (traitFlag(sim, id, 'fireFear') ? FIRE_FEAR_RADIUS : BREAK_FIRE_RADIUS);

/** Suited on a thin tile with the tank running low, or suited in a breached room (an interior tile with no air): decompression, not a plain spacewalk. */
function decompressing(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (!pos || !grid?.has('o2') || !hasSuitAir(sim, id) || !grid.inBounds(pos.x, pos.y) || grid.get('o2', pos.x, pos.y) >= O2_HARM_BELOW) return false;
  const air = sim.world.get(id, SuitC)?.air;
  const low = air !== undefined && air <= suitDef(sim).airSec * EVA_AIR_LOW_FRAC;
  return low || (grid.has('room') && grid.get('room', pos.x, pos.y) !== 0);
}

const darkHere = (sim: Sim, id: number): boolean => {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  return !!pos && !!grid?.has('light') && grid.inBounds(pos.x, pos.y) && grid.get('light', pos.x, pos.y) < LIGHT_DARK_BELOW;
};

/** Seconds a hostile must have been in sight before combat counts; and the same for darkness. */
const combatSec = (sim: Sim, id: number): number => (traitFlag(sim, id, 'battleFear') ? BREAK_BATTLE_SHY_SEC : BREAK_COMBAT_SEC);
const darkSec = (sim: Sim, id: number): number => (traitFlag(sim, id, 'darkFear') ? BREAK_DARK_FEAR_SEC : BREAK_DARK_SEC);

/** Advance the duration counters by `dt` seconds (the mood system's cadence). Reset when a break ends. */
export function advanceStress(sim: Sim, id: number, m: Mood, dt: number): void {
  // Kept only while non-zero, so a crew member who is never under fire or in the dark keeps the Mood shape they had.
  if (hostilesInSight(sim, id, BREAK_COMBAT_RADIUS).length > 0) m.underFire = (m.underFire ?? 0) + dt;
  else delete m.underFire;
  if (darkHere(sim, id)) m.dark = (m.dark ?? 0) + dt;
  else delete m.dark;
}

/** Where a debug-started break's stressor is: the nearest burning tile or hostile, if any (what panic flees from). */
export function nearestStressor(sim: Sim, id: number, context: BreakContext): Tile2 | undefined {
  if (context === 'fire') return fireNear(sim, id, fireRadius(sim, id)) ?? undefined;
  if (context === 'combat') return hostilesInSight(sim, id, BREAK_COMBAT_RADIUS)[0];
  return undefined;
}

/** Is the context there right now (ignoring how long it has lasted)? */
export function contextPresent(sim: Sim, id: number, context: BreakContext): boolean {
  switch (context) {
    case 'fire': return fireNear(sim, id, fireRadius(sim, id)) !== null;
    case 'combat': return hostilesInSight(sim, id, BREAK_COMBAT_RADIUS).length > 0;
    case 'decompression': return decompressing(sim, id);
    case 'blackout': return darkHere(sim, id);
    case 'exhaustion': {
      const n = sim.world.get(id, NeedsC);
      return !!n && (n.rest < 10 || (n.hunger !== undefined && n.hunger <= 0));
    }
    case 'grief': return false; // relationships (section 6) will record a friend's death; until then there is nobody to grieve
    default: return false; // lowMood has no context to lose
  }
}

/** Combat stress is halved for a Protective crew member with a friend (any living crew member, until relationships) within 6 tiles. */
function protectedByFriend(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  if (!pos || !traitFlag(sim, id, 'protective')) return false;
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === id || sim.world.has(o, DeadC) || isHostile(sim, id, o)) continue;
    const p = sim.world.get(o, PositionC) as Position;
    if (shipIdOf(sim, p) === shipIdOf(sim, pos) && Math.hypot(p.x - pos.x, p.y - pos.y) <= 6) return true;
  }
  return false;
}

/** Product of a crew member's multipliers for one context (the all-stressors susceptibility is `susceptibility`, applied to the whole chance). */
export function stressMult(sim: Sim, id: number, context: BreakContext): number {
  let m = 1;
  for (const d of traitDefs(sim, id)) m *= d.effects?.stressBy?.[context] ?? 1;
  return context === 'combat' && protectedByFriend(sim, id) ? m * 0.5 : m;
}

/** Product of the traits that make every stressor, and the low-mood chance, more or less likely (Stoic, Sensitive, Cheerful, Gloomy). */
export function susceptibility(sim: Sim, id: number): number {
  let m = 1;
  for (const d of traitDefs(sim, id)) m *= d.effects?.stress ?? 1;
  return m;
}

export interface Stressor {
  context: Exclude<BreakContext, 'lowMood'>;
  /** The chance per check, before the mood scale and the draft. */
  p: number;
  src?: Tile2;
}

/** The stressors acting on the crew member now, with their chances. */
export function stressors(sim: Sim, id: number, m: Mood): Stressor[] {
  const out: Stressor[] = [];
  const add = (context: Stressor['context'], src?: Tile2): void => {
    const p = STRESSOR_P[context] * stressMult(sim, id, context);
    if (p > 0) out.push({ context, p, src });
  };
  const fire = fireNear(sim, id, fireRadius(sim, id));
  if (fire) add('fire', fire);
  if ((m.underFire ?? 0) >= combatSec(sim, id)) { const h = hostilesInSight(sim, id, BREAK_COMBAT_RADIUS)[0]; add('combat', h && { x: h.x, y: h.y }); } // a copy, never the live Position
  if (decompressing(sim, id)) add('decompression');
  if ((m.dark ?? 0) >= darkSec(sim, id)) add('blackout');
  if (contextPresent(sim, id, 'exhaustion')) add('exhaustion');
  if (contextPresent(sim, id, 'grief')) add('grief');
  return out;
}
