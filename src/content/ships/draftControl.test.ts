import { defineDraftControl } from '../../../test/support/fixtures/draftControl';

// Seed 1 here; seeds 2 and 3 of the seeded cases run in draftControl.slow.test.ts (the cases are in test/support/fixtures/draftControl.ts).
defineDraftControl([1], true);
