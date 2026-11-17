import { piratesCommands } from '../lib/pirates';
import { patrolNode } from '../lib/patrol';
import { definePreset, flag, str } from '../types';

/**
 * `?scenario=pirates[&faction=raiders][&hunt][&broke]` (#363): pirates interdict you mid-jump and hail you in the comms window. A fleet of the faction (default
 * the Scrapper Clans) waits at the next node and the ship jumps there: evade, bribe or fight. `&hunt`: hunters sent after you. `&broke`: too few credits to bribe.
 * The cartel only holds up travellers in its own space, so outside it `faction=cartel` passes you by.
 */
export default definePreset({
  doc: 'Pirates interdict the ship mid-jump and hail it.',
  params: { faction: str(), hunt: flag(), broke: flag() },
  spec: (p) => ({
    ship: { seed: 3 },
    node: { warm: 20 }, // before the first ticks the helm has no cruise figures, so the trip's evade odds sit at their floor (#367)
    steps: [{ cmds: (ctx) => piratesCommands(ctx.sim, patrolNode(ctx.sim)!, { faction: typeof p['faction'] === 'string' ? p['faction'] : 'pirates', hunt: !!p['hunt'], broke: !!p['broke'] }) }],
    ui: { speed: 1 },
  }),
});
