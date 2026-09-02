import { Router } from 'express'

import { listDevices, revokeAllOtherDevices,revokeDevice } from '../controllers/devices.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { revokeOtherDevicesRules } from '../validations/device.js'

const router = Router()

// List all active devices for the user
router.get('/devices', authenticate, listDevices)

// Revoke a specific device
router.delete('/devices/:deviceId', authenticate, revokeDevice)

// Revoke all other devices (logout from all other sessions)
router.post('/devices/revoke-others', authenticate, validate(revokeOtherDevicesRules), revokeAllOtherDevices)

export default router
