import { describe, expect, it } from 'vitest';

import { computeAchievements, type AchievementStats } from './achievements';

const ZERO: AchievementStats = { attended: 0, hosted: 0, going: 0, pets: 0, breedFocusHosted: false };

const earnedIds = (s: AchievementStats) =>
  computeAchievements(s)
    .filter((a) => a.earned)
    .map((a) => a.id);

describe('computeAchievements', () => {
  it('returns a stable set of eight medals with unique ids and hints', () => {
    const all = computeAchievements(ZERO);
    expect(all).toHaveLength(8);
    expect(new Set(all.map((a) => a.id)).size).toBe(8);
    expect(all.every((a) => a.label && a.sf && a.hint)).toBe(true);
  });

  it('earns nothing for a brand-new user', () => {
    expect(earnedIds(ZERO)).toEqual([]);
  });

  it('earns First Meetup after one attended event', () => {
    expect(earnedIds({ ...ZERO, attended: 1 })).toContain('first');
  });

  it('earns Regular at 5 RSVPs and Pack Leader only at 15', () => {
    expect(earnedIds({ ...ZERO, going: 5 })).toEqual(['regular']);
    const at15 = earnedIds({ ...ZERO, going: 15 });
    expect(at15).toContain('regular');
    expect(at15).toContain('pack-leader');
  });

  it('earns Host at 1 and Super Host only at 5 hosted', () => {
    expect(earnedIds({ ...ZERO, hosted: 1 })).toEqual(['host']);
    const at5 = earnedIds({ ...ZERO, hosted: 5 });
    expect(at5).toContain('host');
    expect(at5).toContain('super-host');
  });

  it('earns Breed Ambassador from a breed-focused hosted event', () => {
    expect(earnedIds({ ...ZERO, breedFocusHosted: true })).toEqual(['ambassador']);
  });

  it('earns Pet Parent at 1 pet and Full House only at 3', () => {
    expect(earnedIds({ ...ZERO, pets: 1 })).toEqual(['pet-parent']);
    const three = earnedIds({ ...ZERO, pets: 3 });
    expect(three).toContain('pet-parent');
    expect(three).toContain('full-house');
  });

  it('earns every medal for a maxed-out user', () => {
    const maxed: AchievementStats = { attended: 20, hosted: 10, going: 30, pets: 4, breedFocusHosted: true };
    expect(earnedIds(maxed)).toHaveLength(8);
  });
});
