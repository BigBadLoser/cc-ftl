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
  { name: 'coarse1', title: 'plain circle, 44 band rooms', make: () => coarseTest(1) },
  { name: 'coarse2', title: 'coarse 2-tile steps, 44 band rooms', make: () => coarseTest(2) },
  { name: 'coarse3', title: 'coarse 3-tile steps, 44 band rooms', make: () => coarseTest(3) },
  { name: 'lattice4', title: 'lattice 4, radius 9 cells, one room a strip', make: () => latticeTest(4, 9) },
  { name: 'lattice3', title: 'lattice 3, radius 12 cells, one room a strip', make: () => latticeTest(3, 12) },
];
