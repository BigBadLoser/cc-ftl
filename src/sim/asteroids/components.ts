import { defineComponent } from '../ecs';
import type { Rect } from '../grid';
import type { AsteroidKind } from './types';

/**
 * An asteroid region: a big rock body or a whole field of small rocks. Its rock tiles carry this entity's id in the `ship` owner
 * layer (the layer holds the owning region, ship or asteroid), but it has no `ShipC`, so `regions(sim)`, the field systems,
 * combat, AI and capture never see it. It never moves: a jump archives it with its node. Sector tiles.
 */
export interface Asteroid {
  kind: AsteroidKind;
  /** Generator seed (the tiles themselves are saved in the sector grid). */
  seed: number;
  /** Has a hollowable core (big asteroids): CoreRock tiles inside `core`. */
  hollow: boolean;
  /** Bounding box of every rock tile. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Bboxes of the separate rock bodies (one for a big asteroid); the gap rule is checked against these, not the bbox. */
  parts: Rect[];
  /** Bbox of the hollowable core, or null. */
  core: Rect | null;
}
export const AsteroidC = defineComponent<Asteroid>('asteroid');
