import { describe, expect,it } from 'vitest'

import { QueryBuilder } from './queryBuilder.js'

describe('QueryBuilder', () => {
  describe('pagination', () => {
    it('should return default pagination values', () => {
      const result = QueryBuilder.pagination()
      expect(result).toEqual({ skip: 0, take: 20 })
    })

    it('should accept custom pagination values', () => {
      const result = QueryBuilder.pagination({ skip: 10, take: 50 })
      expect(result).toEqual({ skip: 10, take: 50 })
    })

    it('should cap take at 100', () => {
      const result = QueryBuilder.pagination({ take: 200 })
      expect(result.take).toBe(100)
    })
  })

  describe('defaultSort', () => {
    it('should return createdAt descending', () => {
      const result = QueryBuilder.defaultSort()
      expect(result).toEqual({ createdAt: 'desc' })
    })
  })

  describe('sort', () => {
    it('should return valid sort field', () => {
      const result = QueryBuilder.sort('name', 'asc')
      expect(result).toEqual({ name: 'asc' })
    })

    it('should default to createdAt for invalid field', () => {
      const result = QueryBuilder.sort('invalid', 'asc')
      expect(result).toEqual({ createdAt: 'asc' })
    })

    it('should default to desc order', () => {
      const result = QueryBuilder.sort('name')
      expect(result).toEqual({ name: 'desc' })
    })
  })

  describe('filter', () => {
    it('should return empty object for no conditions', () => {
      const result = QueryBuilder.filter()
      expect(result).toEqual({})
    })

    it('should include non-null conditions', () => {
      const result = QueryBuilder.filter({ isActive: true, name: 'test' })
      expect(result).toEqual({ isActive: true, name: 'test' })
    })

    it('should exclude null and undefined values', () => {
      const result = QueryBuilder.filter({ isActive: true, name: null, email: undefined })
      expect(result).toEqual({ isActive: true })
    })
  })

  describe('buildQuery', () => {
    it('should build complete query with all options', () => {
      const result = QueryBuilder.buildQuery({
        pagination: { skip: 5, take: 10 },
        filter: { isActive: true },
        sort: { field: 'name', order: 'asc' },
      })
      expect(result).toEqual({
        skip: 5,
        take: 10,
        where: { isActive: true },
        orderBy: { name: 'asc' },
      })
    })

    it('should use defaults when options not provided', () => {
      const result = QueryBuilder.buildQuery()
      expect(result).toEqual({
        skip: 0,
        take: 20,
        where: {},
        orderBy: { createdAt: 'desc' },
      })
    })
  })
})
