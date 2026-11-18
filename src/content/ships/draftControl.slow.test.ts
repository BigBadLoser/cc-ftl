import { defineDraftControl } from '../../../test/support/fixtures/draftControl';

// The seeded cases on seeds 2 and 3 (draftControl.test.ts runs seed 1 and the cases that take no seed).
defineDraftControl([2, 3], false);
