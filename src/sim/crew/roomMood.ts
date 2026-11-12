import { roomQualityOf } from '../roomQuality';
import type { Sim } from '../sim';
import { MOOD_PLAY_POINTS, MOOD_RELAX_POINTS, NO_BREAK_POINTS, NO_BREAK_SEC, ROOM_TIER_LEISURE, ROOM_TIER_MEAL, ROOM_TIER_SLEEP, ROOM_TIER_SURROUND } from '../tuning';
import type { Mood, MoodFactor } from './components';

/**
 * The mood factors that come from room quality (sim/roomQuality.ts) and breaks: how good the room is a crew member sleeps, eats and takes
 * breaks in (timed factors, tier fixed when the moment ends), the always-on surroundings, and "No time off". Tier index 2 is Decent, the
 * neutral one: no extra factor for a meal, no surroundings factor.
 */

/** Mood factor keys by tier index (grim..impressive). Decent has none for surroundings and meals; a decent sleep is the plain 'bed'. */
const SURROUND = ['surroundGrim', 'surroundBare', '', 'surroundPleasant', 'surroundImpressive'] as const;
const MEAL = ['messGrim', 'messBare', '', 'messPleasant', 'messImpressive'] as const;
const BED = ['bedGrim', 'bedBare', 'bed', 'bedPleasant', 'bedImpressive'] as const;

export const ROOM_MOOD_LABELS: Readonly<Record<string, string>> = {
  surroundGrim: 'Grim surroundings', surroundBare: 'Bare surroundings', surroundPleasant: 'Pleasant surroundings', surroundImpressive: 'Impressive surroundings',
  messGrim: 'Ate in a grim mess', messBare: 'Ate in a bare mess', messPleasant: 'Ate in a pleasant mess', messImpressive: 'Ate in an impressive mess',
  bedGrim: 'Slept in a cramped cabin', bedBare: 'Slept in a bare cabin', bed: 'Slept in a bed', bedPleasant: 'Slept in a pleasant cabin', bedImpressive: 'Slept in an impressive cabin',
  playedGame: 'Played a game', noTimeOff: 'No time off',
};

/** Tier index of the room a crew member stands in (Decent when they are in none). */
export function tierHere(sim: Sim, id: number): number {
  return roomQualityOf(sim, id)?.tier ?? 2;
}

/** Points of a break: the mess's flat lift, or a game's, shifted by the room's tier. */
export function breakPoints(play: boolean, tier: number): number {
  return (play ? MOOD_PLAY_POINTS : MOOD_RELAX_POINTS) + (ROOM_TIER_LEISURE[tier] ?? 0);
}

/** The sleep-in-a-bed factor of a tier (decent is the plain 'bed'). */
export function bedFactor(tier = 2): MoodFactor {
  return { key: BED[tier] ?? 'bed', value: ROOM_TIER_SLEEP[tier] ?? 5 };
}

/** The extra factors of a galley meal eaten in a room of tier `mealTier`, the surroundings of the room they are in now, and no time off. */
export function roomFactors(sim: Sim, id: number, m: Mood): MoodFactor[] {
  const out: MoodFactor[] = [];
  const meal = m.meal > 0 ? MEAL[m.mealTier ?? 2] : '';
  if (meal) out.push({ key: meal, value: ROOM_TIER_MEAL[m.mealTier ?? 2] as number });
  const here = roomQualityOf(sim, id);
  const near = here ? SURROUND[here.tier] : '';
  if (near) out.push({ key: near, value: ROOM_TIER_SURROUND[here?.tier ?? 2] as number });
  if ((m.noBreak ?? 0) >= NO_BREAK_SEC) out.push({ key: 'noTimeOff', value: NO_BREAK_POINTS });
  return out;
}
