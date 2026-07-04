import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS, describeFilters } from './filters';

describe('describeFilters', () => {
  it('summarizes the default filters', () => {
    expect(describeFilters(DEFAULT_FILTERS)).toBe('15 mi · Next 30 days');
  });

  it('leads with the breed and includes active facets', () => {
    expect(
      describeFilters({
        ...DEFAULT_FILTERS,
        breed: 'Golden Retriever',
        radiusMi: 25,
        dateWindow: 'weekend',
        venues: ['dog_park', 'public_park'],
        hasSpots: true,
      }),
    ).toBe('Golden Retriever · 25 mi · This weekend · 2 venues · Has spots');
  });
});
