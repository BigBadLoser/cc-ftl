import { OrthographicCamera, Plane, Ray, Vector2, Vector3 } from 'three';

/** Isometric camera rig: fixed yaw 45 deg / pitch 35.26 deg, free target and zoom. */
const PITCH = Math.atan(1 / Math.SQRT2);
const DIR = new Vector3(Math.cos(PITCH) * Math.SQRT1_2, Math.sin(PITCH), Math.cos(PITCH) * Math.SQRT1_2);
/** Screen-right and screen-up (ground projection) directions on the ground plane. */
const RIGHT = new Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const FWD = new Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2);
const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const MIN_H = 5;
const MAX_H = 300;

export interface CameraRig {
  camera: OrthographicCamera;
  readonly target: Vector3;
  viewHeight(): number;
  resize(w: number, h: number): void;
  setView(target: Vector3, viewHeight: number): void;
  pan(dxPx: number, dyPx: number): void;
  zoomAt(factor: number, sx: number, sy: number): void;
  /** World point on Y = 0 under a screen position (canvas-relative px), or null. */
  groundAt(sx: number, sy: number): Vector3 | null;
}

export function createCameraRig(): CameraRig {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 600);
  const target = new Vector3();
  let viewH = 12;
  let w = 1;
  let h = 1;

  function place(): void {
    camera.position.copy(target).addScaledVector(DIR, 300);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function proj(): void {
    const a = w / h;
    camera.left = (-viewH * a) / 2;
    camera.right = (viewH * a) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  function groundAt(sx: number, sy: number): Vector3 | null {
    const ndc = new Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1);
    const near = new Vector3(ndc.x, ndc.y, -1).unproject(camera);
    const far = new Vector3(ndc.x, ndc.y, 1).unproject(camera);
    const ray = new Ray(near, far.sub(near).normalize());
    return ray.intersectPlane(GROUND, new Vector3());
  }
  place();
  proj();

  return {
    camera,
    target,
    viewHeight: () => viewH,
    resize(nw, nh) {
      w = Math.max(1, nw);
      h = Math.max(1, nh);
      proj();
    },
    setView(t, vh) {
      target.copy(t);
      viewH = Math.min(MAX_H, Math.max(MIN_H, vh));
      place();
      proj();
    },
    pan(dx, dy) {
      const s = viewH / h;
      target.addScaledVector(RIGHT, -dx * s).addScaledVector(FWD, (dy * s) / Math.sin(PITCH));
      place();
    },
    zoomAt(factor, sx, sy) {
      const before = groundAt(sx, sy);
      viewH = Math.min(MAX_H, Math.max(MIN_H, viewH / factor));
      proj();
      const after = before && groundAt(sx, sy);
      if (before && after) target.add(before).sub(after);
      place();
    },
    groundAt,
  };
}
