import type { Faction } from './components';

/**
 * The allegiance model: are two factions at war? Different factions are, except that neutral is at war with nobody,
 * but the rogue AI is at war with everyone (neutral included). The same faction never is.
 */
export function factionsHostile(a: Faction | undefined, b: Faction | undefined): boolean {
  if (!a || !b || a === b) return false;
  if (a === 'rogue' || b === 'rogue') return true;
  return a !== 'neutral' && b !== 'neutral';
}

/** True for factions whose ships an AI doctrine runs (everything but the player and neutrals). */
export function isAiFaction(f: Faction): boolean {
  return f === 'hostile' || f === 'rogue';
}
