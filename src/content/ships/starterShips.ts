import type { ShipTemplate } from '../../sim';
import { lancerShip, lancerShipId } from './lancer';
import { prospectorShip, prospectorShipId } from './prospector';
import { wayfarerShip, wayfarerShipId } from './wayfarer';

/**
 * A ship the new-game picker offers: its template id (the key in `content.ships`), its class name (the template's), the
 * hull's display name (what the player sees first), the playstyle in a word or two, a blurb and the template itself.
 */
export interface StarterShip {
  id: string;
  name: string;
  title: string;
  tagline: string;
  blurb: string;
  template: ShipTemplate;
}

export const starterShips: StarterShip[] = [
  { id: wayfarerShipId, name: 'Wayfarer', title: 'Spine Hauler', tagline: 'Balanced', blurb: 'A long-hauler with a gun, a shield, a shuttle and a lounge. Four crew, one of each role.', template: wayfarerShip },
  { id: prospectorShipId, name: 'Prospector', title: 'Claw', tagline: 'Hauler and miner', blurb: 'A big hold, an ore refinery, a mining pod and one light gun. Three crew.', template: prospectorShip },
  { id: lancerShipId, name: 'Lancer', title: 'Dart', tagline: 'Fighter', blurb: 'A missile in the point and a laser in each tail fin, a Mk II shield and a small magazine. Four crew, two of them gunners.', template: lancerShip },
];
