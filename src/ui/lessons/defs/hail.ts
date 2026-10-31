import { anyOf, onCommand, when } from '../conditions';
import { shipTarget, uiTarget } from '../targets';
import type { LessonCtx, LessonDef } from '../types';

/** The station to walk the player to: the nearest one in the node. */
const stationOf = (ctx: LessonCtx): number | null => {
  const stations = ctx.trade.partners.filter((p) => p.station);
  return stations.reduce<(typeof stations)[number] | null>((best, p) => (!best || p.distance < best.distance ? p : best), null)?.id ?? null;
};
/** The first act's trade goals are still open and the player has not hailed any station yet. */
const firstContact = (ctx: LessonCtx) => {
  return tradeGoalsOpen(ctx) && !ctx.combat.inCombat && stationOf(ctx) !== null && !ctx.trade.partners.some((p) => p.station && p.hail !== 'none');
};
const tradeGoalsOpen = (ctx: LessonCtx) => !!ctx.goals?.goals.some((g) => (g.id === 'goal.first_trade' || g.id === 'goal.take_job') && !g.done);
const hailed = (ctx: LessonCtx) => ctx.trade.partners.some((p) => p.station && p.hail !== 'none');

/** The first station visit: select a station, hail it, glance at what it offers. */
export const hailLesson = {
  id: 'lesson.hail',
  title: 'Trade',
  speaker: 'speaker.marguerite',
  trigger: when(firstContact),
  delay: 1500,
  // A fight makes it moot (the combat lesson owns the screen), and so does finishing both trade goals.
  while: when((ctx) => !ctx.combat.inCombat && tradeGoalsOpen(ctx)),
  steps: [
    {
      title: 'Find the station',
      say: 'Credits do not earn themselves. Find a station.',
      keys: ['Click the station to select it.', 'Off screen? Click its marker on the screen edge instead.', 'Stations are where you trade, take contracts and hire crew.'],
      target: shipTarget(stationOf),
      advance: when((ctx) => ctx.selectedShip !== null && ctx.selectedShip === stationOf(ctx)),
    },
    {
      title: 'Hail it',
      say: 'Always say hello first. It costs nothing.',
      keys: ['Press **Hail station** in the selection panel.', 'Hailing opens the station\'s own panel.'],
      target: uiTarget('station.hail'),
      // Deselected the station: back to pointing at it.
      back: when((ctx) => ctx.selectedShip !== stationOf(ctx)),
      advance: anyOf(onCommand('trade.hail', (c, ctx) => c.ship === stationOf(ctx)), when(hailed)),
    },
    {
      title: 'Trade and jobs',
      say: 'Count everything twice.',
      keys: [
        '**Trade**: buy and sell goods. Prices differ by station, and your shuttle ferries them over. Fuel is here too: **Refuel** tops you up.',
        '**Jobs**: contracts such as deliveries and bounties. **Accept** adds one to your jobs list; it pays on completion.',
        '**Crew**: people for hire. Your shuttle fetches them.',
        '**Shipyard** (some stations): a yard builds the hull plan you drew.',
      ],
      target: uiTarget('station.tabs'),
      advance: 'gotIt',
    },
  ],
} satisfies LessonDef;
