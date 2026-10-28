import { describe, expect, it } from 'vitest';

import { roles } from './roles';

describe('role priorities', () => {
  it('every working role puts damage control (fires, breaches) at the top priority; roles that do no work stay at 0', () => {
    for (const [id, r] of Object.entries(roles)) {
      const works = Object.entries(r.priorities).some(([k, v]) => k !== 'firefighting' && v > 0);
      expect(r.priorities.firefighting, id).toBe(works ? 1 : 0);
    }
  });
});
