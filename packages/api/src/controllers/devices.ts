import { Request, Response } from 'express'
import * as deviceService from '../services/device.service.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'

/**
 * List all active devices for the authenticated user
 */
export const listDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const devices = await deviceService.listDevices(userId)
  res.json({ data: devices, status: 'success' })
})

/**
 * Revoke a specific device
 */
export const revokeDevice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const { deviceId } = req.params
  await deviceService.revokeDevice(deviceId, userId)
  res.json({ data: { success: true }, status: 'success', message: 'Device revoked' })
})

/**
 * Revoke all other devices (keep current session active)
 */
export const revokeAllOtherDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const { currentDeviceId } = req.body
  if (!currentDeviceId) throw new AppError('currentDeviceId is required', 400, true, ErrorCode.VALIDATION_ERROR)
  await deviceService.revokeAllOtherDevices(userId, currentDeviceId)
  res.json({ data: { success: true }, status: 'success', message: 'All other devices revoked' })
})
