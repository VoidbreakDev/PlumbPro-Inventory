import { describe, it, expect } from 'vitest';
import { getNextDue } from '../../lib/recurrence';

describe('getNextDue', () => {
  const base = new Date('2026-04-09');

  it('daily adds 1 day', () => {
    expect(getNextDue('daily', base)).toEqual(new Date('2026-04-10'));
  });

  it('weekly adds 7 days', () => {
    expect(getNextDue('weekly', base)).toEqual(new Date('2026-04-16'));
  });

  it('fortnightly adds 14 days', () => {
    expect(getNextDue('fortnightly', base)).toEqual(new Date('2026-04-23'));
  });

  it('monthly adds 1 month', () => {
    expect(getNextDue('monthly', base)).toEqual(new Date('2026-05-09'));
  });

  it('quarterly adds 3 months', () => {
    expect(getNextDue('quarterly', base)).toEqual(new Date('2026-07-09'));
  });

  it('handles month-end overflow correctly', () => {
    const jan31 = new Date('2026-01-31');
    // date-fns addMonths clamps to last day of Feb
    const result = getNextDue('monthly', jan31);
    expect(result.getMonth()).toBe(1); // February
  });
});
