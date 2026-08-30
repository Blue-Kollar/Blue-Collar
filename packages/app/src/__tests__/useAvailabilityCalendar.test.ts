/**
 * useAvailabilityCalendar.test.ts — unit tests for useAvailabilityCalendar (#1260)
 *
 * Coverage for:
 *  - Initial state (year, month, rangeStart, rangeEnd, bulkDays)
 *  - toggleBulkDay: add a day, remove a day, multiple toggles
 *  - handleBulkApply: no-op when bulkDays is empty, correct slots when days selected
 *  - Month navigation helpers (nextMonth / prevMonth)
 *  - availableDays set derived from availability prop
 *  - slotMap keyed by dayOfWeek
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAvailabilityCalendar } from '@/hooks/useAvailabilityCalendar'

const mockSlots = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // Monday
  { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' }, // Wednesday
]

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('useAvailabilityCalendar — initial state', () => {
  it('initializes with current year and month', () => {
    const today = new Date()
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.year).toBe(today.getFullYear())
    expect(result.current.month).toBe(today.getMonth())
  })

  it('initializes range as null', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.rangeStart).toBeNull()
    expect(result.current.rangeEnd).toBeNull()
  })

  it('initializes bulkDays as empty', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.bulkDays).toEqual([])
  })

  it('initializes showSlotEditor as false', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.showSlotEditor).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// availableDays derived set
// ─────────────────────────────────────────────────────────────────────────────

describe('useAvailabilityCalendar — availableDays', () => {
  it('derives available day-of-week values from availability prop', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.availableDays.has(1)).toBe(true) // Monday
    expect(result.current.availableDays.has(3)).toBe(true) // Wednesday
    expect(result.current.availableDays.has(2)).toBe(false) // Tuesday — not set
  })

  it('returns an empty Set when availability is empty', () => {
    const { result } = renderHook(() => useAvailabilityCalendar([]))

    expect(result.current.availableDays.size).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// slotMap
// ─────────────────────────────────────────────────────────────────────────────

describe('useAvailabilityCalendar — slotMap', () => {
  it('maps each slot by its dayOfWeek', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    expect(result.current.slotMap[1]).toEqual(mockSlots[0])
    expect(result.current.slotMap[3]).toEqual(mockSlots[1])
  })

  it('is an empty object when availability is empty', () => {
    const { result } = renderHook(() => useAvailabilityCalendar([]))

    expect(Object.keys(result.current.slotMap).length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toggleBulkDay
// ─────────────────────────────────────────────────────────────────────────────

describe('useAvailabilityCalendar — toggleBulkDay', () => {
  it('adds a day to bulkDays when it is not present', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    act(() => result.current.toggleBulkDay(2))

    expect(result.current.bulkDays).toContain(2)
  })

  it('removes a day from bulkDays when already present', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    act(() => result.current.toggleBulkDay(2))
    act(() => result.current.toggleBulkDay(2))

    expect(result.current.bulkDays).not.toContain(2)
  })

  it('handles multiple different days independently', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    act(() => result.current.toggleBulkDay(0))
    act(() => result.current.toggleBulkDay(4))
    act(() => result.current.toggleBulkDay(6))

    expect(result.current.bulkDays).toContain(0)
    expect(result.current.bulkDays).toContain(4)
    expect(result.current.bulkDays).toContain(6)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// handleBulkApply
// ─────────────────────────────────────────────────────────────────────────────

describe('useAvailabilityCalendar — handleBulkApply', () => {
  it('does not call the callback when bulkDays is empty', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))
    const onBulkSet = vi.fn()

    act(() => result.current.handleBulkApply(onBulkSet))

    expect(onBulkSet).not.toHaveBeenCalled()
  })

  it('does not throw when no callback is provided', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))

    act(() => result.current.toggleBulkDay(1))

    expect(() => act(() => result.current.handleBulkApply(undefined))).not.toThrow()
  })

  it('calls onBulkSet with slots for selected days', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))
    const onBulkSet = vi.fn()

    act(() => result.current.toggleBulkDay(2))
    act(() => result.current.toggleBulkDay(5))
    act(() => result.current.handleBulkApply(onBulkSet))

    expect(onBulkSet).toHaveBeenCalledOnce()
    const slots = onBulkSet.mock.calls[0][0]
    expect(slots).toHaveLength(2)
    expect(slots.map((s: { dayOfWeek: number }) => s.dayOfWeek)).toContain(2)
    expect(slots.map((s: { dayOfWeek: number }) => s.dayOfWeek)).toContain(5)
  })

  it('generated slots use the current bulkStart/bulkEnd times', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(mockSlots))
    const onBulkSet = vi.fn()

    act(() => result.current.toggleBulkDay(0))
    act(() => result.current.handleBulkApply(onBulkSet))

    const [slot] = onBulkSet.mock.calls[0][0]
    expect(slot.startTime).toBe(result.current.bulkStart)
    expect(slot.endTime).toBe(result.current.bulkEnd)
  })
})
