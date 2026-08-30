import * as deviceRepo from '../repositories/device.repository.js'
import { AppError } from '../utils/AppError.js'

export async function registerDevice(userId: string, deviceName: string, userAgent: string | undefined, ipAddress: string) {
  return deviceRepo.createDevice(userId, deviceName, userAgent, ipAddress)
}

export async function listDevices(userId: string) {
  return deviceRepo.listActiveDevices(userId)
}

export async function revokeDevice(deviceId: string, userId: string) {
  const device = await (await import('../db.js')).db.device.findUnique({ where: { id: deviceId } })
  if (!device || device.userId !== userId) {
    throw new AppError('Device not found', 404)
  }
  return deviceRepo.revokeDevice(deviceId)
}

export async function revokeAllOtherDevices(userId: string, currentDeviceId: string) {
  return deviceRepo.revokeAllDevicesExcept(userId, currentDeviceId)
}

export async function updateLastUsed(deviceId: string) {
  return deviceRepo.updateDeviceLastUsed(deviceId)
}
