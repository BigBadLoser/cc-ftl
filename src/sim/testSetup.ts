import { setPackedGuard } from './packedGuard';

// Vitest setup file (vite.config.ts): a missing `withPlayerAboard` fails the test (#350).
setPackedGuard('throw');
