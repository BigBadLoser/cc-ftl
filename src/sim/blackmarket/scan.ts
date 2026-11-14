import { heldItems } from '../items/held';
import { nodeState } from '../galaxy/state';
import { liveInspection, startInspection } from '../inspect/start';
import type { Encounter } from '../galaxy/types';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { contrabandItems } from './services';
import { SCAN_BRIBE_MIN, SCAN_BRIBE_SHARE, SCAN_COOLDOWN, SCAN_FINE_MIN, SCAN_FINE_SHARE } from './tuning';

/**
 * Scans for contraband. Navy and corporation stations inspect the player when they open trade with a station (`dockScan`, from `trade.hail`: inspectors come
 * aboard, inspect/); their patrols sometimes scan one they cross (encounters.ts calls `scanFor`), which makes a `scan` Encounter. One that finds contraband aboard carries `Encounter.scan`
 * (what the goods are worth): the patrol hails the player to stop, and the trip waits for `galaxy.respond` 'comply' or 'run' (inspect/patrol.ts).
 * A scan that finds nothing is an ordinary 'acknowledge' scan.
 * Contraband is whatever `heldItems` lists (storage, loose stacks, wielded and carried items, fitted upgrades), in a node or in the ship's packet.
 * By rule (#160) shuttle holds (`VehicleC.cargo`, stowed or docked) are NOT scanned or seized: a patrol sees the ship, not its shuttles' holds. Pinned by a test in
 * src/content/stateIntegrity.test.ts; do not add a vehicle source to `heldItems` to "fix" it.
 */

/** Government and corporation factions enforce the law at their stations and with their patrols. */
export const LAW_ENFORCERS: readonly string[] = ['government', 'corporation'];

export const enforces = (sim: Sim, faction: string): boolean => LAW_ENFORCERS.includes(sim.content.galaxy?.factions[faction]?.kind ?? '');

/** The contraband the player carries, by item id ascending. */
export function contrabandAboard(sim: Sim): ItemQty[] {
  const ids = contrabandItems(sim);
  if (!ids.length) return [];
  const have = new Map<string, number>();
  for (const h of heldItems(sim)) if (ids.includes(h.item) && h.count > 0) have.set(h.item, (have.get(h.item) ?? 0) + h.count);
  return ids.filter((i) => have.has(i)).map((item) => ({ item, count: have.get(item) as number }));
}

/** What contraband lines are worth at base prices. */
export const contrabandValue = (sim: Sim, lines: readonly ItemQty[]): number =>
  lines.reduce((n, l) => n + (sim.content.items[l.item]?.price ?? 0) * l.count, 0);

/** The fine and the bribe for goods of this value. */
export const scanPrices = (value: number): { fine: number; bribe: number } => ({
  fine: Math.max(SCAN_FINE_MIN, Math.ceil(value * SCAN_FINE_SHARE)),
  bribe: Math.max(SCAN_BRIBE_MIN, Math.ceil(value * SCAN_BRIBE_SHARE)),
});

/** Make a scan encounter carry its contraband finding, when the scanner enforces the law and the player carries any. */
export function scanFor(sim: Sim, e: Encounter): void {
  if (e.kind !== 'scan' || !enforces(sim, e.faction)) return;
  const lines = contrabandAboard(sim);
  if (!lines.length) return;
  const value = contrabandValue(sim, lines);
  e.scan = { value };
  sim.events.emit({ type: 'scan.found', id: e.id, faction: e.faction, value });
}

/**
 * A station of an enforcing faction inspects the player as they open trade with it (once per SCAN_COOLDOWN turns per node): it sends its inspectors
 * over (inspect/start.ts), who search the ship whatever it carries. Returns true when an inspection set off.
 */
export function dockScan(sim: Sim, station: number, owner: string | undefined, name: string): boolean {
  const g = sim.galaxy;
  if (!owner || !enforces(sim, owner) || sim.sector.state !== 'active' || g.event || liveInspection(sim)) return false;
  const ns = nodeState(sim, g.current);
  if (ns.scanned !== undefined && g.turn - ns.scanned < SCAN_COOLDOWN) return false;
  if (!startInspection(sim, station, owner, name)) return false;
  ns.scanned = g.turn;
  return true;
}

/** Trade waits on a scan: a patrol's hail to stop waits for an answer, or inspectors are searching or waiting for one. */
export function scanPending(sim: Sim): boolean {
  const phase = liveInspection(sim)?.[1].phase;
  return sim.galaxy.encounters.some((e) => e.kind === 'scan' && !!e.scan) || phase === 'search' || phase === 'settle';
}
