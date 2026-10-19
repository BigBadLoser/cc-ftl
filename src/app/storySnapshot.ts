import { checkOdds, unmetReasons, type Sim } from '../sim';
import type { UiStory } from '../ui/api';

/** Plain-data view of the open event decision (with requirement reasons and skill odds) and the last result. */
export function buildStory(sim: Sim): UiStory {
  const { active, last } = sim.story;
  const def = active && sim.content.events?.[active.event];
  const itemName = (id: string) => sim.content.items[id]?.name ?? id;
  const lastDef = last && sim.content.events?.[last.event];
  return {
    active: active && def
      ? {
          event: active.event,
          title: def.title,
          text: def.text,
          choices: (def.choices ?? []).map((c) => {
            const reasons = unmetReasons(sim, c);
            const odds = c.check ? checkOdds(sim, c.check) : null;
            return {
              id: c.id,
              label: c.label,
              hint: c.hint ?? null,
              enabled: reasons.length === 0,
              reasons,
              odds: odds ? { pct: Math.round(odds.chance * 100), label: odds.label } : null,
              cost: (c.cost ?? []).map((q) => `${q.count}x ${itemName(q.item)}`),
            };
          }),
        }
      : null,
    last: last
      ? {
          tick: last.tick,
          title: lastDef ? lastDef.title : last.event,
          choice: lastDef?.choices?.find((c) => c.id === last.choice)?.label ?? last.choice,
          success: last.success,
          text: last.text,
          lines: last.lines,
        }
      : null,
  };
}
