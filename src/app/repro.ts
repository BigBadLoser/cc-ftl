import { deserialize, serialize, type ContentRegistry, type QueuedCommand, type Sim } from '../sim';
import type { ErrorEntry } from './errors';

export interface Repro {
  v: 1;
  seed: number;
  saveJson: string;
  commandLog: QueuedCommand[];
  tick: number;
  userAgent: string;
  recentErrors: ErrorEntry[];
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeRepro(repro: Repro): string {
  return toBase64(JSON.stringify(repro));
}

export function decodeRepro(s: string): Repro {
  const r = JSON.parse(fromBase64(s)) as Repro;
  if (r.v !== 1) throw new Error(`Unsupported repro version ${String(r.v)}`);
  return r;
}

/** Build the base64 repro string for the current sim state. */
export function buildRepro(sim: Sim, recentErrors: ErrorEntry[]): string {
  return encodeRepro({
    v: 1,
    seed: sim.seed,
    saveJson: serialize(sim),
    commandLog: [...sim.commands.getLog()],
    tick: sim.tick,
    userAgent: typeof navigator === 'undefined' ? 'node' : navigator.userAgent,
    recentErrors,
  });
}

/** Decode a repro string and rebuild its sim (for tests and tools). */
export function loadRepro(s: string, content: ContentRegistry = { ships: {} }): { sim: Sim; repro: Repro } {
  const repro = decodeRepro(s);
  return { sim: deserialize(repro.saveJson, content), repro };
}
