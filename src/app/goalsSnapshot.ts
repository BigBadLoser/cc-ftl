import { currentAct, goalMet } from '../sim/story/goals';
import type { Sim } from '../sim';
import type { UiGoals } from '../ui/api';

/** The goal chain as the goals card shows it: the act being played and its goals, or null when finished, skipped or absent. */
export function buildGoals(sim: Sim): UiGoals | null {
  const act = currentAct(sim);
  const all = sim.content.goals ?? [];
  if (!act) return null;
  const done = sim.story.goals.done;
  const r = act.reward;
  const reward = [
    r.credits ? `${r.credits} cr` : '',
    ...(r.items ?? []).map((q) => `${q.count} ${sim.content.items[q.item]?.name ?? q.item}`),
    r.reputation ? `+${r.reputation} standing` : '',
  ].filter(Boolean).join(', ');
  return {
    act: sim.story.goals.act + 1, acts: all.length, title: act.title, reward,
    goals: act.goals.map((g) => ({ id: g.id, title: g.title, text: g.text, done: done.includes(g.id) || goalMet(sim, g.check) })),
  };
}
