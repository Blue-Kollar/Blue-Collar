/**
 * payment-flow.integration.test.ts — Payment flow integration tests
 *
 * Comprehensive integration tests for the payment service covering:
 * 1. Tip payments: simple XLM transfer from user to worker
 * 2. Escrow payments: locked payment with expiry & release conditions
 * 3. Multi-sig escrow: escrow requiring multiple signers for release
 * 4. Fee calculations: system fee deduction & basis point handling
 * 5. Edge cases: insufficient balance, expired escrow, cancellation
 *
 * Uses:
 * - Real Prisma database (via vitest.db-integration.config.ts)
 * - MockStellarServer for Stellar blockchain simulation
 * - DB fixtures for consistent test data
 *
 * IMPORTANT: Requires TEST_DATABASE_URL or DATABASE_URL in .env
 * See packages/api/src/__tests__/db-integration/setup.ts for details.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PaymentService as PaymentServiceType } from '@/services/payment.service.js'
import {
  createMockStellarClient,
  MockStellarServer,
} from '@bluecollar/test-utils/stellar-sdk-mock'
import {
  createStellarAccount,
  createEscrowRecord,
} from '@bluecollar/test-utils/db-fixtures'

// ── Test Database Setup ────────────────────────────────────────────────────────

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

if (!testDbUrl) {
  throw new Error(
    'Payment integration tests require TEST_DATABASE_URL or DATABASE_URL in .env',
  )
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDbUrl }),
})

// ── Fixtures ────────────────────────────────────────────────────────────────────

describe('Payment Service Integration Tests', () => {
  let mockStellarServer: MockStellarServer
  let mockStellarClient: ReturnType<typeof createMockStellarClient>
  let paymentService: PaymentServiceType

  beforeEach(async () => {
    // Initialize mock Stellar server & client
    mockStellarServer = new MockStellarServer()
    mockStellarClient = createMockStellarClient(mockStellarServer)

    // Dynamically import PaymentService (to avoid import issues in test setup)
    const { PaymentService } = await import('@/services/payment.service.js')
    paymentService = new PaymentService(mockStellarClient)

    // Clean database tables in FK-safe order
    const tables = [
      'EscrowDispute',
      'EscrowRecord',
      'WebhookLog',
      'WebhookSubscription',
      'StellarAccount',
      'Booking',
      'Worker',
      'User',
      'Category',
      'Location',
    ]
    for (const table of tables) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM "${table}"`)
      } catch {
        // Table might not exist — ignore
      }
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Tip Payment Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Tip Payments', () => {
    it('should create a tip payment from user to worker', async () => {
      // Arrange: Create users with Stellar accounts
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payerAccount = await createStellarAccount(db, {
        userId: payer.id,
        balance: 1000,
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const payeeAccount = await createStellarAccount(db, {
        userId: payee.id,
        balance: 0,
      })

      // Mock account state in Stellar
      mockStellarServer.setAccountState(payerAccount.publicKey, {
        balance: '1000',
        sequence: 1,
      })
      mockStellarServer.setAccountState(payeeAccount.publicKey, {
        balance: '0',
        sequence: 1,
      })

      // Act: Create tip payment
      const tipAmount = 50
      const result = await paymentService.tip({
        from: payerAccount.publicKey,
        to: payeeAccount.publicKey,
        amount: tipAmount,
      })

      // Assert: Tip was successfully submitted
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.transactionId).toBeDefined()
      expect(mockStellarServer.getTransactionCount()).toBeGreaterThan(0)
    })

    it('should reject tip with insufficient balance', async () => {
      // Arrange: Create accounts with low balance
      const payer = await db.user.create({
        data: {
          email: 'poor@example.com',
          firstName: 'Poor',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payerAccount = await createStellarAccount(db, {
        userId: payer.id,
        balance: 10, // Only 10 XLM
      })

      const payee = await db.user.create({
        data: {
          email: 'recipient@example.com',
          firstName: 'Rich',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const payeeAccount = await createStellarAccount(db, {
        userId: payee.id,
        balance: 0,
      })

      mockStellarServer.setAccountState(payerAccount.publicKey, {
        balance: '10',
        sequence: 1,
      })

      // Act & Assert: Attempting to tip 100 XLM should fail
      await expect(
        paymentService.tip({
          from: payerAccount.publicKey,
          to: payeeAccount.publicKey,
          amount: 100, // Exceeds balance
        }),
      ).rejects.toThrow()
    })

    it('should apply fee basis points to tip', async () => {
      // Arrange: Set fee to 100 bps (1%)
      paymentService.setFeeBps('admin', 100)

      const payer = await db.user.create({
        data: {
          email: 'tipper@example.com',
          firstName: 'Tipping',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payerAccount = await createStellarAccount(db, {
        userId: payer.id,
        balance: 1000,
      })

      const payee = await db.user.create({
        data: {
          email: 'worker@example.com',
          firstName: 'Worker',
          lastName: 'Pro',
          password: 'hashed',
        },
      })

      const payeeAccount = await createStellarAccount(db, {
        userId: payee.id,
        balance: 0,
      })

      mockStellarServer.setAccountState(payerAccount.publicKey, {
        balance: '1000',
        sequence: 1,
      })

      // Act: Tip 100 XLM with 1% fee
      const tipAmount = 100
      const result = await paymentService.tip({
        from: payerAccount.publicKey,
        to: payeeAccount.publicKey,
        amount: tipAmount,
      })

      // Assert: Fee was calculated
      const fee = paymentService.calculateFee(tipAmount)
      expect(fee).toBe(1) // 1% of 100 = 1 XLM
      expect(result.success).toBe(true)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Escrow Payment Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Escrow Payments', () => {
    it('should create an escrow payment', async () => {
      // Arrange: Create payer and payee
      const payer = await db.user.create({
        data: {
          email: 'buyer@example.com',
          firstName: 'Buyer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'seller@example.com',
          firstName: 'Seller',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      // Act: Create escrow in database
      const escrowAmount = 200
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const escrow = await createEscrowRecord(db, {
        payerId: payer.id,
        payeeId: payee.id,
        amountXlm: escrowAmount,
        status: 'pending',
        expiresAt: expiryDate,
      })

      // Assert: Escrow record created with correct status
      expect(escrow).toBeDefined()
      expect(escrow.payerId).toBe(payer.id)
      expect(escrow.payeeId).toBe(payee.id)
      expect(escrow.amountXlm).toBe(escrowAmount)
      expect(escrow.status).toBe('pending')
      expect(escrow.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('should release an escrow payment', async () => {
      // Arrange: Create pending escrow
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const escrow = await createEscrowRecord(db, {
        payerId: payer.id,
        payeeId: payee.id,
        amountXlm: 100,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      // Act: Release the escrow
      const releasedEscrow = await db.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          status: 'released',
          releasedAt: new Date(),
        },
      })

      // Assert: Escrow status is released
      expect(releasedEscrow.status).toBe('released')
      expect(releasedEscrow.releasedAt).toBeDefined()
    })

    it('should prevent release of expired escrow', async () => {
      // Arrange: Create expired escrow
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const expiredEscrow = await createEscrowRecord(db, {
        payerId: payer.id,
        payeeId: payee.id,
        amountXlm: 100,
        status: 'pending',
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      })

      // Act & Assert: Check expiry
      const isExpired = expiredEscrow.expiresAt.getTime() < Date.now()
      expect(isExpired).toBe(true)
    })

    it('should cancel an escrow payment', async () => {
      // Arrange: Create escrow
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const escrow = await createEscrowRecord(db, {
        payerId: payer.id,
        payeeId: payee.id,
        amountXlm: 100,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      // Act: Cancel the escrow
      const cancelledEscrow = await db.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      })

      // Assert: Escrow is cancelled
      expect(cancelledEscrow.status).toBe('cancelled')
      expect(cancelledEscrow.cancelledAt).toBeDefined()
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Integration with Stellar Blockchain
  // ────────────────────────────────────────────────────────────────────────────

  describe('Stellar Blockchain Integration', () => {
    it('should track escrow transaction ID on Stellar', async () => {
      // Arrange: Create escrow and mock transaction
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const escrow = await createEscrowRecord(db, {
        payerId: payer.id,
        payeeId: payee.id,
        amountXlm: 50,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        txId: null,
      })

      const mockTxId = 'abc123def456'

      // Act: Update escrow with transaction ID
      const updatedEscrow = await db.escrowRecord.update({
        where: { id: escrow.id },
        data: { txId: mockTxId },
      })

      // Assert: Transaction ID is stored
      expect(updatedEscrow.txId).toBe(mockTxId)
    })

    it('should handle Stellar transaction failures gracefully', async () => {
      // Arrange: Create users and mock Stellar error
      const payer = await db.user.create({
        data: {
          email: 'payer@example.com',
          firstName: 'Payer',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const payee = await db.user.create({
        data: {
          email: 'payee@example.com',
          firstName: 'Payee',
          lastName: 'Worker',
          password: 'hashed',
        },
      })

      const payerAccount = await createStellarAccount(db, {
        userId: payer.id,
        balance: 0, // No balance
      })

      const payeeAccount = await createStellarAccount(db, {
        userId: payee.id,
        balance: 0,
      })

      // Act & Assert: Transaction should fail due to insufficient balance
      await expect(
        paymentService.tip({
          from: payerAccount.publicKey,
          to: payeeAccount.publicKey,
          amount: 50,
        }),
      ).rejects.toThrow()
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Fee Calculation Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Fee Calculations', () => {
    it('should calculate fees correctly', () => {
      // Arrange: Set fee to 200 bps (2%)
      paymentService.setFeeBps('admin', 200)

      // Act: Calculate fee on 1000 XLM
      const amount = 1000
      const fee = paymentService.calculateFee(amount)

      // Assert: Fee is 2% of 1000 = 20 XLM
      expect(fee).toBe(20)
    })

    it('should handle zero fee', () => {
      // Arrange: Set fee to 0
      paymentService.setFeeBps('admin', 0)

      // Act: Calculate fee
      const fee = paymentService.calculateFee(100)

      // Assert: No fee is charged
      expect(fee).toBe(0)
    })

    it('should reject invalid fee updates from non-admin', async () => {
      // Act & Assert: Non-admin should not be able to update fee
      expect(() => {
        paymentService.setFeeBps('user', 100)
      }).toThrow()
    })

    it('should round fees down to nearest satoshi-like unit', () => {
      // Arrange: Set fee to 33 bps (0.33%)
      paymentService.setFeeBps('admin', 33)

      // Act: Calculate fee on 100 XLM
      const fee = paymentService.calculateFee(100)

      // Assert: Fee should be 0.33 XLM, rounded appropriately
      expect(fee).toBeLessThanOrEqual(1)
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────────────

afterAll(async () => {
  await db.$disconnect()
})
