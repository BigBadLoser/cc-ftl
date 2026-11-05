import type { Sim } from '../../sim';
import { peekGenerated, warmContact } from '../../sim/galaxy/arrivals';
import type { SceneShip, SceneSpec } from '../../sim/scene/types';
import type { UiComms } from '../../ui/api';
import type { CallerInfo, CommsTone } from '../../ui/comms/types';
import { scanSeesNameTell } from '../ambushIntel';
import { holoRequestOf } from '../shipHolo';
import { scanView } from './scanView';
import { speakerOf, type Speaker } from './speaker';
import { transcriptOf } from './transcript';

/**
 * The adapter from an open story signal to the comms window's data (`UiComms`): who is calling, what has been said, what the scan read. It reads
 * the signal's scene, the event's text and which remote actions are done; the scan's rows come in from storySnapshot (they are worded there, with
 * the crew's skills). Hail and scan state is the story's `done` list, so the window shows what the sim recorded.
 */

const FACTION_COLOUR: Record<string, string> = { pirates: '#c96b3a', civilian: 'var(--green)', government: 'var(--cyan)', corporation: 'var(--amber)', rogue: 'var(--red)' };
const cap = (t: string): string => `${t[0]?.toUpperCase() ?? ''}${t.slice(1)}`;
const STANCE: Record<SceneShip['stance'], { label: string; tone: CommsTone }> = {
  neutral: { label: 'Neutral', tone: 'amber' }, hostile: { label: 'Hostile', tone: 'red' }, helpless: { label: 'Helpless', tone: 'cyan' },
};

export interface CommsInput {
  /** The event's story text. */
  text: string;
  signal: SceneSpec | null;
  /** Which remote actions are done, and the choice ids that raise them (null: none). */
  done: { hail: boolean; scan: boolean };
  remotes: { hail: string | null; scan: string | null };
  /** The scan's readings so far (null: not scanned), what the hail said, and the lead ship's goods and wallet. */
  scanRows: { label: string; value: string }[] | null;
  hailQuote: string | null;
  goods: UiComms['goods'];
  credits: number | undefined;
}

export function commsOf(sim: Sim, i: CommsInput): UiComms | null {
  const { text, signal, done, remotes, scanRows, hailQuote, goods, credits } = i;
  if (!signal) return null;
  const ship = signal.ships[0];
  const derelict = signal.derelicts[0];
  if (!ship && !derelict) return null;
  const hailed = done.hail && !!ship;
  const scanned = done.scan;
  const factionName = (id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;
  const base = { hailed, scanned, hailChoice: remotes.hail, scanChoice: remotes.scan, goods, ...(credits !== undefined ? { credits } : {}) };
  if (!ship) {
    const rows = scanView(scanRows ?? []);
    return {
      ...base, hailed: false, caller: null, look: null, stutter: false, transcript: transcriptOf(text, { name: 'Signal' }), hint: null, holo: null,
      hullTitle: 'DERELICT', scanHint: 'Scan for hull, air and signs of life.', callouts: rows.callouts, readout: rows.readout,
    };
  }
  const c = ship.contact;
  const kind = sim.content.galaxy?.factions[c.faction]?.kind;
  warmContact(sim, c);
  const shipName = peekGenerated(sim, c)?.template.name;
  const sp: Speaker = speakerOf(ship, shipName, kind);
  const noun = ship.ambush ? 'skiff' : 'ship';
  const family = ship.family ?? '';
  const tellName = ship.ambush?.trap === true && ship.ambush.tell === 'name';
  const caller: CallerInfo = hailed
    ? {
        name: sp.name, ...(tellName ? { alt: sp.altName } : {}), role: 'Captain of the', ship: c.name ?? (`${family ? `${family} ` : ''}${sp.tag}`.trim() || undefined),
        faction: `${factionName(c.faction)}${family ? ` · ${family} ${noun}` : ''}${sp.tag ? ` · ${sp.tag}` : ''}`, swatch: FACTION_COLOUR[kind ?? ''] ?? 'var(--dim)', status: STANCE[ship.stance],
      } as CallerInfo
    : { name: `Unknown ${noun}`, faction: `${factionName(c.faction)} transponder`, status: { label: 'Unknown', tone: 'dim' } };
  const opening = transcriptOf(text, { name: cap(noun) }, sp.name);
  const said = hailQuote ?? `${family ? cap(family) : 'Ship'} ${sp.tag} here. Pull alongside if you want to deal; we hold station for you.`;
  const spoken = hailed ? transcriptOf(said.includes('"') ? said : `"${said}"`, { name: sp.name, ...(tellName ? { alt: sp.altName } : {}) }, sp.name) : [];
  const read = scanRows?.map((r) => {
    if (r.label !== 'Transponder') return r;
    return { ...r, value: sp.tag ? `${r.value} · ${sp.tag}` : r.value };
  }) ?? [];
  const alts: Record<string, string> = scanned && scanSeesNameTell(sim, ship) && sp.tag ? { Transponder: `${factionName(c.faction)} · ${sp.altTag}` } : {};
  const view = scanView(read, alts);
  return {
    ...base, caller, look: hailed ? sp.look : null, stutter: hailed && ship.ambush?.trap === true && ship.ambush.tell === 'lag',
    transcript: [...opening, ...spoken], hint: !hailed && remotes.hail ? 'Hail to hear more from the caller.' : null,
    holo: holoRequestOf(ship), hullTitle: family ? `${family.toUpperCase()} CLASS` : null, scanHint: 'Scan for weapons, boarding craft and crew.',
    callouts: view.callouts, readout: view.readout,
  };
}
