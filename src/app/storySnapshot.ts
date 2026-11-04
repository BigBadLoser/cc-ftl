import { checkOdds, unmetReasons, type SceneSpec, type Sim } from '../sim';
import type { UiIntel, UiStory } from '../ui/api';

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const ownerName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

/** What the remote actions taken on a signal reveal about its scene: a scan reads hulls and crew, a hail gets each ship's stock and wallet. */
function intelOf(sim: Sim, spec: SceneSpec | null, done: readonly string[], remoteOf: (choice: string) => string | undefined): UiIntel[] {
  if (!spec) return [];
  const acts = new Set(done.map(remoteOf));
  const out: UiIntel[] = [];
  for (const s of spec.ships) {
    const ship = s.contact.name ?? 'Unknown ship';
    if (acts.has('scan')) {
      out.push({
        kind: 'scan', ship, rows: [
          { label: 'Transponder', value: ownerName(sim, s.contact.faction) },
          { label: 'Hull', value: s.family ? `${s.family[0]?.toUpperCase()}${s.family.slice(1)} class` : 'Unknown' },
          { label: 'Crew aboard', value: s.crew === undefined ? 'Unclear' : String(s.crew) },
          { label: 'Drive', value: s.stay === undefined ? 'Cold' : s.hailed ? 'Cold: holding station for you' : 'Cold, not for long' },
        ],
      });
    }
    if (acts.has('hail')) {
      out.push({
        kind: 'hail', ship, rows: [],
        quote: `${ship} here. Pull alongside if you want to deal; we hold station for you.`,
        stock: (s.cargo ?? []).map((q) => ({ item: q.item, name: itemName(sim, q.item), count: q.count })),
        ...(s.credits !== undefined ? { credits: s.credits } : {}),
      });
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
          intel: intelOf(sim, signal, done, (id) => def.choices?.find((c) => c.id === id)?.remote),
          choices: (def.choices ?? []).map((c) => {
            const taken = done.includes(c.id);
            const reasons = taken ? [] : unmetReasons(sim, c);
            const odds = c.check ? checkOdds(sim, c.check) : null;
            return {
              id: c.id,
              label: c.label,
              hint: c.hint ?? null,
              enabled: !taken && reasons.length === 0,
              ...(taken ? { done: true } : {}),
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
