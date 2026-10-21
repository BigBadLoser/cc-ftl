import { defineComponent } from '../ecs';

/** Side of a container's footprint that is clamped to its frame (rotation already applied: world sides). */
export type ClampSide = 'n' | 'e' | 's' | 'w';

/**
 * A sealed cargo container: tags the entity, which keeps its id for life. While clamped it is a module (ModuleC with a
 * `container` def, StorageC with its stock) standing on Beam tiles of its ship. Detached, the same entity drops ModuleC
 * and gets a BodyC: a free, inert body drifting at (vx, vy) tiles per second and turning at `spin` rad/s, its stock
 * still in StorageC. Pick-up, towing and cutting a container open come later.
 */
export interface Container {
  /** Module def id (art and footprint: `container.<W>x<H>`). */
  def: string;
  /** Quarter turns of the footprint, kept for the body's art once ModuleC is gone. */
  rot: number;
  clamp: ClampSide;
  state: 'clamped' | 'drifting';
  /** Hit points, mirrored from the module on detach (the body keeps its damage). */
  hp: number;
  /** The ShipC it was last clamped to (0 for a container that never had one). */
  ship: number;
  vx: number;
  vy: number;
  spin: number;
}
export const ContainerC = defineComponent<Container>('container');
