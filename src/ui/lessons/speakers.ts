import type { UiLook } from '../api';

/**
 * The instructors who speak the lessons: fixed characters, one per lesson category, not the player's crew. A lesson names its speaker (a step
 * may override it); a card without one keeps the plain layout. The portrait is the speaker's own art (`portrait`, an asset manifest key, once
 * the Blender pipeline has made it), else the crew portrait renderer draws one from `look` (`api.lookPortrait`).
 */
export interface SpeakerDef {
  id: string;
  name: string;
  /** Their job, shown dim beside the name ("Pilot"). */
  role: string;
  /** Fallback portrait: a crew figure's look (species, role kit, appearance seed). */
  look: UiLook;
  /** Dedicated portrait art: the asset manifest key of a front portrait render (none yet). */
  portrait?: string;
}

export const SPEAKERS = {
  // Vash: cocky, restless, loves a fast exit. Teaches combat (and navigation later). Pilot kit; seed 22 is short blond hair, orange flight vest.
  'speaker.vash': { id: 'speaker.vash', name: 'Vash', role: 'Pilot', look: { species: 'species.human', role: 'role.pilot', appearanceSeed: 22 } },
} as const satisfies Record<string, SpeakerDef>;

export type SpeakerId = keyof typeof SPEAKERS;
