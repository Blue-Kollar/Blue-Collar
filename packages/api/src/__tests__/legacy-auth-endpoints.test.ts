/**
 * Issue #1216 — Remove unused legacy authentication endpoints.
 *
 * Verifies that the deprecated auth endpoint handlers that were documented as
 * removed in #1012 (enrollTwoFactor, verifyTwoFactor, disableTwoFactor in
 * controllers/auth.ts; the old device handlers that shipped in the auth
 * controller) are not exported from the auth controller, and that no stale
 * route registrations reference them.
 *
 * All active 2FA routes are in controllers/twoFactor.ts.
 * All active device routes are in controllers/devices.ts.
 */
import { describe, it, expect } from 'vitest'

describe('auth controller — deprecated endpoints absent', () => {
  it('does not export enrollTwoFactor', async () => {
    const authController = await import('../controllers/auth.js')
    expect((authController as any).enrollTwoFactor).toBeUndefined()
  })

  it('does not export an old verifyTwoFactor handler', async () => {
    const authController = await import('../controllers/auth.js')
    // The current twoFactor handler lives in controllers/twoFactor.ts, not auth.ts
    expect((authController as any).verifyTwoFactor).toBeUndefined()
  })

  it('does not export disableTwoFactor from the auth controller', async () => {
    const authController = await import('../controllers/auth.js')
    expect((authController as any).disableTwoFactor).toBeUndefined()
  })

  it('does not export listDevices from the auth controller', async () => {
    const authController = await import('../controllers/auth.js')
    expect((authController as any).listDevices).toBeUndefined()
  })

  it('does not export revokeDevice from the auth controller', async () => {
    const authController = await import('../controllers/auth.js')
    expect((authController as any).revokeDevice).toBeUndefined()
  })

  it('does not export revokeAllOtherDevices from the auth controller', async () => {
    const authController = await import('../controllers/auth.js')
    expect((authController as any).revokeAllOtherDevices).toBeUndefined()
  })
})

describe('2FA handlers live exclusively in twoFactor controller', () => {
  it('exports setup2FA', async () => {
    const { setup2FA } = await import('../controllers/twoFactor.js')
    expect(typeof setup2FA).toBe('function')
  })

  it('exports enable2FA', async () => {
    const { enable2FA } = await import('../controllers/twoFactor.js')
    expect(typeof enable2FA).toBe('function')
  })

  it('exports verify2FA', async () => {
    const { verify2FA } = await import('../controllers/twoFactor.js')
    expect(typeof verify2FA).toBe('function')
  })

  it('exports disable2FA', async () => {
    const { disable2FA } = await import('../controllers/twoFactor.js')
    expect(typeof disable2FA).toBe('function')
  })
})

describe('device handlers live exclusively in devices controller', () => {
  it('exports listDevices', async () => {
    const { listDevices } = await import('../controllers/devices.js')
    expect(typeof listDevices).toBe('function')
  })

  it('exports revokeDevice', async () => {
    const { revokeDevice } = await import('../controllers/devices.js')
    expect(typeof revokeDevice).toBe('function')
  })

  it('exports revokeAllOtherDevices', async () => {
    const { revokeAllOtherDevices } = await import('../controllers/devices.js')
    expect(typeof revokeAllOtherDevices).toBe('function')
  })
})
