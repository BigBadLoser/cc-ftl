/** The station skeleton mocks, in sheet order. */
import type { GenResult } from '../../../src/sim';
import { farming } from './farming';
import { mining } from './mining';
import { tradingA } from './tradingA';
import { tradingB } from './tradingB';

export const MOCKS: { name: string; title: string; make: () => GenResult }[] = [
  { name: 'tradingA', title: 'trading A harbour wheel', make: tradingA },
  { name: 'tradingB', title: 'trading B faceted bazaar', make: tradingB },
  { name: 'farming', title: 'farming greenhouse hub', make: farming },
  { name: 'mining', title: 'mining ore spine', make: mining },
];
