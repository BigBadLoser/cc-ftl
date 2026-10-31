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
  const open = ctx.goals?.goals.some((g) => (g.id === 'goal.first_trade' || g.id === 'goal.take_job') && !g.done);
  return !!open && !ctx.combat.inCombat && stationOf(ctx) !== null && !ctx.trade.partners.some((p) => p.station && p.hail !== 'none');
};
const hailed = (ctx: LessonCtx) => ctx.trade.partners.some((p) => p.station && p.hail !== 'none');

/** The first station visit: select a station, hail it, glance at what it offers. */
export const hailLesson = {
  id: 'lesson.hail',
  title: 'Trade',
  speaker: 'speaker.marguerite',
  trigger: when(firstContact),
  delay: 1500,
  // A fight makes it moot (the combat lesson owns the screen).
  while: when((ctx) => !ctx.combat.inCombat),
  steps: [
    {
      title: 'Find the station',
      say: 'Credits do not earn themselves. Find a station.',
      keys: ['Click the station, or its edge marker if it is off screen.'],
      target: shipTarget(stationOf),
      advance: when((ctx) => ctx.selectedShip !== null && ctx.selectedShip === stationOf(ctx)),
    },
    {
      title: 'Hail it',
      say: 'Always say hello first. It costs nothing.',
      keys: ['Press **Hail station** in the selection panel.'],
      target: uiTarget('station.hail'),
      advance: anyOf(onCommand('trade.hail', (c, ctx) => c.ship === stationOf(ctx)), when(hailed)),
    },
    {
      title: 'Trade and jobs',
      say: 'Count everything twice.',
      keys: ['**Trade** buys and sells goods.', '**Jobs** lists contracts to accept.', '**Crew** is for hire.'],
      target: uiTarget('station.tabs'),
      advance: 'gotIt',
    },
  ],
} satisfies LessonDef;
