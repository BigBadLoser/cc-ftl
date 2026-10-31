import { starterShipId } from './ships/starter';

/** A starter ship the new-game screen offers: a playstyle pitch over a ship template (`ship` is a `content.ships` id). */
export interface StarterDef {
  id: string;
  name: string;
  /** One line on the card: the playstyle. */
  tagline: string;
  blurb: string;
  ship: string;
}

/** Placeholders: until the three starter ships exist (#238), every entry flies the one real starter. */
export const starters = [
  { id: 'starter.wayfarer', name: 'Wayfarer', tagline: 'Balanced', blurb: 'A little of everything: steady guns, a decent hold and room to grow in any direction.', ship: starterShipId },
  { id: 'starter.prospector', name: 'Prospector', tagline: 'Hauler and miner', blurb: 'Built for rocks and cargo. Rich in mining rigs and storage, thin on weapons.', ship: starterShipId },
  { id: 'starter.lancer', name: 'Lancer', tagline: 'Fighter', blurb: 'Heavy on weapons and shields. Picks fights early and pays for it in hold space.', ship: starterShipId },
] as const satisfies readonly StarterDef[];
