/** Weapon hotkeys: Q W E R pick weapon slots 1-4. R is also the crew-draft key, so in combat it picks weapon 4 only when the ship has one; otherwise it falls through to draft. */
export const WEAPON_KEYS = 'qwer';

/** The weapon a pressed key selects, or null when the key is not a weapon key or the slot is empty (the caller then lets the key fall through). */
export function weaponForKey<T>(key: string, weapons: readonly T[]): T | null {
  const k = key.toLowerCase();
  const slot = k.length === 1 ? WEAPON_KEYS.indexOf(k) : -1;
  return slot >= 0 ? (weapons[slot] ?? null) : null;
}
