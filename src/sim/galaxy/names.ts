import type { FactionFleetDef } from './defs';
import { hash32 } from './hash';
import type { Fleet } from './types';

/**
 * Ship names: a faction's `prefix` (optional), one of its `first` names and optionally one of its `second` names ("CNS Valiant", "Rust Jackal",
 * "Unit Reap 31"). `h` is a hash of the ship's roster key. A name already in `used` is re-drawn a few times, then gets a number
 * ("CNS Valiant 2"), so names stay unique among living ships; the winner is added to `used`.
 */
export function shipNameFor(def: FactionFleetDef['names'], key: readonly number[], used: Set<string>): string {
  const pick = <T>(list: readonly T[], salt: number, extra: number): T => list[hash32(...key, salt, extra) % list.length] as T;
  const make = (extra: number): string =>
    [def.prefix, pick(def.first, 1, extra), def.second?.length ? pick(def.second, 2, extra) : undefined].filter(Boolean).join(' ');
  let name = make(0);
  for (let t = 1; used.has(name) && t < 8; t++) name = make(t);
  for (let n = 2; used.has(name); n++) name = `${make(0)} ${n}`;
  used.add(name);
  return name;
}

/** The fleet's display name: its lead ship's name, and the ship count when there are several ("CNS Valiant (2 ships)"). */
export function fleetName(f: Pick<Fleet, 'ships' | 'role'>): string {
  const first = f.ships[0]?.name ?? f.role;
  return f.ships.length > 1 ? `${first} (${f.ships.length} ships)` : first;
}
