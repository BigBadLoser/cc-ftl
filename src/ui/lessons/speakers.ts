import type { UiLook } from '../api';

/**
 * The instructors who speak the lessons: fixed characters, one per lesson category (combat, later engineering and so on), not the player's
 * crew. A lesson names its speaker (a step may override it); a card without one keeps the plain layout. The portrait is drawn by the crew
 * portrait renderer from `look` alone (`api.lookPortrait`).
 */
export interface SpeakerDef {
  id: string;
  name: string;
  /** Their job, shown dim beside the name ("Tactical"). */
  role: string;
  look: UiLook;
}

export const SPEAKERS = {
  // PLACEHOLDER: the user is still choosing the instructors. Name, role and look are stand-ins.
  'speaker.tactical': { id: 'speaker.tactical', name: 'Reyes', role: 'Tactical', look: { species: 'species.human', role: 'role.gunner', appearanceSeed: 7 } },
} as const satisfies Record<string, SpeakerDef>;

export type SpeakerId = keyof typeof SPEAKERS;
