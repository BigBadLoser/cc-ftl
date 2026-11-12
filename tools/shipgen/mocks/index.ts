/** The station skeleton mocks, in sheet order. */
import type { GenResult } from '../../../src/sim';
import { coarseTest, latticeTest } from './coarseTest';
import { farming } from './farming';
import { mining } from './mining';
import { tradingA } from './tradingA';
import { tradingB } from './tradingB';

export const MOCKS: { name: string; title: string; make: () => GenResult }[] = [
  { name: 'tradingA', title: 'trading A harbour wheel', make: tradingA },
  { name: 'tradingB', title: 'trading B faceted bazaar', make: tradingB },
  { name: 'farming', title: 'farming greenhouse hub', make: farming },
  { name: 'mining', title: 'mining ore spine', make: mining },
  { name: 'coarse1', title: 'plain circle, 44 equal-angle rooms', make: () => coarseTest(1) },
  { name: 'facet16', title: 'faceted 16-gon, 44 equal-angle rooms', make: () => coarseTest(1, 44, 16) },
  { name: 'coarse3', title: 'coarse 3-tile steps, 44 equal-angle rooms', make: () => coarseTest(3) },
  { name: 'lattice4', title: 'lattice 4 circle, one room a strip', make: () => latticeTest(4, 9) },
  { name: 'lattice3', title: 'lattice 3 circle, one room a strip', make: () => latticeTest(3, 12, 3) },
  { name: 'lattice3x16', title: 'lattice 3, 16-gon outline, one room a strip', make: () => latticeTest(3, 12, 3, 16) },
  { name: 'lattice4s', title: 'lattice 4 circle, diagonal corner cells kept', make: () => latticeTest(4, 9, 2, 0, true) },
  { name: 'lattice4b', title: 'lattice 4 circle, radius 9.5 cells, corner cells kept', make: () => latticeTest(4, 9.5, 2, 0, true) },
  { name: 'lattice3s', title: 'lattice 3 circle, diagonal stubs kept', make: () => latticeTest(3, 12, 3, 0, true) },
  { name: 'lattice3d2', title: 'lattice 3 circle, band 2 cells deep', make: () => latticeTest(3, 12, 2, 0, true) },
];
