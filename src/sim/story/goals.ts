import type { Sim } from '../sim';
import { repKey } from '../galaxy/standing';
import { galaxyIndex, nodeOf } from '../galaxy/state';
import type { GoalActDef, GoalCheck } from './defs';
import { giveItems, setFlag } from './effects';
import { flagValue, reputationOf } from './state';
import { addCredits } from '../trade/credits';

/**
 * The tutorial goal chain (content `goals`): acts of goals done in any order. Finishing every goal of an act pays its reward
 * and opens the next; after the last, flag `goals.done` is set (a story event can follow on it). Progress lives in
 * `story.goals`; the moments the sim cannot read back from its state are counted as `stat.<name>` flags by `bumpStat` where
 * they happen (a trade settled, a job done, a module built...). Command: `story.skipGoals`.
 */

/** Count one of something the goal chain watches. */
export function bumpStat(sim: Sim, stat: string, by = 1): void {
  const flag = `stat.${stat}`;
  setFlag(sim, flag, flagValue(sim.story, flag) + by);
}

/** The cluster of the player's node, or null. */
function clusterHere(sim: Sim): string | null {
  const n = nodeOf(sim, sim.galaxy.current);
  return (n && galaxyIndex(sim.galaxy).sectors.get(n.sector)?.cluster) ?? null;
}

export function goalMet(sim: Sim, check: GoalCheck): boolean {
  const g = sim.story.goals;
  if (check.kind === 'stat') return flagValue(sim.story, `stat.${check.stat}`) >= (check.atLeast ?? 1);
  if (check.kind === 'visited') return Object.keys(sim.galaxy.visited).length >= check.count;
  const here = clusterHere(sim);
  return !!g.home && !!here && here !== g.home;
}

/** The act being played, or null when the chain is finished, skipped or absent. */
export function currentAct(sim: Sim): GoalActDef | null {
  const g = sim.story.goals;
  return g.skipped ? null : sim.content.goals?.[g.act] ?? null;
}

function payReward(sim: Sim, act: GoalActDef): void {
  const r = act.reward;
  if (r.credits) addCredits(sim, r.credits);
  for (const q of r.items ?? []) giveItems(sim, q.item, q.count);
  const owner = r.reputation ? nodeOf(sim, sim.galaxy.current)?.faction : null;
  if (r.reputation && owner) {
    const key = repKey(sim, owner);
    sim.story.reputation[key] = reputationOf(sim.story, key) + r.reputation;
  }
}

/** Mark the goals of the current act that are met; when all are, pay the act and open the next. Once a second (goals system). */
export function tickGoals(sim: Sim): void {
  const g = sim.story.goals;
  g.home ??= clusterHere(sim);
  const act = currentAct(sim);
  if (!act) return;
  for (const goal of act.goals) {
    if (g.done.includes(goal.id) || !goalMet(sim, goal.check)) continue;
    g.done.push(goal.id);
    sim.events.emit({ type: 'goal.done', goal: goal.id, title: goal.title });
  }
  if (!act.goals.every((x) => g.done.includes(x.id))) return;
  payReward(sim, act);
  sim.events.emit({ type: 'goal.actDone', act: act.id, title: act.title });
  g.act++;
  g.done = [];
  if (!sim.content.goals?.[g.act]) setFlag(sim, 'goals.done', 1);
}

/** `story.skipGoals`: drop the goal chain for this game. */
export function skipGoals(sim: Sim): void {
  sim.story.goals.skipped = true;
}
