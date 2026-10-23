import type { Sim } from '../sim';
import { unit } from './hash';
import {
  ARMED, AVOID_CHANCE, AVOID_RATIO, CLASH_NOISE, DEPTH_POWER, HURT_WINNER, LOSS_DRAW, LOSS_DRIVEN, ROLE_POWER, SHIP_POWER, WAR_RELATION, WIN_ALL, WIN_DRIVE,
} from './tuningWar';
import type { Contact, Fleet } from './types';

/**
 * The stats mini-sim for fleets that meet outside the player's node (meetings.ts applies the result). No ships are made real: strength comes from what a fleet's
 * descriptors say (size class, depth, role), a bounded random factor makes an even match a coin flip, and an overwhelming one is decided. Pure: every roll is a hash of
 * (seed, both fleets, turn), so a run and a replay agree.
 */

const SALT = { avoid: 61, noise: 62, loss: 63, hurt: 64 } as const;

/** One ship's power: its size class and role, a little more for deeper (more dangerous) space. */
export const shipPower = (c: Contact, role: Fleet['role']): number => SHIP_POWER[c.size ?? 'small'] * ROLE_POWER[role] * (1 + DEPTH_POWER * c.depth);

/** A fleet's power: the sum over its ships, halved while it is stranded (hurt, adrift). */
export const fleetPower = (f: Fleet): number => f.ships.reduce((n, c) => n + shipPower(c, f.role), 0) * (f.damaged ? 0.5 : 1);

/** Do the two fleets' factions fight on sight? Either side's relation to the other sums to at most WAR_RELATION, or one is always hostile (the rogue AI). */
export function atWar(sim: Sim, a: string, b: string): boolean {
  if (a === b) return false;
  const fs = sim.content.galaxy?.factions;
  const fa = fs?.[a];
  const fb = fs?.[b];
  if (!fa || !fb) return false;
  if (fa.alwaysHostile || fb.alwaysHostile) return true;
  return (fa.relations?.[b] ?? 0) + (fb.relations?.[a] ?? 0) <= WAR_RELATION;
}

/** Would these two fleets fight? At war, and at least one carries weapons (two haulers never do). */
export const wouldFight = (sim: Sim, a: Fleet, b: Fleet): boolean =>
  atWar(sim, a.faction, b.faction) && (ARMED.includes(a.role) || ARMED.includes(b.role));

/** What happened to one side. 'fled': survivors run home; 'destroyed': no ship left; 'unhurt' / 'hurt': it holds the field (hurt = stranded, calling for help). */
export interface SideResult {
  /** Ships of the fleet that were destroyed. */
  lost: Contact[];
  fate: 'unhurt' | 'hurt' | 'fled' | 'destroyed';
}

/**
 * `decisive`: one side destroyed; `driven`: one side lost some and ran; `draw`: both hurt; `avoided`: a pirate saw a patrol it could not take and ran (no fight).
 * `winner` is 'a' | 'b' for decisive and driven, null otherwise (for `avoided` the runner is `fate: 'fled'` on its side).
 */
export interface Clash {
  kind: 'decisive' | 'driven' | 'draw' | 'avoided';
  winner: 'a' | 'b' | null;
  /** a's share of the combined (noisy) power. */
  share: number;
  a: SideResult;
  b: SideResult;
}

const untouched: SideResult = { lost: [], fate: 'unhurt' };

function lose(sim: Sim, f: Fleet, other: Fleet, turn: number, chance: number): Contact[] {
  return f.ships.filter((c) => unit(sim.seed, f.id, other.id, turn, c.id, SALT.loss) < chance);
}

function side(f: Fleet, lost: Contact[], held: 'unhurt' | 'hurt' | 'fled'): SideResult {
  return { lost, fate: lost.length >= f.ships.length ? 'destroyed' : held };
}

/** Settle a meeting of two fleets that fight. */
export function clash(sim: Sim, a: Fleet, b: Fleet, turn: number): Clash {
  const pa = fleetPower(a);
  const pb = fleetPower(b);
  // A pirate that sees a patrol far stronger than itself slips away rather than fight.
  for (const [prey, hunter, preyIs] of [[a, b, 'a'], [b, a, 'b']] as const) {
    const pp = preyIs === 'a' ? pa : pb;
    const ph = preyIs === 'a' ? pb : pa;
    if (prey.role === 'pirate' && hunter.role === 'patrol' && !prey.damaged && pp < AVOID_RATIO * ph && unit(sim.seed, Math.min(a.id, b.id), Math.max(a.id, b.id), turn, SALT.avoid) < AVOID_CHANCE) {
      const ran = { lost: [], fate: 'fled' as const };
      return { kind: 'avoided', winner: null, share: preyIs === 'a' ? 0 : 1, a: preyIs === 'a' ? ran : untouched, b: preyIs === 'b' ? ran : untouched };
    }
  }
  const ra = pa * (1 + CLASH_NOISE * (2 * unit(sim.seed, a.id, b.id, turn, SALT.noise) - 1));
  const rb = pb * (1 + CLASH_NOISE * (2 * unit(sim.seed, b.id, a.id, turn, SALT.noise) - 1));
  const share = ra / (ra + rb);
  const strong = share >= 0.5 ? 'a' : 'b';
  const s = Math.max(share, 1 - share);
  const w = strong === 'a' ? a : b;
  const l = strong === 'a' ? b : a;
  const hurt = unit(sim.seed, w.id, l.id, turn, SALT.hurt) < HURT_WINNER * (1 - s);
  const won = side(w, [], hurt ? 'hurt' : 'unhurt');
  let lostSide: SideResult;
  let kind: Clash['kind'];
  if (s >= WIN_ALL) {
    kind = 'decisive';
    lostSide = { lost: [...l.ships], fate: 'destroyed' };
  } else if (s >= WIN_DRIVE) {
    kind = 'driven';
    lostSide = side(l, lose(sim, l, w, turn, (LOSS_DRIVEN * (s - WIN_DRIVE)) / (WIN_ALL - WIN_DRIVE)), 'fled');
  } else {
    // A draw: both hold their ground, hurt, and each may lose a ship.
    const wl = side(w, lose(sim, w, l, turn, LOSS_DRAW), 'hurt');
    const ll = side(l, lose(sim, l, w, turn, LOSS_DRAW), 'hurt');
    return strong === 'a' ? { kind: 'draw', winner: null, share, a: wl, b: ll } : { kind: 'draw', winner: null, share, a: ll, b: wl };
  }
  return strong === 'a' ? { kind, winner: 'a', share, a: won, b: lostSide } : { kind, winner: 'b', share, a: lostSide, b: won };
}
