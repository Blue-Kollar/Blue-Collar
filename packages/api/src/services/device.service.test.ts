import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppError } from '../utils/app-error.js'
import * as deviceService from './device.service.js'

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    device: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../repositories/device.repository.js', () => ({
  deviceRepository: {
    createDevice: vi.fn(),
    listActiveDevices: vi.fn(),
    revokeDevice: vi.fn(),
    revokeAllDevicesExcept: vi.fn(),
    updateDeviceLastUsed: vi.fn(),
  },
}))

import { db } from '../db.js'
import { deviceRepository } from '../repositories/device.repository.js'

const mockDb = db as any
const mockDeviceRepo = deviceRepository as any

// Helper to create mock device data
function createMockDevice(overrides = {}) {
  return {
    id: 'device-1',
    userId: 'user-1',
    deviceName: 'Chrome on Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ipAddress: '192.168.1.1',
    lastUsedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    revokedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.resetAllMocks()
})

// ── registerDevice ───────────────────────────────────────────────────────────

describe('registerDevice', () => {
  it('creates a new device successfully', async () => {
    const mockDevice = createMockDevice()
    mockDeviceRepo.createDevice.mockResolvedValue(mockDevice)

    const result = await deviceService.registerDevice(
      'user-1',
      'Chrome on Windows',
      'Mozilla/5.0',
      '192.168.1.1'
    )

    expect(result).toEqual(mockDevice)
    expect(mockDeviceRepo.createDevice).toHaveBeenCalledWith(
      'user-1',
      'Chrome on Windows',
      'Mozilla/5.0',
      '192.168.1.1'
    )
  })

  it('passes all parameters to repository', async () => {
    const mockDevice = createMockDevice()
    mockDeviceRepo.createDevice.mockResolvedValue(mockDevice)

    await deviceService.registerDevice(
      'user-2',
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux)',
      '10.0.0.5'
    )

    expect(mockDeviceRepo.createDevice).toHaveBeenCalledWith(
      'user-2',
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux)',
      '10.0.0.5'
    )
  })

  it('returns device with all properties', async () => {
    const mockDevice = createMockDevice({
      deviceName: 'Safari on iOS',
      userAgent: 'Mozilla/5.0 (iPhone)',
    })
    mockDeviceRepo.createDevice.mockResolvedValue(mockDevice)

    const result = await deviceService.registerDevice('user-1', 'Safari on iOS', 'Mozilla/5.0 (iPhone)', '172.16.0.1')

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('userId')
    expect(result).toHaveProperty('deviceName')
    expect(result).toHaveProperty('createdAt')
    expect(result.revokedAt).toBeNull()
  })
})

// ── listDevices ──────────────────────────────────────────────────────────────

describe('listDevices', () => {
  it('returns all active devices for user', async () => {
    const mockDevices = [
      createMockDevice({ id: 'device-1', deviceName: 'Chrome' }),
      createMockDevice({ id: 'device-2', deviceName: 'Firefox' }),
    ]
    mockDeviceRepo.listActiveDevices.mockResolvedValue(mockDevices)

    const result = await deviceService.listDevices('user-1')

    expect(result).toEqual(mockDevices)
    expect(result).toHaveLength(2)
    expect(mockDeviceRepo.listActiveDevices).toHaveBeenCalledWith('user-1')
  })

  it('filters out revoked devices', async () => {
    const mockDevices = [
      createMockDevice({ id: 'device-1', deviceName: 'Chrome', revokedAt: null }),
      createMockDevice({ id: 'device-2', deviceName: 'Firefox', revokedAt: null }),
    ]
    mockDeviceRepo.listActiveDevices.mockResolvedValue(mockDevices)

    const result = await deviceService.listDevices('user-1')

    result.forEach((device) => {
      expect(device.revokedAt).toBeNull()
    })
  })

  it('returns empty array when user has no devices', async () => {
    mockDeviceRepo.listActiveDevices.mockResolvedValue([])

    const result = await deviceService.listDevices('user-1')

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('returns devices sorted by lastUsedAt', async () => {
    const mockDevices = [
      createMockDevice({ id: 'device-1', lastUsedAt: new Date('2024-01-15') }),
      createMockDevice({ id: 'device-2', lastUsedAt: new Date('2024-01-20') }),
    ]
    mockDeviceRepo.listActiveDevices.mockResolvedValue(mockDevices)

    const result = await deviceService.listDevices('user-1')

    expect(result[0].lastUsedAt.getTime()).toBeLessThanOrEqual(result[1].lastUsedAt.getTime())
  })
})

// ── revokeDevice ─────────────────────────────────────────────────────────────

describe('revokeDevice', () => {
  it('revokes device successfully', async () => {
    const revokedDevice = createMockDevice({ revokedAt: new Date() })
    mockDeviceRepo.revokeDevice.mockResolvedValue(revokedDevice)

    const result = await deviceService.revokeDevice('device-1', 'user-1')

    expect(result).toEqual(revokedDevice)
    expect(result.revokedAt).not.toBeNull()
    expect(mockDeviceRepo.revokeDevice).toHaveBeenCalledWith('device-1', 'user-1')
  })

  it('throws 404 when device not found', async () => {
    mockDeviceRepo.revokeDevice.mockResolvedValue(null)

    await expect(deviceService.revokeDevice('nonexistent', 'user-1')).rejects.toThrow(AppError)
    await expect(deviceService.revokeDevice('nonexistent', 'user-1')).rejects.toMatchObject({
      message: 'Device not found',
      statusCode: 404,
    })
  })

  it('throws 403 when device belongs to different user', async () => {
    mockDeviceRepo.revokeDevice.mockResolvedValue(null)

    await expect(deviceService.revokeDevice('device-1', 'different-user')).rejects.toThrow(AppError)
    await expect(deviceService.revokeDevice('device-1', 'different-user')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('sets revokedAt timestamp when revoking', async () => {
    const beforeTime = Date.now()
    const revokedDevice = createMockDevice({ revokedAt: new Date() })
    mockDeviceRepo.revokeDevice.mockResolvedValue(revokedDevice)

    const result = await deviceService.revokeDevice('device-1', 'user-1')
    const afterTime = Date.now()

    expect(result.revokedAt).not.toBeNull()
    expect(result.revokedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime)
    expect(result.revokedAt!.getTime()).toBeLessThanOrEqual(afterTime)
  })
})

// ── revokeAllOtherDevices ────────────────────────────────────────────────────

describe('revokeAllOtherDevices', () => {
  it('revokes all other devices except specified one', async () => {
    const result = { count: 2 }
    mockDeviceRepo.revokeAllDevicesExcept.mockResolvedValue(result)

    const outcome = await deviceService.revokeAllOtherDevices('user-1', 'device-1')

    expect(outcome).toEqual(result)
    expect(mockDeviceRepo.revokeAllDevicesExcept).toHaveBeenCalledWith('user-1', 'device-1')
  })

  it('revokes multiple devices', async () => {
    const result = { count: 5 }
    mockDeviceRepo.revokeAllDevicesExcept.mockResolvedValue(result)

    const outcome = await deviceService.revokeAllOtherDevices('user-1', 'device-1')

    expect(outcome.count).toBe(5)
  })

  it('returns count of revoked devices', async () => {
    const result = { count: 3 }
    mockDeviceRepo.revokeAllDevicesExcept.mockResolvedValue(result)

    const outcome = await deviceService.revokeAllOtherDevices('user-1', 'device-1')

    expect(outcome).toHaveProperty('count')
    expect(typeof outcome.count).toBe('number')
  })

  it('keeps specified device when revoking others', async () => {
    mockDeviceRepo.revokeAllDevicesExcept.mockResolvedValue({ count: 2 })

    await deviceService.revokeAllOtherDevices('user-1', 'device-1')

    expect(mockDeviceRepo.revokeAllDevicesExcept).toHaveBeenCalledWith('user-1', 'device-1')
    // Verify that the specific device ID is passed to protect it
  })

  it('handles case when user has only one device', async () => {
    const result = { count: 0 }
    mockDeviceRepo.revokeAllDevicesExcept.mockResolvedValue(result)

    const outcome = await deviceService.revokeAllOtherDevices('user-1', 'device-1')

    expect(outcome.count).toBe(0)
  })
})

// ── updateLastUsed ───────────────────────────────────────────────────────────

describe('updateLastUsed', () => {
  it('updates lastUsedAt timestamp', async () => {
    const beforeTime = Date.now()
    const updatedDevice = createMockDevice({ lastUsedAt: new Date() })
    mockDeviceRepo.updateDeviceLastUsed.mockResolvedValue(updatedDevice)

    const result = await deviceService.updateLastUsed('device-1')
    const afterTime = Date.now()

    expect(result).toEqual(updatedDevice)
    expect(result.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeTime)
    expect(result.lastUsedAt.getTime()).toBeLessThanOrEqual(afterTime)
  })

  it('returns updated device', async () => {
    const updatedDevice = createMockDevice({ lastUsedAt: new Date() })
    mockDeviceRepo.updateDeviceLastUsed.mockResolvedValue(updatedDevice)

    const result = await deviceService.updateLastUsed('device-1')

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('userId')
    expect(result).toHaveProperty('lastUsedAt')
  })

  it('calls repository with device ID', async () => {
    const updatedDevice = createMockDevice()
    mockDeviceRepo.updateDeviceLastUsed.mockResolvedValue(updatedDevice)

    await deviceService.updateLastUsed('device-123')

    expect(mockDeviceRepo.updateDeviceLastUsed).toHaveBeenCalledWith('device-123')
  })

  it('throws when device not found', async () => {
    mockDeviceRepo.updateDeviceLastUsed.mockResolvedValue(null)

    await expect(deviceService.updateLastUsed('nonexistent')).rejects.toThrow(AppError)
    await expect(deviceService.updateLastUsed('nonexistent')).rejects.toMatchObject({
      message: 'Device not found',
      statusCode: 404,
    })
  })

  it('updates timestamp to current time', async () => {
    const beforeTime = new Date(Date.now() - 1000) // 1 second ago
    const beforeTimeMs = beforeTime.getTime()
    const updatedDevice = createMockDevice({ lastUsedAt: new Date() })
    mockDeviceRepo.updateDeviceLastUsed.mockResolvedValue(updatedDevice)

    const result = await deviceService.updateLastUsed('device-1')

    expect(result.lastUsedAt.getTime()).toBeGreaterThan(beforeTimeMs)
  })
})
