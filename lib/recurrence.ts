import { addDays, addWeeks, addMonths } from 'date-fns';
import type { RecurrenceFrequency } from '../types';

/**
 * Returns the next due date after advancing by one interval.
 */
export function getNextDue(frequency: RecurrenceFrequency, currentDue: Date): Date {
  switch (frequency) {
    case 'daily':       return addDays(currentDue, 1);
    case 'weekly':      return addWeeks(currentDue, 1);
    case 'fortnightly': return addWeeks(currentDue, 2);
    case 'monthly':     return addMonths(currentDue, 1);
    case 'quarterly':   return addMonths(currentDue, 3);
  }
}
