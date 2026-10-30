import { isTypingTarget, modalOpen } from '../ui/keys';
import { chordOf, keymap, type ActionId } from '../ui/keymap';
import { settings } from '../ui/settings/settings';
import type { Renderer } from '../render/scene';

export interface Tile {
  x: number;
  y: number;
}

export interface InputHandlers {
  /** Tap/click at canvas-relative px (not called while painting or after a box drag). `shift`: the shift key was held. */
  onTap(screenX: number, screenY: number, shift?: boolean): void;
  /**
   * Mouse left-drag in select mode draws a selection box instead of panning the view (middle-drag, the arrow keys and touch pan).
   * `a` is where the drag began and `b` the pointer now, in canvas-relative px; `end` commits and `cancel` aborts.
   */
  onBox?(phase: 'start' | 'move' | 'end' | 'cancel', a: { x: number; y: number }, b: { x: number; y: number }, shift: boolean): void;
  /** True while a build/deconstruct/cancel tool is active: one-finger drag paints instead of panning. */
  paintMode(): boolean;
  /** Drag-paint lifecycle. `end` commits, `cancel` aborts (second finger, pointer cancel). */
  onPaint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Right-click at canvas-relative px: back out of the current tool, or give an order to the selection. */
  onContext(screenX: number, screenY: number, shift: boolean): void;
  /** Non-camera world hotkeys (keymap actions): rotate the module being placed (either way), or draft the selected crew. */
  onKey(action: 'rotate' | 'rotateBack' | 'draft'): void;
  /** Mouse hover tile (null when off-grid or pointer left). */
  onHover(tile: Tile | null): void;
  /** Mouse position in canvas px (the "Target in view" preview reads the ship tile under it). */
  onPointer?(screenX: number, screenY: number): void;
  /** Height (tiles) above the ground that picked tiles are read at: the mining tool paints the tops of rock blocks. Default 0. */
  pickLift?(): number;
}

const DRAG_THRESHOLD = 4;
const KEY_PAN_PX_PER_S = 700;
const WHEEL_ZOOM = 0.0015;
const KEY_ZOOM = 1.25;
/** The mouse within this many px of a window edge pans the camera (edge scrolling, a setting). */
const EDGE_PX = 8;
const PAN_DIRS: [ActionId, number, number][] = [['cam.up', 0, 1], ['cam.down', 0, -1], ['cam.left', 1, 0], ['cam.right', -1, 0]];
const WORLD_KEYS: [ActionId, 'rotate' | 'rotateBack' | 'draft'][] = [['build.rotate', 'rotate'], ['build.rotateBack', 'rotateBack'], ['crew.draft', 'draft']];

/** Pointer + keyboard camera control and tile picking on the canvas. Returns a disposer. */
export function attachInput(canvas: HTMLCanvasElement, renderer: Renderer, h: InputHandlers): () => void {
  canvas.style.touchAction = 'none';
  const pointers = new Map<number, { x: number; y: number }>();
  let downId = -1;
  let start = { x: 0, y: 0 };
  let dragging = false;
  let painting = false;
  let multi = false; // a second finger joined: never counts as a tap
  let boxing = false; // a mouse left-drag past the threshold in select mode
  let panDrag = false; // the middle button is held
  let pinchDist = 0;
  let boxable = false; // this press may turn into a selection box

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mid = () => {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button === 2) {
      const p = local(e);
      h.onContext(p.x, p.y, e.shiftKey);
      return;
    }
    if (e.button === 1) e.preventDefault(); // no browser autoscroll
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      downId = e.pointerId;
      start = local(e);
      dragging = false;
      boxing = false;
      panDrag = e.button === 1;
      multi = false;
      painting = e.button === 0 && h.paintMode();
      boxable = e.button === 0 && e.pointerType === 'mouse' && !painting && !!h.onBox;
      if (painting) h.onPaint('start', renderer.pickSector(start.x, start.y, h.pickLift?.()));
    } else if (pointers.size === 2) {
      if (painting) {
        painting = false;
        h.onPaint('cancel', null);
      }
      multi = true;
      pinchDist = mid().d;
    }
  };

  const onMove = (e: PointerEvent) => {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') {
        h.onHover(renderer.pickSector(p.x, p.y, h.pickLift?.()));
        h.onPointer?.(p.x, p.y);
      }
      return;
    }
    if (pointers.size >= 2) {
      const before = mid();
      pointers.set(e.pointerId, p);
      const now = mid();
      renderer.pan(now.x - before.x, now.y - before.y);
      if (pinchDist > 0 && now.d > 0) renderer.zoomAt(now.d / pinchDist, now.x, now.y);
      pinchDist = now.d;
      return;
    }
    pointers.set(e.pointerId, p);
    if (painting) {
      h.onPaint('move', renderer.pickSector(p.x, p.y, h.pickLift?.()));
      return;
    }
    if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) >= DRAG_THRESHOLD) {
      dragging = true;
      if (boxable && !panDrag) {
        boxing = true;
        h.onBox?.('start', start, p, e.shiftKey);
      }
    }
    if (boxing) h.onBox?.('move', start, p, e.shiftKey);
    else if (dragging) {
      const k = settings.get().invertDrag ? -1 : 1;
      renderer.pan(k * (p.x - prev.x), k * (p.y - prev.y));
    }
    else if (e.pointerType === 'mouse') h.onHover(renderer.pickSector(p.x, p.y, h.pickLift?.()));
  };

  const onUp = (e: PointerEvent) => {
    const wasDown = pointers.delete(e.pointerId);
    if (!wasDown) return;
    if (pointers.size === 1) pinchDist = 0;
    if (boxing && e.pointerId === downId) {
      boxing = false;
      h.onBox?.(e.type === 'pointerup' ? 'end' : 'cancel', start, local(e), e.shiftKey);
    } else if (painting && e.pointerId === downId) {
      painting = false;
      const p = local(e);
      h.onPaint(e.type === 'pointerup' ? 'end' : 'cancel', renderer.pickSector(p.x, p.y, h.pickLift?.()));
    } else if (e.pointerId === downId && e.type === 'pointerup' && !dragging && !multi && !panDrag) {
      const p = local(e);
      h.onTap(p.x, p.y, e.shiftKey);
    }
    if (pointers.size === 0) multi = false;
  };

  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') h.onHover(null);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    renderer.zoomAt(Math.exp(-dy * WHEEL_ZOOM * settings.get().zoomSpeed), p.x, p.y);
  };

  // Keyboard (held pan keys, keymap.ts) and edge scrolling move the camera each frame.
  /** Held pan keys: physical key -> the chord it was pressed as (with or without Shift), matched exactly against the bindings. */
  const held = new Map<string, string>();
  let raf = 0;
  let lastT = 0;
  /** The mouse in the window (null once it leaves), for edge scrolling. */
  let mouse: { x: number; y: number } | null = null;
  const edgeDir = (): [number, number] => {
    if (!mouse || !settings.get().edgeScroll || !document.hasFocus()) return [0, 0];
    const { innerWidth: w, innerHeight: hh } = window;
    return [mouse.x <= EDGE_PX ? 1 : mouse.x >= w - 1 - EDGE_PX ? -1 : 0, mouse.y <= EDGE_PX ? 1 : mouse.y >= hh - 1 - EDGE_PX ? -1 : 0];
  };
  const tick = (t: number) => {
    const dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    let [dx, dy] = edgeDir();
    for (const chord of held.values()) {
      for (const [id, x, y] of PAN_DIRS) {
        if (keymap.keys(id).includes(chord)) {
          dx += x;
          dy += y;
        }
      }
    }
    const v = KEY_PAN_PX_PER_S * settings.get().scrollSpeed * dt;
    if (dx || dy) renderer.pan(Math.sign(dx) * v, Math.sign(dy) * v);
    const [ex, ey] = edgeDir();
    raf = held.size || ex || ey ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (modalOpen() || isTypingTarget(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (PAN_DIRS.some(([id]) => keymap.matches(e, id))) {
      e.preventDefault();
      held.set(e.code, chordOf(e)!);
      run();
      return;
    }
    for (const [id, action] of WORLD_KEYS) if (keymap.matches(e, id)) h.onKey(action);
    const zin = keymap.matches(e, 'cam.zoomIn');
    if (zin || keymap.matches(e, 'cam.zoomOut')) {
      const r = canvas.getBoundingClientRect();
      const f = Math.pow(KEY_ZOOM, settings.get().zoomSpeed);
      renderer.zoomAt(zin ? f : 1 / f, r.width / 2, r.height / 2);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
  const onBlur = () => held.clear();
  const onMouse = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mouse = { x: e.clientX, y: e.clientY };
    const [ex, ey] = edgeDir();
    if (ex || ey) run();
  };
  const onMouseOut = (e: PointerEvent) => {
    if (!e.relatedTarget) mouse = null; // left the window
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const noMenu = (e: Event) => e.preventDefault();
  canvas.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointermove', onMouse);
  window.addEventListener('pointerout', onMouseOut);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pointermove', onMouse);
    window.removeEventListener('pointerout', onMouseOut);
    cancelAnimationFrame(raf);
  };
}
