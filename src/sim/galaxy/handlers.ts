import { CombatC } from '../combat/components';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { playerShipInfo } from './arrivals';
import { chunkOfId } from './generator';
import { ensureChunk, ensureChunkOf, galaxyIndex } from './state';
import { drop, jump, teleport } from './hyperspace';
import { discover } from './travel';
import { leave, respond } from './respond';
import { addNotoriety, clearNotoriety } from './heat';

type GalaxyCommandType = Extract<Command['type'], `galaxy.${string}` | 'debug.galaxyReveal' | 'debug.galaxyTeleport' | 'debug.chargeFtl' | 'debug.notoriety'>;
type Handler<T extends GalaxyCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

export const galaxyHandlers: { [T in GalaxyCommandType]: Handler<T> } = {
  'galaxy.jump': (sim, cmd) => void jump(sim, cmd.ship, cmd.route, cmd.withDocked),
  'galaxy.drop': (sim) => void drop(sim),
  'galaxy.respond': (sim, cmd) => void respond(sim, cmd.encounter, cmd.choice),
  'galaxy.leaveEvent': (sim) => void leave(sim),
  'galaxy.clearNotoriety': (sim) => void clearNotoriety(sim),
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
    if (sim.galaxy.event) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'inEvent' });
    if (cmd.node !== sim.galaxy.current) teleport(sim, cmd.node);
  },
  'debug.notoriety': (sim, cmd) => addNotoriety(sim, (Number.isFinite(cmd.value) ? cmd.value : 0) - sim.galaxy.heat.notoriety),
  'debug.chargeFtl': (sim) => {
    const me = playerShipInfo(sim);
    const combat = me ? sim.world.get(me.id, CombatC) : undefined;
    if (combat) combat.ftl = FTL_CHARGE_SEC;
  },
};
