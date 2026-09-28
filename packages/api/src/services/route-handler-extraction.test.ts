import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../utils/AppError.js'

vi.mock('../repositories/payment.repository.js', () => ({
  paymentRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('../repositories/escrow.repository.js', () => ({
  escrowRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('../queue/index.js', () => ({
  enqueueNotification: vi.fn(),
}))

import { paymentRepository } from '../repositories/payment.repository.js'
import { escrowRepository } from '../repositories/escrow.repository.js'
import { enqueueNotification } from '../queue/index.js'

// Mock business logic service that would be extracted from routes
export const paymentService = {
  async validatePayment(amount: number, currency: string) {
    if (amount <= 0) throw new AppError('Amount must be positive', 400)
    if (!['USD', 'EUR', 'GBP'].includes(currency)) throw new AppError('Unsupported currency', 400)
    return true
  },

  async processPayment(input: any) {
    const { paymentId, amount, currency } = input

    if (!paymentId) throw new AppError('Payment ID required', 400)

    await this.validatePayment(amount, currency)

    const payment = await paymentRepository.findById(paymentId)
    if (!payment) throw new AppError('Payment not found', 404)

    const updated = await paymentRepository.updateStatus(paymentId, 'processing')
    await enqueueNotification('payment.started', { paymentId })

    return updated
  },

  async refundPayment(paymentId: string) {
    if (!paymentId) throw new AppError('Payment ID required', 400)

    const payment = await paymentRepository.findById(paymentId)
    if (!payment) throw new AppError('Payment not found', 404)
    if (payment.status !== 'completed') throw new AppError('Only completed payments can be refunded', 409)

    const updated = await paymentRepository.updateStatus(paymentId, 'refunded')
    await enqueueNotification('payment.refunded', { paymentId })

    return updated
  },
}

export const escrowService = {
  async releaseEscrow(escrowId: string, releaseReason: string) {
    if (!escrowId) throw new AppError('Escrow ID required', 400)
    if (!releaseReason) throw new AppError('Release reason required', 400)

    const escrow = await escrowRepository.findById(escrowId)
    if (!escrow) throw new AppError('Escrow not found', 404)
    if (escrow.status !== 'held') throw new AppError('Only held escrows can be released', 409)

    const updated = await escrowRepository.updateStatus(escrowId, 'released', { releaseReason })
    await enqueueNotification('escrow.released', { escrowId, reason: releaseReason })

    return updated
  },

  async cancelEscrow(escrowId: string, cancellationReason: string) {
    if (!escrowId) throw new AppError('Escrow ID required', 400)

    const escrow = await escrowRepository.findById(escrowId)
    if (!escrow) throw new AppError('Escrow not found', 404)
    if (!['held', 'pending'].includes(escrow.status)) {
      throw new AppError('Only held or pending escrows can be cancelled', 409)
    }

    const updated = await escrowRepository.updateStatus(escrowId, 'cancelled', { cancellationReason })
    await enqueueNotification('escrow.cancelled', { escrowId })

    return updated
  },
}

// ── Test Suite ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Payment Service Tests ─────────────────────────────────────────────────────

describe('paymentService', () => {
  describe('validatePayment', () => {
    it('validates positive amounts', async () => {
      const result = await paymentService.validatePayment(100, 'USD')
      expect(result).toBe(true)
    })

    it('rejects zero amount', async () => {
      await expect(paymentService.validatePayment(0, 'USD')).rejects.toThrow('Amount must be positive')
    })

    it('rejects negative amount', async () => {
      await expect(paymentService.validatePayment(-50, 'USD')).rejects.toThrow('Amount must be positive')
    })

    it('accepts supported currencies', async () => {
      for (const currency of ['USD', 'EUR', 'GBP']) {
        await expect(paymentService.validatePayment(100, currency)).resolves.toBe(true)
      }
    })

    it('rejects unsupported currency', async () => {
      await expect(paymentService.validatePayment(100, 'XXX')).rejects.toThrow('Unsupported currency')
    })
  })

  describe('processPayment', () => {
    it('processes valid payment', async () => {
      const paymentId = 'pay-123'
      ;(paymentRepository.findById as any).mockResolvedValue({ id: paymentId, status: 'pending', amount: 100 })
      ;(paymentRepository.updateStatus as any).mockResolvedValue({ id: paymentId, status: 'processing' })

      const result = await paymentService.processPayment({ paymentId, amount: 100, currency: 'USD' })

      expect(result.status).toBe('processing')
      expect(paymentRepository.updateStatus).toHaveBeenCalledWith(paymentId, 'processing')
      expect(enqueueNotification).toHaveBeenCalledWith('payment.started', { paymentId })
    })

    it('throws error when payment ID is missing', async () => {
      await expect(paymentService.processPayment({ amount: 100, currency: 'USD' })).rejects.toThrow('Payment ID required')
    })

    it('throws error when payment not found', async () => {
      ;(paymentRepository.findById as any).mockResolvedValue(null)

      await expect(paymentService.processPayment({ paymentId: 'invalid', amount: 100, currency: 'USD' })).rejects.toThrow('Payment not found')
    })

    it('validates amount and currency during processing', async () => {
      await expect(paymentService.processPayment({ paymentId: 'pay-1', amount: -10, currency: 'USD' })).rejects.toThrow()
    })
  })

  describe('refundPayment', () => {
    it('refunds completed payment', async () => {
      const paymentId = 'pay-456'
      ;(paymentRepository.findById as any).mockResolvedValue({ id: paymentId, status: 'completed' })
      ;(paymentRepository.updateStatus as any).mockResolvedValue({ id: paymentId, status: 'refunded' })

      const result = await paymentService.refundPayment(paymentId)

      expect(result.status).toBe('refunded')
      expect(enqueueNotification).toHaveBeenCalledWith('payment.refunded', { paymentId })
    })

    it('throws error when payment not found', async () => {
      ;(paymentRepository.findById as any).mockResolvedValue(null)

      await expect(paymentService.refundPayment('invalid')).rejects.toThrow('Payment not found')
    })

    it('throws error when refunding non-completed payment', async () => {
      ;(paymentRepository.findById as any).mockResolvedValue({ id: 'pay-1', status: 'pending' })

      await expect(paymentService.refundPayment('pay-1')).rejects.toThrow('Only completed payments can be refunded')
    })

    it('requires payment ID', async () => {
      await expect(paymentService.refundPayment('')).rejects.toThrow('Payment ID required')
    })
  })
})

// ── Escrow Service Tests ──────────────────────────────────────────────────────

describe('escrowService', () => {
  describe('releaseEscrow', () => {
    it('releases held escrow with reason', async () => {
      const escrowId = 'esc-123'
      ;(escrowRepository.findById as any).mockResolvedValue({ id: escrowId, status: 'held' })
      ;(escrowRepository.updateStatus as any).mockResolvedValue({ id: escrowId, status: 'released' })

      const result = await escrowService.releaseEscrow(escrowId, 'job_completed')

      expect(result.status).toBe('released')
      expect(escrowRepository.updateStatus).toHaveBeenCalledWith(escrowId, 'released', { releaseReason: 'job_completed' })
      expect(enqueueNotification).toHaveBeenCalledWith('escrow.released', { escrowId, reason: 'job_completed' })
    })

    it('throws error when escrow not found', async () => {
      ;(escrowRepository.findById as any).mockResolvedValue(null)

      await expect(escrowService.releaseEscrow('invalid', 'reason')).rejects.toThrow('Escrow not found')
    })

    it('throws error when escrow is not held', async () => {
      ;(escrowRepository.findById as any).mockResolvedValue({ id: 'esc-1', status: 'released' })

      await expect(escrowService.releaseEscrow('esc-1', 'reason')).rejects.toThrow('Only held escrows can be released')
    })

    it('requires escrow ID', async () => {
      await expect(escrowService.releaseEscrow('', 'reason')).rejects.toThrow('Escrow ID required')
    })

    it('requires release reason', async () => {
      await expect(escrowService.releaseEscrow('esc-1', '')).rejects.toThrow('Release reason required')
    })
  })

  describe('cancelEscrow', () => {
    it('cancels held escrow', async () => {
      const escrowId = 'esc-456'
      ;(escrowRepository.findById as any).mockResolvedValue({ id: escrowId, status: 'held' })
      ;(escrowRepository.updateStatus as any).mockResolvedValue({ id: escrowId, status: 'cancelled' })

      const result = await escrowService.cancelEscrow(escrowId, 'dispute_resolution')

      expect(result.status).toBe('cancelled')
      expect(enqueueNotification).toHaveBeenCalledWith('escrow.cancelled', { escrowId })
    })

    it('cancels pending escrow', async () => {
      ;(escrowRepository.findById as any).mockResolvedValue({ id: 'esc-1', status: 'pending' })
      ;(escrowRepository.updateStatus as any).mockResolvedValue({ id: 'esc-1', status: 'cancelled' })

      const result = await escrowService.cancelEscrow('esc-1', 'reason')

      expect(result.status).toBe('cancelled')
    })

    it('throws error when cancelling released escrow', async () => {
      ;(escrowRepository.findById as any).mockResolvedValue({ id: 'esc-1', status: 'released' })

      await expect(escrowService.cancelEscrow('esc-1', 'reason')).rejects.toThrow('Only held or pending escrows can be cancelled')
    })

    it('requires escrow ID', async () => {
      await expect(escrowService.cancelEscrow('', 'reason')).rejects.toThrow('Escrow ID required')
    })
  })
})
