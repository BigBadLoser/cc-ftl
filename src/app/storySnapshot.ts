import { checkOdds, unmetReasons, type SceneSpec, type Sim } from '../sim';
import type { UiStory } from '../ui/api';

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const ownerName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

/** What the remote actions taken on a signal reveal about its scene: a scan reads hulls and crew, a hail gets each ship's stock and wallet. */
function factsOf(sim: Sim, spec: SceneSpec | null, done: readonly string[], remoteOf: (choice: string) => string | undefined): string[] {
  if (!spec) return [];
  const acts = new Set(done.map(remoteOf));
  const out: string[] = [];
  for (const s of spec.ships) {
    const name = s.contact.name ?? 'Unknown ship';
    if (acts.has('scan')) {
      const hull = s.family ? `${s.family} hull` : 'hull';
      out.push(`Scan: ${name}, ${ownerName(sim, s.contact.faction)} transponder, ${hull}, ${s.crew ?? '?'} aboard.`);
    }
    if (acts.has('hail')) {
      const stock = (s.cargo ?? []).map((q) => `${q.count} ${itemName(sim, q.item)}`).join(', ');
      out.push(`Hail: "${name} here. Got ${stock || 'not much'} to trade${s.credits !== undefined ? `, and ${s.credits} credits to buy with` : ''}."`);
    }
  }
  return out;
}

/** Plain-data view of the open event decision (with requirement reasons and skill odds) and the last result. */
export function buildStory(sim: Sim): UiStory {
  const { active, last } = sim.story;
  const def = active && sim.content.events?.[active.event];
  const done = active?.done ?? [];
  const lastDef = last && sim.content.events?.[last.event];
  const signal = sim.galaxy.signal?.event === active?.event ? sim.galaxy.signal : null;
  return {
    active: active && def
      ? {
          event: active.event,
          title: def.title,
          text: def.text,
          facts: factsOf(sim, signal, done, (id) => def.choices?.find((c) => c.id === id)?.remote),
          choices: (def.choices ?? []).map((c) => {
            const reasons = done.includes(c.id) ? ['Done'] : unmetReasons(sim, c);
            const odds = c.check ? checkOdds(sim, c.check) : null;
            return {
              id: c.id,
              label: c.label,
              hint: c.hint ?? null,
              enabled: reasons.length === 0,
              reasons,
              odds: odds ? { pct: Math.round(odds.chance * 100), label: odds.label } : null,
              cost: (c.cost ?? []).map((q) => `${q.count}x ${itemName(sim, q.item)}`),
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
