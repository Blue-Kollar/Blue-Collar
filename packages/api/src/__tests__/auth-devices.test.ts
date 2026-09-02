import request from 'supertest'
import { afterAll,beforeAll, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { db } from '../db.js'

describe('Device Management (Issue #749)', () => {
  let accessToken: string
  let deviceId: string
  let userId: string

  beforeAll(async () => {
    // Register and login a test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: `device-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Device',
        lastName: 'Test',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: `device-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
      })

    accessToken = loginRes.body.token
    deviceId = loginRes.body.deviceId
    userId = loginRes.body.data.id
  })

  it('should register device on login', () => {
    expect(deviceId).toBeDefined()
    expect(deviceId).toMatch(/^[a-z0-9]+$/)
  })

  it('should list active devices', async () => {
    const res = await request(app)
      .get('/api/auth/devices')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('deviceName')
    expect(res.body.data[0]).toHaveProperty('ipAddress')
    expect(res.body.data[0]).toHaveProperty('lastUsedAt')
  })

  it('should revoke a device', async () => {
    const res = await request(app)
      .delete(`/api/auth/devices/${deviceId}`)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.success).toBe(true)
  })

  it('should revoke all other devices', async () => {
    // Create another login to get a second device
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: `device-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
      })

    const newAccessToken = loginRes.body.token
    const currentDeviceId = loginRes.body.deviceId

    // Revoke all others
    const res = await request(app)
      .post('/api/auth/devices/revoke-others')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .send({ currentDeviceId })

    expect(res.status).toBe(200)
    expect(res.body.data.success).toBe(true)

    // Verify only current device remains
    const devicesRes = await request(app)
      .get('/api/auth/devices')
      .set('Authorization', `Bearer ${newAccessToken}`)

    expect(devicesRes.body.data.length).toBe(1)
    expect(devicesRes.body.data[0].id).toBe(currentDeviceId)
  })

  afterAll(async () => {
    // Cleanup
    await db.user.deleteMany({ where: { email: { contains: 'device-test' } } })
  })
})
