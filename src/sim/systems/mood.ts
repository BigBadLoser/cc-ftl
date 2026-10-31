import { CrewC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { ensureMood, hasCompany, hasMood, moodFactors, moodScore } from '../crew/mood';
import { advanceTraitMemory } from '../crew/traitMood';
import type { Sim } from '../sim';
import { MOOD_INTERVAL, MOOD_LOW, MOOD_VERY_LOW } from '../tuning';

/**
 * Mood for crew with moods: every MOOD_INTERVAL ticks (staggered by id) the factors are recomputed from needs, room
 * conditions and company, and the score is their sum around MOOD_BASE. The memory counters (hot meal, last sleep, time
 * alone) count down or up here. `crew.moodLow` fires once when the score drops under MOOD_VERY_LOW.
 * Low mood slows work through the stat resolver (crew/mood.ts moodModifiers); nothing else reads it yet.
 */
export function moodSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC)) {
    if ((sim.tick + id) % MOOD_INTERVAL !== 0 || !hasMood(sim, id) || isIncapacitated(sim, id)) continue;
    const m = ensureMood(sim, id);
    const dt = MOOD_INTERVAL / 20;
    m.meal = Math.max(0, m.meal - dt);
    m.sleep = Math.max(0, m.sleep - dt);
    m.alone = hasCompany(sim, id) ? 0 : m.alone + dt;
    advanceTraitMemory(sim, id, m, dt);
    m.factors = moodFactors(sim, id, m);
    m.value = moodScore(m.factors);
    if (m.value < MOOD_VERY_LOW && !m.low) {
      m.low = true;
      sim.events.emit({ type: 'crew.moodLow', crew: id, mood: m.value });
    } else if (m.value >= MOOD_LOW) m.low = false;
  }
}
