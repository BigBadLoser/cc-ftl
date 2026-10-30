/** What a right-click can mean at one spot, and how the choices are offered. */

export type OrderId = 'attack' | 'man' | 'board' | 'sabotage' | 'walk';

/** What is under the cursor, as the controller found it. */
export interface OrderProbe {
  /** A hostile crew member or egg sac. */
  foe?: { id: number; name: string };
  /** A console of the player's ship. */
  station?: { module: number; name: string };
  /** One of the player's shuttles (or its docked airlock) that crew can climb into. */
  shuttle?: { vehicle: number; name: string };
  /** A working module of a hostile ship that boarders stand on. */
  sabotage?: { module: number; name: string };
  /** A floor tile the selection could walk to. */
  walk?: boolean;
}

export interface OrderChoice {
  id: OrderId;
  label: string;
}

/** The commands this spot offers, most specific first. Walking comes last. */
export function orderChoices(p: OrderProbe): OrderChoice[] {
  const out: OrderChoice[] = [];
  if (p.foe) out.push({ id: 'attack', label: `Attack ${p.foe.name}` });
  if (p.station) out.push({ id: 'man', label: `Man ${p.station.name}` });
  if (p.shuttle) out.push({ id: 'board', label: `Board ${p.shuttle.name}` });
  // Alone, sabotage is the default right-click on an enemy module (it runs at once, walking onto a module is not a choice); with a foe under the cursor it stays a menu entry.
  if (p.sabotage) out.push({ id: 'sabotage', label: `Sabotage ${p.sabotage.name}` });
  if (p.walk && !(p.sabotage && !p.foe)) out.push({ id: 'walk', label: 'Walk here' });
  return out;
}

/** One choice runs at once; two or more open the menu; none does nothing. A lone target (an enemy on no tile, say) is the choice. */
export function needsMenu(choices: readonly OrderChoice[]): boolean {
  return choices.length > 1;
}
