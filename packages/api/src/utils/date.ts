/**
 * UTC-only date utilities.
 *
 * All date parsing and formatting in the API services should go through this
 * module so that date handling follows a single, consistent set of UTC rules.
 */

const TIMEZONE_DESIGNATOR = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse an input into a Date, interpreting timezone-less strings as UTC.
 *
 * - Strings without a timezone designator (no trailing `Z` and no `±HH:MM`
 *   offset) are treated as UTC by appending `Z` before parsing.
 * - Numbers are treated as epoch milliseconds.
 * - Date instances are copied into a new Date with the same time.
 *
 * @throws {Error} if the input cannot be parsed into a valid date.
 */
export function parseUtcDate(input: string | number | Date): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error('Invalid date: received an invalid Date instance');
    }
    return new Date(input.getTime());
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Invalid date: received a non-finite number (${input})`);
    }
    const fromNumber = new Date(input);
    if (Number.isNaN(fromNumber.getTime())) {
      throw new Error(`Invalid date: received an out-of-range number (${input})`);
    }
    return fromNumber;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '') {
      throw new Error('Invalid date: received an empty string');
    }

    const normalized = TIMEZONE_DESIGNATOR.test(trimmed) ? trimmed : `${trimmed}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: could not parse "${input}"`);
    }
    return parsed;
  }

  throw new Error(`Invalid date: unsupported input type (${typeof input})`);
}

/**
 * Return the current time as a Date.
 */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Format a Date as an ISO 8601 UTC string.
 */
export function formatUtcIso(date: Date): string {
  return date.toISOString();
}

/**
 * Return a new Date offset from the given date by the specified milliseconds.
 */
export function addUtcMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Return a new Date representing the start (00:00:00.000) of the UTC day
 * containing the given date.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}