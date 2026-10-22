import { describe, it, expect } from 'vitest';
import {
  parseUtcDate,
  formatUtcIso,
  addUtcMs,
  nowUtc,
} from './date';

describe('parseUtcDate', () => {
  it('treats timezone-less ISO input as UTC', () => {
    const date = parseUtcDate('2024-01-01T00:00:00');
    expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses ISO input with explicit Z suffix', () => {
    const date = parseUtcDate('2024-01-01T00:00:00Z');
    expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses ISO input with explicit +00:00 offset', () => {
    const date = parseUtcDate('2024-01-01T00:00:00+00:00');
    expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses a numeric epoch in milliseconds', () => {
    const epoch = 1704067200000; // 2024-01-01T00:00:00.000Z
    const date = parseUtcDate(epoch);
    expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns an equivalent Date when given a Date', () => {
    const original = new Date('2024-06-15T12:34:56.789Z');
    const date = parseUtcDate(original);
    expect(date).not.toBe(original);
    expect(date.getTime()).toBe(original.getTime());
    expect(date.toISOString()).toBe('2024-06-15T12:34:56.789Z');
  });

  it('throws on invalid input', () => {
    expect(() => parseUtcDate('not-a-date')).toThrow();
    expect(() => parseUtcDate('')).toThrow();
    expect(() => parseUtcDate(NaN)).toThrow();
    expect(() => parseUtcDate(new Date('invalid'))).toThrow();
  });
});

describe('formatUtcIso', () => {
  it('formats a Date as an ISO UTC string', () => {
    const date = new Date('2024-03-10T05:06:07.008Z');
    expect(formatUtcIso(date)).toBe('2024-03-10T05:06:07.008Z');
  });

  it('formats a timezone-less string as ISO UTC', () => {
    expect(formatUtcIso('2024-01-01T00:00:00')).toBe('2024-01-01T00:00:00.000Z');
  });

  it('formats a numeric epoch as ISO UTC', () => {
    expect(formatUtcIso(1704067200000)).toBe('2024-01-01T00:00:00.000Z');
  });

  it('throws on invalid input', () => {
    expect(() => formatUtcIso('not-a-date')).toThrow();
  });
});

describe('addUtcMs', () => {
  it('adds milliseconds to a Date', () => {
    const base = new Date('2024-01-01T00:00:00.000Z');
    const result = addUtcMs(base, 1500);
    expect(result.toISOString()).toBe('2024-01-01T00:00:01.500Z');
  });

  it('subtracts milliseconds when given a negative amount', () => {
    const base = new Date('2024-01-01T00:00:01.500Z');
    const result = addUtcMs(base, -1500);
    expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('adds milliseconds correctly across a DST boundary', () => {
    // US DST spring-forward: 2024-03-10T07:00:00Z in UTC terms.
    const beforeDst = new Date('2024-03-10T06:59:59.000Z');
    const result = addUtcMs(beforeDst, 2000);
    expect(result.toISOString()).toBe('2024-03-10T07:00:01.000Z');
  });

  it('accepts a string or epoch as the base', () => {
    expect(addUtcMs('2024-01-01T00:00:00', 1000).toISOString()).toBe(
      '2024-01-01T00:00:01.000Z',
    );
    expect(addUtcMs(1704067200000, 1000).toISOString()).toBe(
      '2024-01-01T00:00:01.000Z',
    );
  });
});

describe('nowUtc', () => {
  it('returns a Date close to Date.now()', () => {
    const before = Date.now();
    const now = nowUtc();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});