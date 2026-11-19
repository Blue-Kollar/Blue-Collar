/**
 * Local-calendar date helpers. They compare calendar days in the user's own time zone, so a date
 * picked in one place matches the same day in another.
 *
 * Date formatting lives in `lib/format.ts`; this module re-exports those formatters so existing
 * imports from `lib/date` keep working while there is a single formatting source.
 */

export {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeDate,
} from './format';

/** The given date at local midnight. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** True when both dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when `a` is an earlier local calendar day than `b`. Times within a day are ignored. */
export function isBeforeDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}