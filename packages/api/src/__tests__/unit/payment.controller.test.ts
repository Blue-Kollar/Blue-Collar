/**
 * Unit tests for the payment controller (src/controllers/payment.ts).
 * Uses dependency injection to pass in a fake PaymentService, so no real
 * business logic or contracts service is involved.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { createPaymentController } from '../../controllers/payment.js'
import { PaymentService } from '../../services/payment.service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {}
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: any) => {
    res.body = body
    return res
  }
  return res
}

function makeReq(body: Record<string, any> = {}, user?: any): Request {
  return { body, user } as Request
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Payment Controller (DI)', () => {
  let service: PaymentService
  let controller: ReturnType<typeof createPaymentController>

  beforeEach(() => {
    service = new PaymentService(250)
    controller = createPaymentController(service)
  })

  // ── processTip ──────────────────────────────────────────────────────────────

  describe('processTip', () => {
    it('returns 200 with tip breakdown on success', async () => {
      const req = makeReq({ from: 'ALICE', to: 'BOB', amount: 10_000_000 })
      const res = makeRes()

      await controller.processTip(req, res, () => {})

      expect(res.statusCode).toBe(200)
      expect(res.body.status).toBe('success')
      expect(res.body.data.grossAmount).toBe(10_000_000)
      expect(res.body.data.fee).toBe(250_000)
      expect(res.body.data.netAmount).toBe(9_750_000)
    })

    it('throws 400 when "from" is missing', async () => {
      const req = makeReq({ to: 'BOB', amount: 1_000_000 })
      const res = makeRes()

      await expect(controller.processTip(req, res, () => {})).rejects.toThrow('from, to, and amount are required')
    })

    it('throws 400 when "to" is missing', async () => {
      const req = makeReq({ from: 'ALICE', amount: 1_000_000 })
      const res = makeRes()

      await expect(controller.processTip(req, res, () => {})).rejects.toThrow('from, to, and amount are required')
    })

    it('throws 400 when "amount" is missing', async () => {
      const req = makeReq({ from: 'ALICE', to: 'BOB' })
      const res = makeRes()

      await expect(controller.processTip(req, res, () => {})).rejects.toThrow('from, to, and amount are required')
    })

    it('throws AppError when sender equals recipient', async () => {
      const req = makeReq({ from: 'ALICE', to: 'ALICE', amount: 100 })
      const res = makeRes()

      await expect(controller.processTip(req, res, () => {})).rejects.toThrow('Sender and recipient must be different')
    })
  })

  // ── createEscrow ────────────────────────────────────────────────────────────

  describe('createEscrow', () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString()

    it('returns 201 with escrow on success', async () => {
      const req = makeReq({ from: 'A', to: 'B', amount: 1_000, expiryDate: futureDate })
      const res = makeRes()

      await controller.createEscrow(req, res, () => {})

      expect(res.statusCode).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data.amount).toBe(1_000)
      expect(res.body.data.status).toBe('pending')
    })

    it('throws 400 when "from" is missing', async () => {
      const req = makeReq({ to: 'B', amount: 1_000, expiryDate: futureDate })
      const res = makeRes()

      await expect(controller.createEscrow(req, res, () => {})).rejects.toThrow(
        'from, to, amount, and expiryDate are required'
      )
    })

    it('throws 400 when "to" is missing', async () => {
      const req = makeReq({ from: 'A', amount: 1_000, expiryDate: futureDate })
      const res = makeRes()

      await expect(controller.createEscrow(req, res, () => {})).rejects.toThrow(
        'from, to, amount, and expiryDate are required'
      )
    })

    it('throws 400 when "amount" is missing', async () => {
      const req = makeReq({ from: 'A', to: 'B', expiryDate: futureDate })
      const res = makeRes()

      await expect(controller.createEscrow(req, res, () => {})).rejects.toThrow(
        'from, to, amount, and expiryDate are required'
      )
    })

    it('throws 400 when "expiryDate" is missing', async () => {
      const req = makeReq({ from: 'A', to: 'B', amount: 1_000 })
      const res = makeRes()

      await expect(controller.createEscrow(req, res, () => {})).rejects.toThrow(
        'from, to, amount, and expiryDate are required'
      )
    })

    it('throws when expiry is in the past', async () => {
      const pastDate = new Date(Date.now() - 1_000).toISOString()
      const req = makeReq({ from: 'A', to: 'B', amount: 100, expiryDate: pastDate })
      const res = makeRes()

      await expect(controller.createEscrow(req, res, () => {})).rejects.toThrow('Escrow expiry must be in the future')
    })
  })

  // ── getFee ──────────────────────────────────────────────────────────────────

  describe('getFee', () => {
    it('returns 200 with current fee in basis points', () => {
      const req = makeReq()
      const res = makeRes()

      controller.getFee(req, res, () => {})

      expect(res.statusCode).toBe(200)
      expect(res.body.status).toBe('success')
      expect(res.body.data.fee_bps).toBe(250)
    })
  })

  // ── updateFee ───────────────────────────────────────────────────────────────

  describe('updateFee', () => {
    it('returns 200 with updated fee when admin', async () => {
      const req = makeReq({ fee_bps: 100 }, { id: 'admin-1', role: 'admin' })
      const res = makeRes()

      await controller.updateFee(req, res, () => {})

      expect(res.statusCode).toBe(200)
      expect(res.body.status).toBe('success')
      expect(res.body.data.fee_bps).toBe(100)
    })

    it('throws 400 when fee_bps is missing', async () => {
      const req = makeReq({}, { id: 'admin-1', role: 'admin' })
      const res = makeRes()

      await expect(controller.updateFee(req, res, () => {})).rejects.toThrow('fee_bps is required')
    })

    it('throws 403 when user is not admin', async () => {
      const req = makeReq({ fee_bps: 100 }, { id: 'user-1', role: 'user' })
      const res = makeRes()

      await expect(controller.updateFee(req, res, () => {})).rejects.toThrow('Only admins can update the fee')
    })

    it('throws 400 when fee_bps is out of range', async () => {
      const req = makeReq({ fee_bps: 10_001 }, { id: 'admin-1', role: 'admin' })
      const res = makeRes()

      await expect(controller.updateFee(req, res, () => {})).rejects.toThrow('fee_bps must be between 0 and 10000')
    })
  })
})
