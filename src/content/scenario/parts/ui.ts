import { playerCrewPackedOk } from '../../../sim/story/world';
import { definePart, type UiRequest } from '../types';

export interface UiSpec {
  speed?: 0 | 1 | 2 | 3;
  /** Select this player crew member (by order) with the camera on them. */
  select?: number;
  tool?: Extract<UiRequest, { kind: 'tool' }>['tool'];
}
declare module '../types' { interface ScenarioSpec { ui?: UiSpec } }

/** What the app should do once the scene is up: speed, selection, tool. Data only; tests and the profiler ignore it. */
export default definePart<'ui'>({
  key: 'ui',
  after: ['hooks'],
  apply(ctx, u) {
    if (u.speed !== undefined) ctx.ui({ kind: 'speed', speed: u.speed });
    if (u.tool) ctx.ui({ kind: 'tool', tool: u.tool });
    const crew = u.select === undefined ? undefined : playerCrewPackedOk(ctx.sim)[u.select];
    if (crew !== undefined) ctx.ui({ kind: 'select', crew, focus: true });
  },
});
