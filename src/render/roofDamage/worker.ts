/** The roof damage painter's worker: paints one window per message, off the main thread (painter.ts posts them). */
import { paintRoofDamage } from './paint';
import type { PaintJob } from './painter';

const scope = self as unknown as {
  onmessage: ((e: { data: PaintJob & { id: number } }) => void) | null;
  postMessage(msg: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const { id, win, layers, hits } = e.data;
  const out = paintRoofDamage(win, layers, hits);
  scope.postMessage({ id, out }, [out.buffer]);
};
