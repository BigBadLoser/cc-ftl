import type { Sim } from './sim';

/**
 * Dev and test guard for the hyperspace packet (#350). While the player's ship is a packet (`sector.state === 'hyperspace'`) its ship, crew and
 * cargo are not world entities, so a read of them answers nothing unless it runs inside `withPlayerAboard` (story/world.ts). That answer is
 * silently wrong, so the accessors for the player's ship, crew and cargo call `guardPacked`: with the guard on, a read made while packed and not
 * inside `withPlayerAboard` throws (tests) or logs an error (dev build). Off by default, so production play is untouched. The test setup
 * (`src/sim/testSetup.ts`) turns it on in 'throw' mode and `main.ts` in 'warn' mode for the dev build, checking tick code only.
 * A read that really means "the ship is away, answer nothing" uses the accessor's `packedOk` variant instead, which skips the check.
 */
export type PackedGuardMode = 'off' | 'throw' | 'warn';

let mode: PackedGuardMode = 'off';
let ticksOnly = false;

/**
 * Turn the guard on or off. `ticksOnly` checks only the reads made inside `sim.step`: the dev build uses it, because the view code (the
 * bridge's per-frame snapshots, click handlers) reads the player ship between ticks and rightly shows nothing while it is packed.
 */
export const setPackedGuard = (m: PackedGuardMode, opts: { ticksOnly?: boolean } = {}): void => {
  mode = m;
  ticksOnly = opts.ticksOnly ?? false;
};

/** The sims inside `step` right now (set by `Sim.step`). */
export const stepping = new WeakSet<Sim>();

/** The sims whose packet entities are in the world right now (inside `withPlayerAboard`). */
export const aboard = new WeakSet<Sim>();

/** Flag a read of the player's ship, crew or cargo made while the ship is a hyperspace packet and no `withPlayerAboard` is open. */
export function guardPacked(sim: Sim, what: string): void {
  if (mode === 'off' || (ticksOnly && !stepping.has(sim)) || sim.sector.state !== 'hyperspace' || !sim.sector.packet || aboard.has(sim)) return;
  const msg = `${what} read while the player ship is a hyperspace packet: wrap the caller in withPlayerAboard (or use the packedOk variant if "ship away" is the right answer)`;
  if (mode === 'throw') throw new Error(msg);
  console.error(msg, new Error().stack);
}
