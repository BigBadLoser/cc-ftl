import type { InteractionDef } from '../sim';

/**
 * Crew interactions (docs/TRAITS.md section 6), the data the bond system plays (crew/interact.ts). Only a chat and the shouting match
 * exist; a deep talk, a joke, an insult or comforting a grieving friend are more entries here. Numbers are tuned so a first friend or
 * rival takes about one to three hours of play together (`crewBonds.slow.test.ts` pins it).
 */

/** Two crew within a few tiles of each other, both at their leisure, sometimes talk. How it goes follows how well they get on and their mood. Rivals do not chat. */
const chat = {
  id: 'interaction.chat', name: 'Chat',
  where: { meal: 1.5, break: 2, idle: 0.6 },
  chance: 0.035, radius: 3, opinion: { min: -30 }, cooldownSec: 90, durationSec: 8,
  outcomes: [
    { id: 'good', weight: { base: 0.5, compat: 0.5, mood: 0.2 }, delta: 5, compatScale: 0.5, reason: 'chat', icon: 'chat', mood: 'chat' },
    { id: 'bad', weight: { base: 0.5, compat: -0.5, mood: -0.2 }, delta: -4, reason: 'badChat', icon: 'chatBad' },
  ],
} satisfies InteractionDef;

/** Rivals who meet and are unhappy shout at each other: a scene, a mood hit to both, a log line, nobody hurt. */
const shout = {
  id: 'interaction.shout', name: 'Shouting match',
  where: { near: 1 },
  chance: 0.03, radius: 5, opinion: { max: -30 }, traitMult: { 'trait.hot_headed': 3 }, lowMood: 3, cooldownSec: 600, durationSec: 8,
  outcomes: [
    { id: 'row', weight: { base: 1 }, delta: -5, reason: 'row', icon: 'shout', mood: 'row', log: true },
  ],
} satisfies InteractionDef;

export const interactions = { [chat.id]: chat, [shout.id]: shout };
