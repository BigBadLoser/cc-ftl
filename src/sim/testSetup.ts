import { GalaxyGen } from './galaxy/generator';
import { setPackedGuard } from './packedGuard';

// Vitest setup file (vite.config.ts): a missing `withPlayerAboard` fails the test (#350).
setPackedGuard('throw');

// Generated chunks are cached per (content, seed) and shared by every test in a worker: freeze them deep so a test that assigns to a
// shared node (a danger tier, say) fails at once instead of leaking into the next test. Give such a test its own copy of the data.
const frozen = new WeakSet<object>();
function deepFreeze(o: unknown): void {
  if (!o || typeof o !== 'object' || frozen.has(o)) return;
  frozen.add(o);
  Object.freeze(o);
  for (const v of Object.values(o)) deepFreeze(v);
}
const chunk = GalaxyGen.prototype.chunk;
GalaxyGen.prototype.chunk = function (this: GalaxyGen, cx: number, cy: number) {
  const data = chunk.call(this, cx, cy);
  deepFreeze(data);
  return data;
};
