const ROMAN = ['I', 'II', 'III', 'IV'];

/**
 * Display names for a ship's weapons, in order: a name that several weapons share gets a numeral by their order
 * ("Burst laser I", "Burst laser II"), a unique name stays as it is.
 */
export function weaponLabels(weapons: readonly { name: string }[]): string[] {
  return weapons.map((w, i) => {
    const same = weapons.filter((o) => o.name === w.name);
    return same.length > 1 ? `${w.name} ${ROMAN[same.indexOf(w)] ?? i + 1}` : w.name;
  });
}
