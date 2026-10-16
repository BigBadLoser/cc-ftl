import { createStore, type Readable } from './store';

export interface ErrorEntry {
  message: string;
  stack: string;
  time: number;
}

export interface ErrorLog {
  errors: Readable<ErrorEntry[]>;
  get(): ErrorEntry[];
  push(e: unknown): void;
  clear(): void;
  dispose(): void;
}

const MAX = 20;

export function toEntry(e: unknown): ErrorEntry {
  if (e instanceof Error) return { message: e.message, stack: e.stack ?? '', time: Date.now() };
  let message: string;
  try {
    message = typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    message = String(e);
  }
  return { message: message ?? String(e), stack: '', time: Date.now() };
}

/** Capture global errors and unhandled rejections, keeping the last 20 (newest first). */
export function createErrorLog(target: Window = window): ErrorLog {
  const store = createStore<ErrorEntry[]>([]);
  const push = (e: unknown) => store.update((list) => [toEntry(e), ...list].slice(0, MAX));
  const onError = (ev: ErrorEvent) => push(ev.error ?? ev.message);
  const onRejection = (ev: PromiseRejectionEvent) => push(ev.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return {
    errors: store,
    get: store.get,
    push,
    clear: () => store.set([]),
    dispose() {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
