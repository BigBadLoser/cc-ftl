import { describe, expect, it } from 'vitest';
import { homeShip } from '../sim/combat/shipQuery';
import { JobC } from '../sim/crew/components';
import { newGame } from '../sim/newGame';
import { shipGrid } from '../sim/regions';
import { content } from '../content';
import type { Renderer } from '../render/scene';
import { createStore } from './store';
import type { Bridge } from './bridge';
import { createController } from './controller';

describe('floor paint tool', () => {
  it('a floor drag in empty space is shown red with the reason and toasts on release, placing nothing', () => {
    const sim = newGame(1, content);
    const g = shipGrid(sim, homeShip(sim))!;
    const far = { x: g.x0 + g.width + 30, y: g.y0 + g.height + 30 };
    let valid: boolean | undefined;
    const renderer = { setAreas: () => undefined, setWorldGrid: () => undefined, setCutLine: () => undefined, setPreview: (_t: unknown, ok?: boolean) => (valid = ok), setHover: () => undefined, setSites: () => undefined, setModuleGhost: () => undefined, setWindowGhost: () => undefined, screenOf: () => ({ x: 5, y: 6 }) } as unknown as Renderer;
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c = createController(sim, bridge);
    let toast: string | null = null;
    let hint: { text: string; ok?: boolean } | null = null;
    c.toast.subscribe((m) => (toast = m));
    c.placeHint.subscribe((h) => (hint = h));
    const h = c.attach(renderer);
    c.setTool({ tool: 'build', build: 'floor' });
    h.onPaint('start', far);
    h.onPaint('move', { x: far.x + 3, y: far.y + 2 });
    expect(valid).toBe(false);
    expect(hint).toMatchObject({ text: 'Floor must join the hull', ok: false });
    h.onPaint('end', { x: far.x + 3, y: far.y + 2 });
    sim.step();
    expect(toast).toBe('Floor must join the hull');
    expect([...sim.world.query(JobC)]).toHaveLength(0);
  });

  it('switching from a module to the Window tool clears the module ghost', () => {
    const sim = newGame(1, content);
    const g = shipGrid(sim, homeShip(sim))!;
    let moduleGhost: unknown = 'unset';
    const renderer = { setAreas: () => undefined, setWorldGrid: () => undefined, setCutLine: () => undefined, setPreview: () => undefined, setHover: () => undefined, setSites: () => undefined, setModuleGhost: (m: unknown) => (moduleGhost = m), setWindowGhost: () => undefined, screenOf: () => ({ x: 5, y: 6 }) } as unknown as Renderer;
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c = createController(sim, bridge);
    const h = c.attach(renderer);
    const at = { x: g.x0 + 2, y: g.y0 + 2 };
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.fabricator' });
    h.onHover(at);
    expect(moduleGhost).not.toBeNull();
    c.setTool({ tool: 'build', build: 'window' });
    h.onHover({ x: at.x + 1, y: at.y });
    expect(moduleGhost).toBeNull();
  });
});
