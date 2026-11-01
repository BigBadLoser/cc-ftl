import type { UiConsole, UiShipModule } from '../api';

/** One station tag of the status strip: a short name, a one-word status, and a tooltip that spells out what it costs when it is down. */
export interface StationTag {
  tag: string;
  label: string;
  /** Manned and powered (consoles), or online (engines). */
  ok: boolean;
  /** Someone is on the way: shown amber between NO CREW and MANNED. */
  warn?: boolean;
  status: string;
  tip: string;
}

type ConsoleKind = UiConsole['kind'];

/** What an empty console costs, from the sim: see the weaponCharge, shields and helm systems. */
const CONSEQUENCE: Record<ConsoleKind, string> = {
  weapons: "weapons won't charge",
  shields: 'shields regenerate slower',
  helm: "no evasion, FTL won't charge",
};
const CONSOLES: { kind: ConsoleKind; tag: string; label: string; empty: string }[] = [
  { kind: 'weapons', tag: 'WPN', label: 'Weapons', empty: 'Weapons console has no crew' },
  { kind: 'shields', tag: 'SHD', label: 'Shields', empty: 'Shield console has no crew' },
  { kind: 'helm', tag: 'HELM', label: 'Helm', empty: 'Helm has no crew' },
];

function consoleTag(consoles: readonly UiConsole[], def: (typeof CONSOLES)[number]): StationTag {
  const c = consoles.find((x) => x.kind === def.kind);
  const ok = !!c && c.powered && c.operator !== null;
  const bad = `${def.empty}: ${CONSEQUENCE[def.kind]}`;
  let tip = bad;
  if (c && ok) tip = `${def.label} manned by ${c.operator}`;
  else if (!c) tip = `${def.label}: no console installed. ${bad}`;
  else if (!c.powered) tip = `${def.label} console unpowered. ${bad}`;
  if (!ok && c?.powered && c.enRoute) {
    return { tag: def.tag, label: def.label, ok: false, warn: true, status: 'EN ROUTE', tip: `${c.enRoute} is on the way to the ${def.label.toLowerCase()} console` };
  }
  return { tag: def.tag, label: def.label, ok, status: ok ? 'MANNED' : 'NO CREW', tip };
}

/**
 * The four station tags: weapons, shields and helm are manned, powered consoles; engines (no console) are online when at least one engine
 * module is powered and intact.
 */
export function stationTags(consoles: readonly UiConsole[], modules: readonly UiShipModule[]): StationTag[] {
  const engines = modules.filter((m) => m.kind === 'engine');
  const online = engines.some((m) => m.powered && m.hp > 0);
  let tip = 'Engines online';
  if (!online) tip = engines.length === 0 ? 'No engines installed: no evasion' : 'Engines offline (unpowered or destroyed): no evasion';
  const engineTag = { tag: 'ENG', label: 'Engines', ok: online, status: online ? 'ONLINE' : 'OFFLINE', tip };
  return [...CONSOLES.map((def) => consoleTag(consoles, def)), engineTag];
}
