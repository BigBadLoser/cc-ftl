import { CombatC } from '../combat/components';
import type { Command } from '../commands';
import { routeEdges } from '../galaxy/hyperspace';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { hullLoad } from './capacity';
import { ftlBlocker } from './status';

type FtlCommandType = Extract<Command['type'], `ftl.${string}`>;
type Handler<T extends FtlCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });

export const ftlHandlers: { [T in FtlCommandType]: Handler<T> } = {
  /** Post the helm job: the best free crew member sits at the helm and the drive charges while it is manned. */
  'ftl.charge': (sim, cmd) => {
    const combat = sim.world.get(cmd.ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    const blocked = ftlBlocker(sim, cmd.ship);
    if (blocked) return reject(sim, cmd.type, blocked);
    if (cmd.jump && !routeEdges(sim, [sim.galaxy.current, ...cmd.jump])) return reject(sim, cmd.type, 'noRoute');
    if (!cmd.jump && combat.ftl + 1e-9 >= FTL_CHARGE_SEC) return reject(sim, cmd.type, 'alreadyCharged');
    if (cmd.jump && !cmd.overcharge && hullLoad(sim, cmd.ship).over > 0) return reject(sim, cmd.type, 'overweight');
    combat.ftlOrder = { jump: cmd.jump ? [...cmd.jump] : null, ...(cmd.withDocked?.length ? { withDocked: [...cmd.withDocked] } : {}), ...(cmd.jump && cmd.overcharge ? { overcharge: true as const } : {}) };
  },
  /** Drop the charge order (and any queued jump); the pilot goes back to normal work. The charge already stored is kept. */
  'ftl.cancelCharge': (sim, cmd) => {
    const combat = sim.world.get(cmd.ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    combat.ftlOrder = null;
  },
};
