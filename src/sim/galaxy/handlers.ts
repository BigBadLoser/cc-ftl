import { CombatC } from '../combat/components';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { playerShipInfo } from './arrivals';
import { chunkOfId } from './generator';
import { ensureChunk, ensureChunkOf, galaxyIndex } from './state';
import { drop, jump, teleport } from './hyperspace';
import { discover } from './travel';
import { resolveEncounter } from './encounters';

type GalaxyCommandType = Extract<Command['type'], `galaxy.${string}` | 'debug.galaxyReveal' | 'debug.galaxyTeleport' | 'debug.chargeFtl'>;
type Handler<T extends GalaxyCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

export const galaxyHandlers: { [T in GalaxyCommandType]: Handler<T> } = {
  'galaxy.jump': (sim, cmd) => void jump(sim, cmd.ship, cmd.route, cmd.withDocked),
  'galaxy.drop': (sim) => void drop(sim),
  'galaxy.dismissEncounter': (sim, cmd) => {
    if (!resolveEncounter(sim, cmd.id, 'dismissed')) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noEncounter' });
  },
  'debug.galaxyReveal': (sim, cmd) => {
    const r = Math.max(0, Math.min(12, Math.floor(cmd.radius)));
    const [cx, cy] = (chunkOfId(sim.galaxy.current) ?? '0,0').split(',').map(Number) as [number, number];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) ensureChunk(sim, cx + dx, cy + dy);
    for (const id of galaxyIndex(sim.galaxy).nodes.keys()) sim.galaxy.discovered[id] ??= sim.tick;
    sim.galaxy.rev++;
    discover(sim);
  },
  'debug.galaxyTeleport': (sim, cmd) => {
    ensureChunkOf(sim, cmd.node);
    if (!galaxyIndex(sim.galaxy).nodes.has(cmd.node)) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noNode' });
    if (cmd.node !== sim.galaxy.current) teleport(sim, cmd.node);
  },
  'debug.chargeFtl': (sim) => {
    const me = playerShipInfo(sim);
    const combat = me ? sim.world.get(me.id, CombatC) : undefined;
    if (combat) combat.ftl = FTL_CHARGE_SEC;
  },
};
