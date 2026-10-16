import type { ShipTemplate } from '../../sim';

/** Engine at the back (left), bridge at the nose (right), corridor along the middle. */
export const starterShip = {
  name: 'Starter ship',
  rows: [
    '########..............',
    '#______#########......',
    '#______#____#__#......',
    '#______#____#__######.',
    '#______#____#__#____#.',
    '#______##D###D##_____#',
    '#______D_______D_____#',
    '#______#_______#_____#',
    '#______##D###D##_____#',
    '#______#____#__#____#.',
    '#______#____#__######.',
    '#______#____#__#......',
    '#______#########......',
    '########..............',
  ],
} satisfies ShipTemplate;

export const starterShipId = 'ship.starter';
