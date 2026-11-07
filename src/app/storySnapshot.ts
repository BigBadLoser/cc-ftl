import { checkOdds, unmetReasons, type SceneSpec, type Sim } from '../sim';
import type { SceneDerelict } from '../sim/scene/types';
import type { UiIntel, UiStory } from '../ui/api';
import { ambushRows } from './ambushIntel';
import { distressRows } from './distressIntel';
import { commsOf } from './comms/storyComms';

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const ownerName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

/** Wrecks worked before (`derelicts_found`) after which a scan of a derelict reads counts, not just signs. */
const PRACTISED = 2;

/**
 * A scan of a derelict, worded from what its ruin pass left (scene/derelicts.ts `readOf`). A deep scan (a probe of its core), or practice at
 * working wrecks, reads counts, not just signs.
 */
function derelictRows(sim: Sim, d: SceneDerelict, deep: boolean): { label: string; value: string }[] {
  const r = d.read;
  const practised = deep || (sim.story.flags['derelicts_found'] ?? 0) >= PRACTISED;
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
  const scanned = acts.has('scan') || acts.has('probe');
  if (scanned) for (const d of spec.derelicts) out.push({ kind: 'scan', ship: d.name, rows: derelictRows(sim, d, acts.has('probe')) });
  for (const s of spec.ships) {
    const ship = s.contact.name ?? 'Unknown ship';
    // Raiders of a ship in trouble show on its scan, not as ships of their own (they are on the scope as signatures, not hailed).
    if (s.stance === 'hostile' && spec.ships.some((o) => o.damage)) continue;
    if (scanned && s.ambush) out.push({ kind: 'scan', ship, rows: ambushRows(sim, s, ownerName(sim, s.contact.faction)) });
    else if (scanned && s.damage) out.push({ kind: 'scan', ship, rows: distressRows(sim, spec, s, ownerName(sim, s.contact.faction)) });
    else if (scanned) {
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
        quote: s.ambush?.talk ?? s.story ?? `${ship} here. Pull alongside if you want to deal; we hold station for you.`,
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
  const intel = def ? intelOf(sim, signal, done, (id) => def.choices?.find((c) => c.id === id)?.remote) : [];
  /** The first remote action of these kinds still to take (not done, requirements met): its id and kind. */
  const remoteLeft = (...r: string[]) => def?.choices?.find((c) => c.remote !== undefined && r.includes(c.remote) && !done.includes(c.id) && unmetReasons(sim, c).length === 0);
  const remoteChoice = (...r: string[]): string | null => remoteLeft(...r)?.id ?? null;
  const didRemote = (...r: string[]): boolean => done.some((id) => { const x = def?.choices?.find((c) => c.id === id)?.remote; return x !== undefined && r.includes(x); });
  const wares = def?.comms?.showWares !== false;
  const scan = intel.find((i) => i.kind === 'scan');
  const hail = intel.find((i) => i.kind === 'hail');
  return {
    active: active && def
      ? {
          event: active.event,
          title: def.title,
          text: def.text,
          intel,
          comms: def && commsOf(sim, {
            text: def.text, signal, done: { hail: didRemote('hail'), scan: didRemote('scan', 'probe') }, remotes: { hail: remoteChoice('hail'), scan: remoteChoice('scan', 'probe'), scanKind: remoteLeft('scan', 'probe')?.remote === 'probe' ? 'probe' : remoteLeft('scan', 'probe') ? 'scan' : null },
            scanRows: scan ? scan.rows : null, hailQuote: hail?.quote ?? null, goods: wares ? hail?.stock ?? [] : [], credits: wares ? hail?.credits : undefined,
          }),
          choices: (def.choices ?? []).map((c) => {
            const taken = done.includes(c.id);
            const reasons = taken ? [] : unmetReasons(sim, c);
            const odds = c.check ? checkOdds(sim, c.check) : null;
            return {
              id: c.id,
              ...(c.remote ? { remote: c.remote } : {}),
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
