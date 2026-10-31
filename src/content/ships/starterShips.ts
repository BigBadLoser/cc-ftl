import type { ShipTemplate } from '../../sim';
import { lancerShip, lancerShipId } from './lancer';
import { prospectorShip, prospectorShipId } from './prospector';
import { wayfarerShip, wayfarerShipId } from './wayfarer';

/** A ship the new-game picker offers: its template id (the key in `content.ships`), name, a one-line blurb and the template itself. */
export interface StarterShip {
  id: string;
  name: string;
  blurb: string;
  template: ShipTemplate;
}

export const starterShips: StarterShip[] = [
  { id: wayfarerShipId, name: 'Wayfarer', blurb: 'Balanced. A long-hauler with a gun, a shield, a shuttle and a lounge. Four crew, one of each role.', template: wayfarerShip },
  { id: prospectorShipId, name: 'Prospector', blurb: 'Hauler and miner. A big hold, an ore refinery, a mining pod and one light gun. Three crew.', template: prospectorShip },
  { id: lancerShipId, name: 'Lancer', blurb: 'Fighter. Three weapons forward, a Mk II shield and a small hold. Four crew, two of them gunners.', template: lancerShip },
];
