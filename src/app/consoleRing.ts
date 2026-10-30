export interface RingEntry {
  message: string;
  stack: string;
  time: number;
}

export interface ConsoleRing {
  /** Newest first. */
  get(): RingEntry[];
  dispose(): void;
}

const MAX = 10;

function describe(v: unknown): { message: string; stack: string } {
  if (v instanceof Error) return { message: v.message, stack: v.stack ?? '' };
  if (typeof v === 'string') return { message: v, stack: '' };
  try {
    return { message: JSON.stringify(v) ?? String(v), stack: '' };
  } catch {
    return { message: String(v), stack: '' };
  }
}

/**
 * A ring buffer of the last 10 console errors, uncaught errors and unhandled rejections, for the bug report. Installed once at
 * startup; `console.error` still prints as before.
 */
export function installConsoleRing(target: Window = window, con: Pick<Console, 'error'> = console): ConsoleRing {
  const list: RingEntry[] = [];
  const push = (v: unknown, extra?: unknown[]) => {
    const d = describe(v);
    if (extra?.length) d.message = [d.message, ...extra.map((x) => describe(x).message)].join(' ');
    list.unshift({ ...d, time: Date.now() });
    if (list.length > MAX) list.length = MAX;
  };
  const original = con.error;
  con.error = (...args: unknown[]) => {
    push(args[0], args.slice(1));
    original.apply(con, args);
  };
  const onError = (ev: ErrorEvent) => push(ev.error ?? ev.message);
  const onRejection = (ev: PromiseRejectionEvent) => push(ev.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return {
    get: () => list.slice(),
    dispose() {
      con.error = original;
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
