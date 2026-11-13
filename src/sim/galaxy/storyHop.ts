import { drawEvent, pump } from '../story/engine';
import { remotesDone } from '../story/requirements';
import { withRng } from '../story/state';
import type { Sim } from '../sim';
import { STORY_ANCHOR_CHANCE, STORY_HOP_CHANCE } from './tuning';
import type { EdgeData, Travel } from './types';
import { enterEvent } from './eventGrid';
import { storySpec } from '../scene/spec';

/** A decision that is about a scene (`EventDef.scene`) gets its scene built as it opens: remote actions read it, and investigating opens it. */
function noteSignal(sim: Sim): void {
  const a = sim.story.active;
  const recipe = a ? sim.content.events?.[a.event]?.scene : undefined;
  if (!a || !recipe || sim.galaxy.signal?.event === a.event) return;
  sim.galaxy.signal = storySpec(sim, a.event, recipe);
  sim.story.scene = null; // a stale request (an event answered outside a trip) never opens this one
}

/** A remote hail answered on the signal: its ships know you are coming and hold station once you drop out. */
function noteHails(sim: Sim): void {
  const a = sim.story.active;
  const spec = sim.galaxy.signal;
  if (!a || spec?.event !== a.event) return;
  const def = sim.content.events?.[a.event];
  if (!def || !remotesDone(def, a).some((id) => def.choices?.find((c) => c.id === id)?.remote === 'hail')) return;
  for (const s of spec.ships) s.hailed = true;
  sim.galaxy.rev++;
}

/**
 * The decision closed: if the player chose to investigate its scene (a `scene` effect), the ship drops out mid-lane into it (the event grid; the trip
 * stays held and goes on from the same hop once it is left). True when it did. Otherwise the signal is dropped: nothing was spawned.
 */
function investigate(sim: Sim): boolean {
  const g = sim.galaxy;
  const spec = g.signal;
  const want = sim.story.scene;
  g.signal = null;
  sim.story.scene = null;
  return !!spec && want === spec.event && enterEvent(sim, 'scene', spec);
}

/**
 * Story events belong to travel (user, 2026-10-23): they are drawn at a hop of a hyperspace trip, where interdictions are checked, and never
 * while the ship idles in a node. At most one per hop, and never on a hop that interdicted (the caller only asks when it did not).
 *
 * `storyAtHop` first lets a queued follow-up that came due open (it is this hop's event), else rolls the hop's chance (`STORY_HOP_CHANCE`,
 * `STORY_ANCHOR_CHANCE` on a lane with a mid-lane anchor) with the story Rng and draws from the 'transit' pool. When that opens a decision the
 * trip is held (phase 'story', `held: 'hopEnd'`); a notice does not hold it. (The story system does not run in hyperspace: this is the only
 * place the queue is pumped there.)
 */
export function storyAtHop(sim: Sim, t: Travel, edge: EdgeData): boolean {
  const story = sim.story;
  pump(sim);
  if (!story.active && withRng(story, (rng) => rng.next()) < (edge.anchor ? STORY_ANCHOR_CHANCE : STORY_HOP_CHANCE)) drawEvent(sim, 'transit');
  if (!story.active) return false;
  noteSignal(sim);
  t.phase = 'story';
  t.held = 'hopEnd';
  return true;
}

/**
 * Per tick of a trip: a decision that opens while the trip is under way (a queued follow-up that came due) holds it mid-hop; a held trip
 * goes on once the decision is answered. Returns true while the trip must not advance this tick. `resume` continues after a finished hop.
 */
export function storyHold(sim: Sim, t: Travel, resume: (sim: Sim, t: Travel) => void): boolean {
  if (t.phase === 'hop') {
    pump(sim);
    if (!sim.story.active) return false;
    noteSignal(sim);
    t.phase = 'story';
    t.held = 'hop';
    return true;
  }
  if (t.phase !== 'story') return false;
  if (sim.story.active) {
    noteSignal(sim); // a decision queued behind the one answered
    noteHails(sim);
    return true;
  }
  if (investigate(sim)) return true;
  const held = t.held ?? 'hop';
  delete t.held;
  t.phase = held === 'hopEnd' ? 'hop' : held;
  if (held === 'hopEnd') resume(sim, t);
  return true;
}
