import { describe, expect, it } from 'vitest';

import { advanceByRecurrence } from './dates';

describe('advanceByRecurrence', () => {
  const base = new Date('2026-03-01T10:00:00.000Z');

  it('adds 7 days for weekly', () => {
    expect(advanceByRecurrence(base, 'weekly').toISOString()).toBe('2026-03-08T10:00:00.000Z');
  });

  it('adds 14 days for biweekly', () => {
    expect(advanceByRecurrence(base, 'biweekly').toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });

  it('adds a calendar month for monthly', () => {
    expect(advanceByRecurrence(base, 'monthly').toISOString()).toBe('2026-04-01T10:00:00.000Z');
  });

  it('does not mutate its argument', () => {
    advanceByRecurrence(base, 'weekly');
    expect(base.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });
});
