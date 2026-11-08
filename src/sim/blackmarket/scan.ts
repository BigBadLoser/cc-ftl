import { JobC } from '../crew/components';
import { cancelFit, heldItems, withHeld } from '../items/held';
import { repKey } from '../galaxy/standing';
import { nodeState } from '../galaxy/state';
import { liveInspection, startInspection } from '../inspect/start';
import type { Encounter } from '../galaxy/types';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { contrabandItems } from './services';
import { SCAN_BRIBE_MIN, SCAN_BRIBE_SHARE, SCAN_COOLDOWN, SCAN_FINE_MIN, SCAN_FINE_SHARE, SCAN_STANDING_HIT } from './tuning';

/**
 * Scans for contraband. Navy and corporation stations inspect the player when they open trade with a station (`dockScan`, from `trade.hail`: inspectors come
 * aboard, inspect/); their patrols sometimes scan one they cross (encounters.ts calls `scanFor`), which makes a `scan` Encounter. One that finds contraband aboard carries `Encounter.scan`
 * (what the goods are worth, the fine and the bribe) and waits for `galaxy.respond`: 'surrender' (the goods are taken, the fine is paid and the faction
 * thinks less of the player) or 'bribe' (the bribe is paid and nothing else happens). A scan that finds nothing is an ordinary 'acknowledge' scan.
 * Contraband is whatever `heldItems` lists (storage, loose stacks, wielded and carried items, fitted upgrades), in a node or in the ship's packet.
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

/** Take every unit of contraband off the player's ship (wherever it is held, fitted upgrades included); returns what was taken. */
export function seizeContraband(sim: Sim): ItemQty[] {
  const taken = contrabandAboard(sim);
  const ids = new Set(taken.map((l) => l.item));
  withHeld(sim, (held) => {
    for (const h of held) if (ids.has(h.item)) h.remove();
    // A fit job still waiting to fetch a seized upgrade (it lay in storage) has nothing to fit: call it off with the rest.
    for (const id of sim.world.query(JobC)) {
      const item = sim.world.get(id, JobC)?.kind === 'fit' ? sim.world.get(id, JobC)?.fit?.item : null;
      if (item && ids.has(item)) cancelFit(sim, id);
    }
  });
  return taken;
}

/** Make a scan encounter carry its contraband finding, when the scanner enforces the law and the player carries any. */
export function scanFor(sim: Sim, e: Encounter): void {
  if (e.kind !== 'scan' || !enforces(sim, e.faction)) return;
  const lines = contrabandAboard(sim);
  if (!lines.length) return;
  const value = contrabandValue(sim, lines);
  e.scan = { value, ...scanPrices(value) };
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

/** Trade waits on a scan: a patrol's scan that found contraband waits for an answer, or an inspection is coming aboard, searching or waiting. */
export const scanPending = (sim: Sim): boolean => sim.galaxy.encounters.some((e) => e.kind === 'scan' && !!e.scan) || (liveInspection(sim)?.[1].phase ?? 'leave') !== 'leave';

const hit = (sim: Sim, faction: string): void => {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) - SCAN_STANDING_HIT;
};

/**
 * `galaxy.respond` on a scan that found contraband (the caller finishes the encounter with the outcome). 'surrender': the contraband is taken, the fine is
 * paid (all the credits there are, if short) and standing with the scanner falls. 'bribe': refused without the credits; it is paid and the player keeps the goods.
 */
export function settleScan(sim: Sim, e: Encounter, choice: 'surrender' | 'bribe'): { outcome: 'confiscated' | 'bribed'; cost: number } | 'cantAfford' {
  const scan = e.scan as NonNullable<Encounter['scan']>;
  if (choice === 'bribe') {
    if (sim.trade.credits < scan.bribe) return 'cantAfford';
    sim.trade.credits -= scan.bribe;
    sim.events.emit({ type: 'scan.settled', id: e.id, faction: e.faction, outcome: 'bribed', cost: scan.bribe });
    return { outcome: 'bribed', cost: scan.bribe };
  }
  seizeContraband(sim);
  const paid = Math.min(scan.fine, sim.trade.credits);
  sim.trade.credits -= paid;
  hit(sim, e.faction);
  sim.events.emit({ type: 'scan.settled', id: e.id, faction: e.faction, outcome: 'confiscated', cost: paid });
  return { outcome: 'confiscated', cost: paid };
}
