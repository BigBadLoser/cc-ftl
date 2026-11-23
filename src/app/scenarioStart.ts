import { buildScenario, parseScenarioUrl, type Built, type ScenarioUrl, type UiRequest } from '../content/scenario';
import { ShipC, homeShip, type Sim } from '../sim';
import { enableOpsPreview } from './opsPreview';

/** The `?scenario=` start named in the URL, if any (the starter hull it wants is read before the game is made). */
export const scenarioUrl = (search: string): ScenarioUrl | null => parseScenarioUrl(search);

/**
 * Build the URL's scenario on the running game, before the first frame: the scene is finished (its setup ticks already run) and the game opens on it. What it
 * asks of the app (speed, selection, tool, camera) is in `requests`, applied with `applyScenarioUi`.
 */
export function startUrlScenario(sim: Sim, url: ScenarioUrl): Built {
  const built = buildScenario(url.name, {
    sim, params: url.params, overrides: url.overrides, extraHooks: url.extraHooks, ...(url.seed === null ? {} : { seed: url.seed }),
  });
  for (let i = 0; i < url.ticks; i++) {
    sim.step();
    built.afterTick();
    built.onEvents(sim.events.drain());
  }
  return built;
}

/** What the app can do for a scenario: the pieces of the controller and renderer a request needs. */
export interface ScenarioUiTargets {
  setSpeed(speed: 0 | 1 | 2 | 3): void;
  selectCrew(id: number | null, focus?: boolean): void;
  setTool(tool: Extract<UiRequest, { kind: 'tool' }>['tool']): void;
  /** Frame the player's ship with this one (the station a scenario spawned). */
  frameShips(ids: number[]): void;
}

/** Apply the scenario's build-time requests now and later ones as they come. */
export function applyScenarioUi(sim: Sim, built: Built, t: ScenarioUiTargets): void {
  const apply = (req: UiRequest): void => {
    if (req.kind === 'speed') t.setSpeed(req.speed);
    else if (req.kind === 'select') t.selectCrew(req.crew, req.focus);
    else if (req.kind === 'tool') t.setTool(req.tool);
    else if (req.kind === 'preview') enableOpsPreview();
    else if (req.kind === 'frame') {
      const home = homeShip(sim);
      const station = sim.world.query(ShipC).find((i) => i !== home && sim.world.get(i, ShipC)?.immobile);
      t.frameShips(station === undefined ? [home] : [home, station]);
    }
  };
  for (const req of built.requests) apply(req);
  built.requests.length = 0;
  built.listen(apply);
}
