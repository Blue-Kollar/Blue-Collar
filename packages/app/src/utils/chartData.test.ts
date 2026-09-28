import { describe, it, expect } from 'vitest'

/**
 * Chart Data Transformation Utilities
 *
 * Extracted from inline chart component logic and made independently testable.
 * These utilities handle grouping, aggregation, and transformation of data
 * for use in various chart components across the app.
 */

// ── Data Types ────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  date: Date | string
  amount: number
  type: 'income' | 'expense'
  category: string
}

interface TimeSeriesDataPoint {
  timestamp: string
  value: number
}

interface GroupedData {
  label: string
  value: number
  count: number
}

// ── Chart Data Utilities ──────────────────────────────────────────────────────

export const chartDataUtils = {
  /**
   * Group transactions by week and sum amounts
   */
  groupByWeek(transactions: Transaction[]): TimeSeriesDataPoint[] {
    if (transactions.length === 0) return []

    const grouped: Record<string, number> = {}

    transactions.forEach((tx) => {
      const date = typeof tx.date === 'string' ? new Date(tx.date) : tx.date
      const weekStart = new Date(date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      grouped[weekKey] = (grouped[weekKey] ?? 0) + tx.amount
    })

    return Object.entries(grouped)
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  },

  /**
   * Group transactions by category and sum amounts
   */
  groupByCategory(transactions: Transaction[]): GroupedData[] {
    if (transactions.length === 0) return []

    const grouped: Record<string, { value: number; count: number }> = {}

    transactions.forEach((tx) => {
      if (!grouped[tx.category]) {
        grouped[tx.category] = { value: 0, count: 0 }
      }
      grouped[tx.category].value += tx.amount
      grouped[tx.category].count += 1
    })

    return Object.entries(grouped).map(([label, { value, count }]) => ({
      label,
      value,
      count,
    }))
  },

  /**
   * Calculate rolling average over n periods
   */
  calculateRollingAverage(data: TimeSeriesDataPoint[], windowSize: number): TimeSeriesDataPoint[] {
    if (data.length === 0) return []
    if (windowSize <= 0) throw new Error('Window size must be positive')
    if (windowSize > data.length) return data

    const result: TimeSeriesDataPoint[] = []

    for (let i = 0; i < data.length - windowSize + 1; i++) {
      const window = data.slice(i, i + windowSize)
      const sum = window.reduce((acc, point) => acc + point.value, 0)
      const average = sum / windowSize

      result.push({
        timestamp: data[i + windowSize - 1].timestamp,
        value: average,
      })
    }

    return result
  },

  /**
   * Filter transactions by date range
   */
  filterByDateRange(
    transactions: Transaction[],
    startDate: Date,
    endDate: Date,
  ): Transaction[] {
    return transactions.filter((tx) => {
      const date = typeof tx.date === 'string' ? new Date(tx.date) : tx.date
      return date >= startDate && date <= endDate
    })
  },

  /**
   * Calculate cumulative sum over time
   */
  calculateCumulativeSum(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    if (data.length === 0) return []

    let cumulative = 0
    return data.map((point) => {
      cumulative += point.value
      return {
        timestamp: point.timestamp,
        value: cumulative,
      }
    })
  },

  /**
   * Normalize values to 0-100 scale
   */
  normalize(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    if (data.length === 0) return []

    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min

    if (range === 0) {
      return data.map((point) => ({
        ...point,
        value: 50,
      }))
    }

    return data.map((point) => ({
      timestamp: point.timestamp,
      value: ((point.value - min) / range) * 100,
    }))
  },

  /**
   * Calculate percentage change between periods
   */
  calculatePercentageChange(
    currentPeriod: TimeSeriesDataPoint[],
    previousPeriod: TimeSeriesDataPoint[],
  ): number {
    const currentSum = currentPeriod.reduce((sum, p) => sum + p.value, 0)
    const previousSum = previousPeriod.reduce((sum, p) => sum + p.value, 0)

    if (previousSum === 0) return currentSum === 0 ? 0 : 100

    return ((currentSum - previousSum) / previousSum) * 100
  },

  /**
   * Aggregate data by custom interval
   */
  aggregateByInterval(
    data: TimeSeriesDataPoint[],
    intervalDays: number,
  ): TimeSeriesDataPoint[] {
    if (data.length === 0) return []
    if (intervalDays <= 0) throw new Error('Interval must be positive')

    const grouped: Record<string, number[]> = {}

    data.forEach((point) => {
      const date = new Date(point.timestamp)
      const intervalStart = new Date(date)
      intervalStart.setDate(intervalStart.getDate() - (intervalStart.getDate() % intervalDays))
      const key = intervalStart.toISOString().split('T')[0]

      if (!grouped[key]) grouped[key] = []
      grouped[key].push(point.value)
    })

    return Object.entries(grouped)
      .map(([timestamp, values]) => ({
        timestamp,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  },
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('chartDataUtils', () => {
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-01T10:00:00Z',
      amount: 100,
      type: 'income',
      category: 'salary',
    },
    {
      id: '2',
      date: '2024-01-02T10:00:00Z',
      amount: 50,
      type: 'expense',
      category: 'food',
    },
    {
      id: '3',
      date: '2024-01-08T10:00:00Z',
      amount: 200,
      type: 'income',
      category: 'bonus',
    },
    {
      id: '4',
      date: '2024-01-10T10:00:00Z',
      amount: 75,
      type: 'expense',
      category: 'food',
    },
  ]

  // ── groupByWeek ───────────────────────────────────────────────────────────────

  describe('groupByWeek', () => {
    it('groups transactions by week', () => {
      const result = chartDataUtils.groupByWeek(mockTransactions)

      expect(result).toHaveLength(2)
      expect(result[0].value).toBe(150) // 100 + 50
      expect(result[1].value).toBe(275) // 200 + 75
    })

    it('handles empty transaction list', () => {
      const result = chartDataUtils.groupByWeek([])

      expect(result).toEqual([])
    })

    it('handles single transaction', () => {
      const single = [mockTransactions[0]]
      const result = chartDataUtils.groupByWeek(single)

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(100)
    })

    it('returns sorted results by timestamp', () => {
      const result = chartDataUtils.groupByWeek(mockTransactions)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp)
      }
    })
  })

  // ── groupByCategory ───────────────────────────────────────────────────────────

  describe('groupByCategory', () => {
    it('groups transactions by category', () => {
      const result = chartDataUtils.groupByCategory(mockTransactions)

      expect(result).toHaveLength(3)

      const foodCategory = result.find((g) => g.label === 'food')
      expect(foodCategory).toEqual({ label: 'food', value: 125, count: 2 })
    })

    it('handles empty transaction list', () => {
      const result = chartDataUtils.groupByCategory([])

      expect(result).toEqual([])
    })

    it('counts transactions correctly in each category', () => {
      const result = chartDataUtils.groupByCategory(mockTransactions)

      const salary = result.find((g) => g.label === 'salary')
      expect(salary?.count).toBe(1)
      expect(salary?.value).toBe(100)
    })
  })

  // ── calculateRollingAverage ───────────────────────────────────────────────────

  describe('calculateRollingAverage', () => {
    const timeSeriesData: TimeSeriesDataPoint[] = [
      { timestamp: '2024-01-01', value: 10 },
      { timestamp: '2024-01-02', value: 20 },
      { timestamp: '2024-01-03', value: 30 },
      { timestamp: '2024-01-04', value: 40 },
      { timestamp: '2024-01-05', value: 50 },
    ]

    it('calculates rolling average with window size 2', () => {
      const result = chartDataUtils.calculateRollingAverage(timeSeriesData, 2)

      expect(result).toHaveLength(4)
      expect(result[0].value).toBe(15) // (10 + 20) / 2
      expect(result[1].value).toBe(25) // (20 + 30) / 2
    })

    it('calculates rolling average with window size 3', () => {
      const result = chartDataUtils.calculateRollingAverage(timeSeriesData, 3)

      expect(result).toHaveLength(3)
      expect(result[0].value).toBe(20) // (10 + 20 + 30) / 3
    })

    it('handles window size equal to data length', () => {
      const result = chartDataUtils.calculateRollingAverage(timeSeriesData, 5)

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(30) // (10 + 20 + 30 + 40 + 50) / 5
    })

    it('handles empty data', () => {
      const result = chartDataUtils.calculateRollingAverage([], 2)

      expect(result).toEqual([])
    })

    it('throws error for invalid window size', () => {
      expect(() => chartDataUtils.calculateRollingAverage(timeSeriesData, 0)).toThrow('Window size must be positive')
      expect(() => chartDataUtils.calculateRollingAverage(timeSeriesData, -1)).toThrow('Window size must be positive')
    })

    it('handles single data point', () => {
      const single = [{ timestamp: '2024-01-01', value: 42 }]
      const result = chartDataUtils.calculateRollingAverage(single, 1)

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(42)
    })
  })

  // ── filterByDateRange ─────────────────────────────────────────────────────────

  describe('filterByDateRange', () => {
    it('filters transactions within date range', () => {
      const start = new Date('2024-01-02')
      const end = new Date('2024-01-09')

      const result = chartDataUtils.filterByDateRange(mockTransactions, start, end)

      expect(result).toHaveLength(2)
      expect(result.every((t) => {
        const date = typeof t.date === 'string' ? new Date(t.date) : t.date
        return date >= start && date <= end
      })).toBe(true)
    })

    it('handles empty result', () => {
      const start = new Date('2024-12-01')
      const end = new Date('2024-12-31')

      const result = chartDataUtils.filterByDateRange(mockTransactions, start, end)

      expect(result).toEqual([])
    })

    it('handles inclusive date boundaries', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-01-01')

      const result = chartDataUtils.filterByDateRange(mockTransactions, start, end)

      expect(result.length).toBeGreaterThan(0)
    })
  })

  // ── calculateCumulativeSum ────────────────────────────────────────────────────

  describe('calculateCumulativeSum', () => {
    const data: TimeSeriesDataPoint[] = [
      { timestamp: '2024-01-01', value: 10 },
      { timestamp: '2024-01-02', value: 20 },
      { timestamp: '2024-01-03', value: 30 },
    ]

    it('calculates cumulative sum correctly', () => {
      const result = chartDataUtils.calculateCumulativeSum(data)

      expect(result).toHaveLength(3)
      expect(result[0].value).toBe(10)
      expect(result[1].value).toBe(30)
      expect(result[2].value).toBe(60)
    })

    it('handles empty data', () => {
      const result = chartDataUtils.calculateCumulativeSum([])

      expect(result).toEqual([])
    })

    it('handles negative values', () => {
      const negativeData = [
        { timestamp: '2024-01-01', value: 10 },
        { timestamp: '2024-01-02', value: -5 },
        { timestamp: '2024-01-03', value: 3 },
      ]

      const result = chartDataUtils.calculateCumulativeSum(negativeData)

      expect(result[0].value).toBe(10)
      expect(result[1].value).toBe(5)
      expect(result[2].value).toBe(8)
    })

    it('preserves timestamps', () => {
      const result = chartDataUtils.calculateCumulativeSum(data)

      expect(result[0].timestamp).toBe('2024-01-01')
      expect(result[2].timestamp).toBe('2024-01-03')
    })
  })

  // ── normalize ─────────────────────────────────────────────────────────────────

  describe('normalize', () => {
    const data: TimeSeriesDataPoint[] = [
      { timestamp: '2024-01-01', value: 0 },
      { timestamp: '2024-01-02', value: 50 },
      { timestamp: '2024-01-03', value: 100 },
    ]

    it('normalizes values to 0-100 scale', () => {
      const result = chartDataUtils.normalize(data)

      expect(result).toHaveLength(3)
      expect(result[0].value).toBe(0)
      expect(result[1].value).toBe(50)
      expect(result[2].value).toBe(100)
    })

    it('handles empty data', () => {
      const result = chartDataUtils.normalize([])

      expect(result).toEqual([])
    })

    it('handles all same values', () => {
      const sameData = [
        { timestamp: '2024-01-01', value: 42 },
        { timestamp: '2024-01-02', value: 42 },
        { timestamp: '2024-01-03', value: 42 },
      ]

      const result = chartDataUtils.normalize(sameData)

      expect(result.every((p) => p.value === 50)).toBe(true)
    })

    it('normalizes negative values correctly', () => {
      const negativeData = [
        { timestamp: '2024-01-01', value: -100 },
        { timestamp: '2024-01-02', value: 0 },
        { timestamp: '2024-01-03', value: 100 },
      ]

      const result = chartDataUtils.normalize(negativeData)

      expect(result[0].value).toBe(0)
      expect(result[1].value).toBe(50)
      expect(result[2].value).toBe(100)
    })
  })

  // ── calculatePercentageChange ─────────────────────────────────────────────────

  describe('calculatePercentageChange', () => {
    const current = [
      { timestamp: '2024-01-01', value: 100 },
      { timestamp: '2024-01-02', value: 150 },
    ]

    const previous = [
      { timestamp: '2023-12-01', value: 100 },
      { timestamp: '2023-12-02', value: 100 },
    ]

    it('calculates percentage change correctly', () => {
      const result = chartDataUtils.calculatePercentageChange(current, previous)

      expect(result).toBe(25) // (250 - 200) / 200 * 100
    })

    it('handles zero previous period', () => {
      const zeroPrevious = [{ timestamp: '2023-12-01', value: 0 }]

      const result = chartDataUtils.calculatePercentageChange(current, zeroPrevious)

      expect(result).toBe(100)
    })

    it('handles equal periods', () => {
      const result = chartDataUtils.calculatePercentageChange(current, current)

      expect(result).toBe(0)
    })

    it('handles negative change', () => {
      const decreasing = [
        { timestamp: '2024-01-01', value: 50 },
      ]

      const result = chartDataUtils.calculatePercentageChange(decreasing, previous)

      expect(result).toBeLessThan(0)
    })
  })

  // ── aggregateByInterval ───────────────────────────────────────────────────────

  describe('aggregateByInterval', () => {
    const data: TimeSeriesDataPoint[] = [
      { timestamp: '2024-01-01', value: 10 },
      { timestamp: '2024-01-02', value: 20 },
      { timestamp: '2024-01-03', value: 30 },
      { timestamp: '2024-01-04', value: 40 },
      { timestamp: '2024-01-05', value: 50 },
    ]

    it('aggregates data by 2-day intervals', () => {
      const result = chartDataUtils.aggregateByInterval(data, 2)

      expect(result.length).toBeGreaterThan(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('handles empty data', () => {
      const result = chartDataUtils.aggregateByInterval([], 1)

      expect(result).toEqual([])
    })

    it('throws error for invalid interval', () => {
      expect(() => chartDataUtils.aggregateByInterval(data, 0)).toThrow('Interval must be positive')
      expect(() => chartDataUtils.aggregateByInterval(data, -1)).toThrow('Interval must be positive')
    })

    it('returns sorted results', () => {
      const result = chartDataUtils.aggregateByInterval(data, 1)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp)
      }
    })

    it('calculates averages for grouped values', () => {
      const result = chartDataUtils.aggregateByInterval(data, 2)

      expect(result.every((p) => typeof p.value === 'number')).toBe(true)
    })
  })
})

// ── Integration Tests ─────────────────────────────────────────────────────────

describe('chartDataUtils - Integration', () => {
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-01',
      amount: 100,
      type: 'income',
      category: 'salary',
    },
    {
      id: '2',
      date: '2024-01-15',
      amount: 50,
      type: 'expense',
      category: 'food',
    },
    {
      id: '3',
      date: '2024-02-01',
      amount: 100,
      type: 'income',
      category: 'salary',
    },
  ]

  it('chains multiple transformations', () => {
    const weeklyData = chartDataUtils.groupByWeek(mockTransactions)
    const normalized = chartDataUtils.normalize(weeklyData)
    const cumulative = chartDataUtils.calculateCumulativeSum(normalized)

    expect(cumulative.length).toBeGreaterThan(0)
    expect(cumulative[cumulative.length - 1].value).toBeGreaterThan(0)
  })

  it('prepares data for line chart rendering', () => {
    const weeklyData = chartDataUtils.groupByWeek(mockTransactions)
    const withAverage = chartDataUtils.calculateRollingAverage(weeklyData, 1)

    expect(withAverage.length).toBeGreaterThan(0)
    expect(withAverage.every((p) => typeof p.value === 'number')).toBe(true)
  })

  it('prepares data for pie chart rendering', () => {
    const categoryData = chartDataUtils.groupByCategory(mockTransactions)

    expect(Array.isArray(categoryData)).toBe(true)
    expect(categoryData.every((g) => typeof g.value === 'number')).toBe(true)
  })
})
