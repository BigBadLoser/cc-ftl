import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { applyDroneArt, createDroneArtSprites, droneArtIds } from './droneArt';

/** A stub atlas holding only `ids` (the #324 sheet naming), so the lookup is tested without the art in the manifest. */
const stub = (ids: string[]) => ({
  stat: (id: string): StaticSprite | undefined => (ids.includes(id) ? { tex: Texture.EMPTY, glow: null, ax: 30, ay: 16, footprint: [1, 1] } : undefined),
});

describe('drone art lookup (#324 ids)', () => {
  it('names the sprite for each state and heading', () => {
    expect(droneArtIds('drone.repair', { down: false, working: false, docked: false }, 0, 0).body).toEqual(['drone.repair.fly.d0']);
    expect(droneArtIds('drone.medic', { down: false, working: true, docked: false }, Math.PI / 2, 0)).toEqual({
      body: ['drone.medic.work.d2.f0'], beam: 'drone.medic.work.beam.d2', shadow: 'drone.shadow',
    });
    expect(droneArtIds('drone.repair', { down: true, working: false, docked: false }, 0, 0).body).toEqual(['drone.repair.inert.d0']);
    expect(droneArtIds('drone.repair', { down: false, working: false, docked: true }, 0, 0).body).toEqual(['drone.repair.docked.d0', 'drone.repair.docked.d1']);
  });

  it('uses the art when the manifest has it, and reports false (placeholder) when it does not', () => {
    const spr = createDroneArtSprites(new Container());
    const ids = droneArtIds('drone.repair', { down: false, working: false, docked: true }, 0, 0);
    expect(applyDroneArt(stub([]), spr, ids, 20)).toBe(false);
    expect(spr.body.visible).toBe(false);
    expect(applyDroneArt(stub(['drone.repair.docked.d1', 'drone.shadow']), spr, ids, 20)).toBe(true);
    expect(spr.body.visible).toBe(true);
    expect(spr.body.position.y).toBe(-16 - 20);
    expect(spr.shadow.visible).toBe(true);
  });
});
