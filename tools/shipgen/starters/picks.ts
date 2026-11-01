import { lancerShip } from '../../../src/content/ships/lancer';
import { prospectorShip } from '../../../src/content/ships/prospector';
import { starterShip } from '../../../src/content/ships/starter';
import { wayfarerShip } from '../../../src/content/ships/wayfarer';
import type { Variant } from '../templates';

/** The shipped starters side by side (and the old starter for scale). */
export const variants: Variant[] = [
  { name: 'STARTER (OLD)', template: starterShip },
  { name: 'WAYFARER', template: wayfarerShip },
  { name: 'PROSPECTOR', template: prospectorShip },
  { name: 'LANCER', template: lancerShip },
];
