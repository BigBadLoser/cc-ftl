import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC } from '../sim/crew/components';
import type { SimEvent } from '../sim/events';
import { PrisonerC } from '../sim/fight/components';
import { homeShip } from '../sim/combat/shipQuery';
import { newGame } from '../sim/newGame';
import { createAlerts } from './alerts';
import { createEventLog } from './eventLog';
import type { UiAlert, UiLogEntry } from '../ui/api';

/** The prisoner lines are the player's own business: a prisoner an NPC captor holds (`Prisoner.holder`, #615) posts no log line and no alert. */
describe('prisoner log lines by holder', () => {
  it('posts nothing for an NPC-held prisoner, and still logs a player-held one', () => {
    const sim = newGame(3, content);
    const [mine, theirs] = sim.world.query(CrewC).slice(0, 2) as [number, number];
    sim.world.add(mine, PrisonerC, { tick: 0 });
    sim.world.add(theirs, PrisonerC, { tick: 0, holder: 'raiders' });
    const ship = homeShip(sim);
    const log = createEventLog(sim);
    const alerts = createAlerts(sim);
    let lines: UiLogEntry[] = [];
    let raised: UiAlert[] = [];
    log.list.subscribe((l) => (lines = l));
    alerts.list.subscribe((l) => (raised = l));
    const feed = (crew: number): void => {
      const events: SimEvent[] = [
        { type: 'crew.imprisoned', crew, ship },
        { type: 'stasis.sealed', crew, by: crew, ship },
        { type: 'stasis.stowed', crew, wheel: 0, ship },
      ];
      log.onEvents(events);
      alerts.onEvents(events);
      // A thaw comes after the prisoner is gone (thawPrisoner removes PrisonerC first), so it names its holder.
      sim.world.remove(crew, PrisonerC);
      const thaw: SimEvent[] = [{ type: 'stasis.thawed', crew, ship, x: 1, y: 1, holder: crew === mine ? 'player' : 'raiders' }];
      log.onEvents(thaw);
      alerts.onEvents(thaw);
    };
    feed(theirs);
    expect(lines).toEqual([]);
    expect(raised).toEqual([]);
    feed(mine);
    expect(lines.length).toBe(4);
  });
});
