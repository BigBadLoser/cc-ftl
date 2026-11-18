import { definePreset, flag, str } from '../types';

/** A plain new game: the hull (`&template=ship.debug`), its start node populated (`&populate`) and the crew as the app rolls it (`&rolled`). The base other scenarios build on, and what tests start from when they only need the game. */
export default definePreset({
  doc: 'A plain new game on the hull you name.',
  params: { template: str(), populate: flag(), rolled: flag() },
  spec: (p) => ({
    ship: {
      ...(typeof p['template'] === 'string' ? { template: p['template'] } : {}),
      ...(p['populate'] ? { populate: true } : {}),
      ...(p['rolled'] ? { crew: 'rolled' as const } : {}),
    },
  }),
});
