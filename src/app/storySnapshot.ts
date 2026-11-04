import { checkOdds, unmetReasons, type SceneSpec, type Sim } from '../sim';
import type { SceneDerelict } from '../sim/scene/types';
import type { UiIntel, UiStory } from '../ui/api';

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const ownerName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

/** Wrecks worked before (`derelicts_found`) after which a scan of a derelict reads counts, not just signs. */
const PRACTISED = 2;

/** A scan of a derelict, worded from what its ruin pass left (scene/derelicts.ts `readOf`); with practice the signs come with counts. */
function derelictRows(sim: Sim, d: SceneDerelict): { label: string; value: string }[] {
  const r = d.read;
  const practised = (sim.story.flags['derelicts_found'] ?? 0) >= PRACTISED;
  const state = r.ruin < 0.35 ? 'Mostly whole' : r.ruin < 0.6 ? 'Battered' : 'Gutted';
  const air = r.vacuum > 0.75 ? 'Open to space' : r.vacuum > 0.25 ? 'Holed; some rooms hold air' : 'Mostly sealed';
  const signs = r.sacs > 0 ? (practised ? `Egg sacs, about ${r.sacs}` : 'Faint life signs') : r.machines > 0 ? (practised ? `Machine signatures, about ${r.machines}` : 'Machine signatures') : 'Nothing moving';
  return [
    { label: 'Make', value: sim.content.factions?.[d.shipgen]?.name ?? 'Unknown' },
    { label: 'Condition', value: `${state}, ${r.cause === 'combat' ? 'battle damage' : 'long decay'}` },
    { label: 'Air', value: r.fires > 0 ? `${air}; fires burning` : air },
    ...(r.jammed > 0 ? [{ label: 'Doors', value: 'Some jammed shut' }] : []),
    { label: 'Signs', value: signs },
    ...(r.containers > 0 ? [{ label: 'Loose cargo', value: practised ? `${r.containers} containers adrift` : 'Containers adrift' }] : []),
  ];
}

/** What the remote actions taken on a signal reveal about its scene: a scan reads hulls and crew (and a derelict's state), a hail gets each ship's stock and wallet. */
function intelOf(sim: Sim, spec: SceneSpec | null, done: readonly string[], remoteOf: (choice: string) => string | undefined): UiIntel[] {
  if (!spec) return [];
  const acts = new Set(done.map(remoteOf));
  const out: UiIntel[] = [];
  if (acts.has('scan')) for (const d of spec.derelicts) out.push({ kind: 'scan', ship: d.name, rows: derelictRows(sim, d) });
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
