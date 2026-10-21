import { shipIdOf } from '../regions';

import { ShipC } from '../combat/components';
import type { Command } from '../commands';
import { CrewC, PositionC } from '../crew/components';
import { AllegianceC, SurrenderedC } from '../fight/components';
import type { Sim } from '../sim';
import { capturePrize, scuttle } from './prize';

type CaptureCommandType = Extract<Command['type'], 'ship.scuttle' | 'debug.capture'>;

export const captureHandlers: { [T in CaptureCommandType]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'ship.scuttle': (sim, cmd) => {
    const err = scuttle(sim, cmd.ship);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
  'debug.capture': (sim, cmd) => {
    const ship = sim.world.get(cmd.ship, ShipC);
    if (!ship || ship.faction === 'player' || ship.state === 'wreck') return;
    for (const id of sim.world.query(CrewC, PositionC)) {
      if (shipIdOf(sim, sim.world.get(id, PositionC)) === cmd.ship && sim.world.get(id, AllegianceC)?.faction === ship.faction && !sim.world.has(id, SurrenderedC)) {
        sim.world.add(id, SurrenderedC, { tick: sim.tick });
      }
    }
    capturePrize(sim, cmd.ship);
  },
};
