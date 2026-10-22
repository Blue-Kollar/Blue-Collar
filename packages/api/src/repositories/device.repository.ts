import { db } from '@/db.js'

export async function createDevice(userId: string, deviceName: string, userAgent: string | undefined, ipAddress: string) {
  return db.device.create({
    data: { userId, deviceName, userAgent, ipAddress },
  })
}

export async function listActiveDevices(userId: string) {
  return db.device.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, deviceName: true, userAgent: true, ipAddress: true, lastUsedAt: true, createdAt: true },
  })
}

export async function revokeDevice(deviceId: string) {
  return db.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllDevicesExcept(userId: string, deviceIdToKeep: string) {
  return db.device.updateMany({
    where: { userId, id: { not: deviceIdToKeep }, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function updateDeviceLastUsed(deviceId: string) {
  return db.device.update({
    where: { id: deviceId },
    data: { lastUsedAt: new Date() },
  })
}
