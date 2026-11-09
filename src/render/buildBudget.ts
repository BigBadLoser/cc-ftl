/**
 * Scene builds spread over frames (#389). A new ship, a station or a whole node after a jump used to be built in the frame
 * it appeared: every chunk of tiles and roof, every module, hundreds of ms in one frame. Views now ask a gate before they
 * build a piece (a chunk, a module); a scene that is still being built gets a share of a per-frame time budget and stays
 * hidden until one update builds nothing more (`ShipScene.ready`), so it never shows half-built. Views of a scene that is on
 * screen always build at once (an edit shows the same frame).
 */

/** Whether a view may build one more piece now. A refused piece is retried on a later update. */
export interface BuildGate {
  take(): boolean;
  /** Pieces refused since `reset`. */
  readonly refused: number;
  reset(): void;
}

/** A gate that never refuses (scenes built outside the renderer: tests, tools). */
export const OPEN_GATE: BuildGate = { take: () => true, refused: 0, reset() {} };

export interface BuildBudget {
  /** Start this frame's share: `ms` of building from now (each gate's first piece of a frame is always allowed, so every build progresses). `idle`: background builds (hidden roofs) may use it too. */
  frame(ms: number, idle: boolean): void;
  /** While on (a loading screen is up) every gate is open. */
  setRush(on: boolean): void;
  /** A gate open while `open()` says so, else bounded by the frame's share. */
  gate(open: () => boolean): BuildGate;
  /** A gate for background work (a roof that is not shown): only within an idle frame's share. */
  idle(): BuildGate;
}

export function createBuildBudget(now: () => number): BuildBudget {
  let deadline = Infinity;
  let frame = 0;
  let idleOk = true;
  let rush = false;
  const make = (pass: () => boolean, free: boolean): BuildGate => {
    let refused = 0;
    let freeIn = -1;
    return {
      take() {
        if (rush || pass()) return true;
        if (free && freeIn !== frame) {
          freeIn = frame;
          return true;
        }
        refused++;
        return false;
      },
      get refused() {
        return refused;
      },
      reset() {
        refused = 0;
      },
    };
  };
  return {
    frame(ms, idle) {
      deadline = now() + ms;
      frame++;
      idleOk = idle;
    },
    setRush(on) {
      rush = on;
    },
    gate: (open) => make(() => open() || now() < deadline, true),
    // Background work gets no free piece: it waits for an idle frame's share.
    idle: () => make(() => idleOk && now() < deadline, false),
  };
}
