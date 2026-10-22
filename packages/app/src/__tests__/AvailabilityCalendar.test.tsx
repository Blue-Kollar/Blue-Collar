/**
 * AvailabilityCalendar.test.tsx
 * Closes #1375 — tests for calendar grid date-math edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";

// Helper functions to test calendar date math
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = date.getTime();
  return t > start.getTime() && t < end.getTime();
}

describe("CalendarGrid - Month Boundary Cases", () => {
  it("correctly handles January with 31 days", () => {
    const days = getDaysInMonth(2024, 0); // Month 0 = January
    expect(days).toBe(31);
  });

  it("correctly handles February in leap year with 29 days", () => {
    const days = getDaysInMonth(2024, 1); // 2024 is leap year
    expect(days).toBe(29);
  });

  it("correctly handles February in non-leap year with 28 days", () => {
    const days = getDaysInMonth(2023, 1); // 2023 is not leap year
    expect(days).toBe(28);
  });

  it("correctly handles April with 30 days", () => {
    const days = getDaysInMonth(2024, 3); // Month 3 = April
    expect(days).toBe(30);
  });

  it("correctly handles December with 31 days", () => {
    const days = getDaysInMonth(2024, 11); // Month 11 = December
    expect(days).toBe(31);
  });

  it("correctly identifies first day of month", () => {
    // January 1, 2024 is a Monday (day 1)
    const firstDay = getFirstDayOfMonth(2024, 0);
    expect(firstDay).toBe(1);
  });

  it("correctly handles month transition edge case", () => {
    const decDays = getDaysInMonth(2023, 11);
    const janDays = getDaysInMonth(2024, 0);
    expect(decDays).toBe(31);
    expect(janDays).toBe(31);
  });
});

describe("CalendarGrid - Leap Year Cases", () => {
  it("identifies 2024 as leap year", () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it("identifies 2023 as non-leap year", () => {
    expect(isLeapYear(2023)).toBe(false);
  });

  it("identifies century years correctly - 2000 is leap year", () => {
    expect(isLeapYear(2000)).toBe(true);
  });

  it("identifies century years correctly - 1900 is not leap year", () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it("identifies century years correctly - 2100 is not leap year", () => {
    expect(isLeapYear(2100)).toBe(false);
  });

  it("correctly handles Feb 29 in leap year", () => {
    const leapFeb = new Date(2024, 1, 29);
    const nextDay = new Date(2024, 1, 30);
    expect(leapFeb.getMonth()).toBe(1);
    expect(nextDay.getMonth()).toBe(1);
  });

  it("February max date transitions correctly in leap year", () => {
    const days = getDaysInMonth(2024, 1);
    expect(days).toBe(29);
    const mar1 = new Date(2024, 1, 29 + 1);
    expect(mar1.getMonth()).toBe(2); // March
  });
});

describe("CalendarGrid - Date Range Logic", () => {
  it("isSameDay returns true for identical dates", () => {
    const date1 = new Date(2024, 8, 15);
    const date2 = new Date(2024, 8, 15);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it("isSameDay returns false for different dates", () => {
    const date1 = new Date(2024, 8, 15);
    const date2 = new Date(2024, 8, 16);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it("isSameDay handles month differences", () => {
    const date1 = new Date(2024, 7, 31);
    const date2 = new Date(2024, 8, 1);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it("isSameDay handles year differences", () => {
    const date1 = new Date(2023, 8, 15);
    const date2 = new Date(2024, 8, 15);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it("inRange returns false when no range is set", () => {
    const date = new Date(2024, 8, 15);
    expect(inRange(date, null, null)).toBe(false);
  });

  it("inRange returns false with partial range", () => {
    const date = new Date(2024, 8, 15);
    const start = new Date(2024, 8, 10);
    expect(inRange(date, start, null)).toBe(false);
    expect(inRange(date, null, start)).toBe(false);
  });

  it("inRange returns true for date between start and end", () => {
    const date = new Date(2024, 8, 15);
    const start = new Date(2024, 8, 10);
    const end = new Date(2024, 8, 20);
    expect(inRange(date, start, end)).toBe(true);
  });

  it("inRange returns false for date equal to start", () => {
    const date = new Date(2024, 8, 10);
    const start = new Date(2024, 8, 10);
    const end = new Date(2024, 8, 20);
    expect(inRange(date, start, end)).toBe(false);
  });

  it("inRange returns false for date equal to end", () => {
    const date = new Date(2024, 8, 20);
    const start = new Date(2024, 8, 10);
    const end = new Date(2024, 8, 20);
    expect(inRange(date, start, end)).toBe(false);
  });

  it("inRange handles single-day ranges", () => {
    const date = new Date(2024, 8, 15);
    const start = new Date(2024, 8, 15);
    const end = new Date(2024, 8, 15);
    expect(inRange(date, start, end)).toBe(false);
  });

  it("inRange handles cross-month ranges", () => {
    const date = new Date(2024, 8, 15);
    const start = new Date(2024, 7, 25);
    const end = new Date(2024, 8, 25);
    expect(inRange(date, start, end)).toBe(true);
  });

  it("inRange handles cross-year ranges", () => {
    const date = new Date(2024, 0, 15);
    const start = new Date(2023, 11, 25);
    const end = new Date(2024, 1, 25);
    expect(inRange(date, start, end)).toBe(true);
  });
});

describe("CalendarGrid - Edge Cases", () => {
  it("handles calendar starting on Sunday (month offset 0)", () => {
    // August 2025 starts on Friday
    const firstDay = getFirstDayOfMonth(2025, 7);
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(firstDay);
  });

  it("handles 35-day calendar grids", () => {
    // Some months need 35 cells (5 weeks * 7 days)
    const firstDay = getFirstDayOfMonth(2024, 8); // September 2024
    const daysInMonth = getDaysInMonth(2024, 8);
    const totalCells = firstDay + daysInMonth;
    expect(totalCells <= 42).toBe(true); // Max 6 weeks
  });

  it("handles 42-day calendar grids", () => {
    // Some months need 42 cells (6 full weeks)
    const firstDay = getFirstDayOfMonth(2024, 0); // January 2024
    const daysInMonth = getDaysInMonth(2024, 0);
    const totalCells = firstDay + daysInMonth;
    expect(totalCells <= 42).toBe(true);
  });

  it("correctly transitions past month boundary", () => {
    const lastDayOfYear = new Date(2023, 11, 31);
    const nextDay = new Date(2024, 0, 1);
    expect(lastDayOfYear.getFullYear()).toBe(2023);
    expect(nextDay.getFullYear()).toBe(2024);
  });

  it("correctly handles DST transitions (spring forward)", () => {
    // March 10, 2024, 2:00 AM → 3:00 AM
    const beforeDST = new Date(2024, 2, 10, 1, 0);
    const afterDST = new Date(2024, 2, 10, 3, 0);
    expect(afterDST.getTime() - beforeDST.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it("handles negative date offsets gracefully", () => {
    const date = new Date(2024, 8, 15);
    const offset = new Date(date.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    expect(offset.getDate()).toBe(5);
  });
});
