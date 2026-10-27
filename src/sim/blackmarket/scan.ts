import { ItemStackC, StorageC } from '../items/components';
import { storageTake } from '../items/storage';
import { takeFromStack } from '../items/stacks';
import { repKey } from '../galaxy/standing';
import { nodeOf, nodeState } from '../galaxy/state';
import { ENCOUNTER_TTL } from '../galaxy/tuning';
import type { Encounter } from '../galaxy/types';
import { shipIdAt } from '../regions';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { playerShips, playerStorages } from '../story/world';
import { contrabandItems } from './services';
import { SCAN_BRIBE_MIN, SCAN_BRIBE_SHARE, SCAN_COOLDOWN, SCAN_FINE_MIN, SCAN_FINE_SHARE, SCAN_STANDING_HIT } from './tuning';

/**
 * Scans for contraband. Navy and corporation stations scan the player when they open trade with a station (`dockScan`, from `trade.hail`); their patrols
 * sometimes scan one they cross (encounters.ts calls `scanFor`). Both make a `scan` Encounter. One that finds contraband aboard carries `Encounter.scan`
 * (what the goods are worth, the fine and the bribe) and waits for `galaxy.respond`: 'surrender' (the goods are taken, the fine is paid and the faction
 * thinks less of the player) or 'bribe' (the bribe is paid and nothing else happens). A scan that finds nothing is an ordinary 'acknowledge' scan.
 * Contraband is counted in the player's storage and loose stacks, or in the ship's packet while it is in hyperspace.
 */

/** Government and corporation factions enforce the law at their stations and with their patrols. */
export const LAW_ENFORCERS: readonly string[] = ['government', 'corporation'];

export const enforces = (sim: Sim, faction: string): boolean => LAW_ENFORCERS.includes(sim.content.galaxy?.factions[faction]?.kind ?? '');

type PacketStacks = { stacks?: ItemQty[] } | undefined;

/** The contraband the player carries, by item id ascending. */
export function contrabandAboard(sim: Sim): ItemQty[] {
  const ids = contrabandItems(sim);
  if (!ids.length) return [];
  const have = new Map<string, number>();
  const add = (item: string, n: number): void => void (n > 0 && have.set(item, (have.get(item) ?? 0) + n));
  const packet = sim.sector.state === 'hyperspace' ? sim.sector.packet : null;
  if (packet) {
    for (const e of packet.entities) {
      for (const st of (e.c['storage'] as PacketStacks)?.stacks ?? []) if (ids.includes(st.item)) add(st.item, st.count);
      const loose = e.c['itemStack'] as ItemQty | undefined;
      if (loose && ids.includes(loose.item)) add(loose.item, loose.count);
    }
  } else {
    const ships = playerShips(sim);
    for (const id of playerStorages(sim)) for (const st of sim.world.get(id, StorageC)?.stacks ?? []) if (ids.includes(st.item)) add(st.item, st.count);
    for (const id of sim.world.query(ItemStackC)) {
      const s = sim.world.get(id, ItemStackC);
      if (s && ids.includes(s.item) && !s.job && ships.has(shipIdAt(sim, s.x, s.y))) add(s.item, s.count);
    }
  }
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

/** Take every unit of contraband off the player's ship; returns what was taken. */
export function seizeContraband(sim: Sim): ItemQty[] {
  const taken = contrabandAboard(sim);
  const ids = new Set(taken.map((l) => l.item));
  const packet = sim.sector.state === 'hyperspace' ? sim.sector.packet : null;
  if (packet) {
    packet.entities = packet.entities.filter((e) => {
      const loose = e.c['itemStack'] as ItemQty | undefined;
      return !(loose && ids.has(loose.item));
    });
    for (const e of packet.entities) {
      const st = (e.c['storage'] as PacketStacks)?.stacks;
      if (st) (e.c['storage'] as { stacks: ItemQty[] }).stacks = st.filter((s) => !ids.has(s.item));
    }
    return taken;
  }
  for (const l of taken) {
    let left = l.count;
    for (const id of playerStorages(sim)) left -= storageTake(sim, id, l.item, left);
    const ships = playerShips(sim);
    for (const id of [...sim.world.query(ItemStackC)]) {
      const s = sim.world.get(id, ItemStackC);
      if (left > 0 && s?.item === l.item && !s.job && ships.has(shipIdAt(sim, s.x, s.y))) left -= takeFromStack(sim, id, left);
    }
  }
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
 * A station of an enforcing faction scans the player as they open trade with it (once per SCAN_COOLDOWN turns per node). Returns true when it found
 * contraband (an encounter now waits for the player's answer).
 */
export function dockScan(sim: Sim, owner: string | undefined, name: string): boolean {
  const g = sim.galaxy;
  if (!owner || !enforces(sim, owner) || sim.sector.state !== 'active' || g.event) return false;
  const ns = nodeState(sim, g.current);
  if (ns.scanned !== undefined && g.turn - ns.scanned < SCAN_COOLDOWN) return false;
  if (g.encounters.some((x) => x.kind === 'scan' && x.scan)) return true;
  ns.scanned = g.turn;
  const e: Encounter = {
    id: g.nextFleet++, kind: 'scan', fleet: 0, faction: owner, role: 'patrol', name, ships: 1, strength: 0, danger: nodeOf(sim, g.current)?.danger ?? 0, how: 'node',
    node: g.current, turn: g.turn, expires: g.turn + ENCOUNTER_TTL.alert,
  };
  scanFor(sim, e);
  if (!e.scan) return false;
  g.encounters.push(e);
  g.rev++;
  sim.events.emit({ type: 'galaxy.encounter', id: e.id, kind: 'scan', fleet: 0, faction: owner, role: 'patrol', node: g.current });
  return true;
}

/** A scan with contraband found is waiting for an answer at the player's node. */
export const scanPending = (sim: Sim): boolean => sim.galaxy.encounters.some((e) => e.kind === 'scan' && !!e.scan);

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
