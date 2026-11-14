import { shipIdOf } from '../regions';

import { ShipC } from '../combat/components';
import type { Command } from '../commands';
import { CrewC, PositionC } from '../crew/components';
import { AllegianceC, SurrenderedC } from '../fight/components';
import { surrender } from '../fight/surrender';
import type { Sim } from '../sim';
import { capturePrize, imprison, scuttle } from './prize';
import { setSealOrder } from '../stasis/order';
import { releasePrisoner, settleYielded } from './settle';

type CaptureCommandType = Extract<Command['type'], 'ship.scuttle' | 'ship.settle' | 'prisoner.release' | 'prisoner.seal' | 'debug.surrender' | 'debug.capture' | 'debug.imprison'>;

export const captureHandlers: { [T in CaptureCommandType]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'ship.scuttle': (sim, cmd) => {
    const err = scuttle(sim, cmd.ship);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
  'ship.settle': (sim, cmd) => {
    const err = settleYielded(sim, cmd.ship, cmd.choice);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
  'prisoner.release': (sim, cmd) => {
    const err = releasePrisoner(sim, cmd.crew);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
  'prisoner.seal': (sim, cmd) => {
    const err = setSealOrder(sim, cmd.crew, cmd.on);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
  'debug.surrender': (sim, cmd) => {
    for (const id of [...sim.world.query(CrewC, PositionC)]) {
      if (shipIdOf(sim, sim.world.get(id, PositionC)) === cmd.ship && sim.world.get(id, AllegianceC)?.faction !== 'player' && !sim.world.has(id, SurrenderedC)) surrender(sim, id);
    }
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
  'debug.imprison': (sim, cmd) => {
    const pos = sim.world.get(cmd.crew, PositionC);
    if (!pos || !sim.world.has(cmd.crew, CrewC) || sim.world.get(cmd.crew, AllegianceC)?.faction === 'player') return;
    imprison(sim, cmd.crew, shipIdOf(sim, pos));
  },
};
