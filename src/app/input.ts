import type { Renderer } from '../render/scene';

export interface Tile {
  x: number;
  y: number;
}

export interface InputHandlers {
  /** Tap/click at canvas-relative px (not called while painting). */
  onTap(screenX: number, screenY: number): void;
  /** True while a build/deconstruct/cancel tool is active: one-finger drag paints instead of panning. */
  paintMode(): boolean;
  /** Drag-paint lifecycle. `end` commits, `cancel` aborts (second finger, pointer cancel). */
  onPaint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Right-click: back out of the current tool. */
  onBack(): void;
  /** Non-camera hotkeys: 'escape', 'r' (shift = the other way). */
  onKey(key: string, shift?: boolean): void;
  /** Mouse hover tile (null when off-grid or pointer left). */
  onHover(tile: Tile | null): void;
  /** Height (tiles) above the ground that picked tiles are read at: the mining tool paints the tops of rock blocks. Default 0. */
  pickLift?(): number;
}

const DRAG_THRESHOLD = 4;
const KEY_PAN_PX_PER_S = 700;
const WHEEL_ZOOM = 0.0015;
const KEY_ZOOM = 1.25;

/** Pointer + keyboard camera control and tile picking on the canvas. Returns a disposer. */
export function attachInput(canvas: HTMLCanvasElement, renderer: Renderer, h: InputHandlers): () => void {
  canvas.style.touchAction = 'none';
  const pointers = new Map<number, { x: number; y: number }>();
  let downId = -1;
  let start = { x: 0, y: 0 };
  let dragging = false;
  let painting = false;
  let multi = false; // a second finger joined: never counts as a tap
  let pinchDist = 0;

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
      h.onBack();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      downId = e.pointerId;
      start = local(e);
      dragging = false;
      multi = false;
      painting = e.button === 0 && h.paintMode();
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
      if (e.pointerType === 'mouse') h.onHover(renderer.pickSector(p.x, p.y, h.pickLift?.()));
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
    if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) >= DRAG_THRESHOLD) dragging = true;
    if (dragging) renderer.pan(p.x - prev.x, p.y - prev.y);
    else if (e.pointerType === 'mouse') h.onHover(renderer.pickSector(p.x, p.y, h.pickLift?.()));
  };

  const onUp = (e: PointerEvent) => {
    const wasDown = pointers.delete(e.pointerId);
    if (!wasDown) return;
    if (pointers.size === 1) pinchDist = 0;
    if (painting && e.pointerId === downId) {
      painting = false;
      const p = local(e);
      h.onPaint(e.type === 'pointerup' ? 'end' : 'cancel', renderer.pickSector(p.x, p.y, h.pickLift?.()));
    } else if (e.pointerId === downId && e.type === 'pointerup' && !dragging && !multi) {
      const p = local(e);
      h.onTap(p.x, p.y);
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
    renderer.zoomAt(Math.exp(-dy * WHEEL_ZOOM), p.x, p.y);
  };

  // Keyboard: held pan keys move the camera each frame.
  const held = new Set<string>();
  let raf = 0;
  let lastT = 0;
  const panKeys: Record<string, [number, number]> = {
    w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1],
    a: [1, 0], arrowleft: [1, 0], d: [-1, 0], arrowright: [-1, 0],
  };
  const tick = (t: number) => {
    const dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    let dx = 0;
    let dy = 0;
    for (const k of held) {
      const v = panKeys[k];
      if (v) {
        dx += v[0];
        dy += v[1];
      }
    }
    if (dx || dy) renderer.pan(dx * KEY_PAN_PX_PER_S * dt, dy * KEY_PAN_PX_PER_S * dt);
    raf = held.size ? requestAnimationFrame(tick) : 0;
  };
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k in panKeys) {
      e.preventDefault();
      held.add(k);
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    } else if (k === 'escape' || k === 'r') {
      h.onKey(k, e.shiftKey);
    } else if (k === '+' || k === '=' || k === '-' || k === '_') {
      const r = canvas.getBoundingClientRect();
      renderer.zoomAt(k === '-' || k === '_' ? 1 / KEY_ZOOM : KEY_ZOOM, r.width / 2, r.height / 2);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
  const onBlur = () => held.clear();

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
    cancelAnimationFrame(raf);
  };
}
