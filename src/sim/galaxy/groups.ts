import type { Sim } from '../sim';
import { nodeState } from './state';
import type { Contact } from './types';

/**
 * Groups of ships, and the one record of which groups the player provoked (#173). A ship's group is what it came with: its fleet (a node's fleets,
 * or the event grid's fleet), a story scene's ships, or else its own node contact. Provoking any ship of a group (combat/provoke.ts) records the
 * group in `galaxy.provoked`; every place that decides a side for a ship of the group reads it (`isProvoked`: `spawnContact`, so a fleet lifted
 * out and met again, a member that waited for room in the sector, or a reload all come in hostile).
 */

/** The descriptor a ship in the active sector was made from: a pocket's fleet or scene, a travelling fleet, else the node's contacts. */
export function contactOf(sim: Sim, ship: number): Contact | undefined {
  const g = sim.galaxy;
  const owns = (cs: readonly Contact[]): Contact | undefined => cs.find((c) => c.ship === ship);
  return owns(g.event?.fleet?.ships ?? []) ?? owns(g.event?.scene.ships.map((s) => s.contact) ?? []) ?? g.fleets.map((f) => owns(f.ships)).find(Boolean)
    ?? owns(nodeState(sim, g.current).contacts);
}

/** The key of the group a descriptor belongs to: `fleet:<id>`, `scene:<key>` (the open pocket's scene) or `contact:<id>`. */
export function groupKey(sim: Sim, c: Contact): string {
  const g = sim.galaxy;
  const fleet = (g.event?.fleet?.ships.includes(c) ? g.event.fleet : undefined) ?? g.fleets.find((f) => f.ships.includes(c));
  if (fleet) return `fleet:${fleet.id}`;
  if (g.event?.scene.ships.some((s) => s.contact === c)) return `scene:${g.event.scene.key}`;
  return `contact:${c.id}`;
}

/** The descriptors of this ship's group, itself included, spawned or still waiting for room. Empty for a ship with no descriptor. */
export function shipGroup(sim: Sim, ship: number): Contact[] {
  const g = sim.galaxy;
  const groups: Contact[][] = [...g.fleets.map((f) => f.ships)];
  if (g.event?.fleet) groups.push(g.event.fleet.ships);
  if (g.event) groups.push(g.event.scene.ships.map((s) => s.contact));
  const mine = groups.find((cs) => cs.some((c) => c.ship === ship));
  if (mine) return mine;
  const own = contactOf(sim, ship);
  return own ? [own] : [];
}

/** The ships of this one's group that are real in the sector, itself included. A ship with no descriptor has only itself. */
export function shipmates(sim: Sim, ship: number): number[] {
  const group = shipGroup(sim, ship);
  return group.length ? group.flatMap((c) => (c.ship === undefined ? [] : [c.ship])) : [ship];
}

/** Did the player provoke this descriptor's group? */
export const isProvoked = (sim: Sim, c: Contact): boolean => sim.galaxy.provoked.includes(groupKey(sim, c));

/** Record that the player provoked this ship's group. False for a ship with no descriptor (nothing to remember it by but the ship itself). */
export function markProvoked(sim: Sim, ship: number): boolean {
  const c = contactOf(sim, ship);
  if (!c) return false;
  const key = groupKey(sim, c);
  if (!sim.galaxy.provoked.includes(key)) sim.galaxy.provoked.push(key);
  return true;
}

/** Drop records of groups that are gone (a fleet lost, a pocket's scene left, a contact no longer anywhere). Called each galaxy turn. */
export function pruneProvoked(sim: Sim): void {
  const g = sim.galaxy;
  if (!g.provoked.length) return;
  const fleets = new Set([...g.fleets.map((f) => f.id), ...(g.event?.fleet ? [g.event.fleet.id] : [])]);
  const contacts = new Set(Object.values(g.nodes).flatMap((n) => (n.contacts ?? []).map((c) => c.id)));
  g.provoked = g.provoked.filter((k) => {
    const at = k.indexOf(':');
    const kind = k.slice(0, at);
    const id = k.slice(at + 1);
    if (kind === 'fleet') return fleets.has(Number(id));
    if (kind === 'scene') return g.event?.scene.key === id;
    return contacts.has(Number(id));
  });
}
