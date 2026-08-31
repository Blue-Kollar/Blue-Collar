/**
 * Payment controller — thin HTTP layer.
 *
 * Parses request input, delegates to the injected PaymentService, and formats
 * responses.  All business logic lives exclusively in PaymentService; this
 * controller is responsible only for parse → validate → respond.
 *
 * Dependency injection: pass a PaymentService instance to
 * `createPaymentController()`.  The module-level exports use the shared
 * singleton so existing route wiring requires no changes.
 */
import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { paymentService as defaultPaymentService, PaymentService } from '../services/payment.service.js'
import { HttpStatus } from '../constants/index.js'
import { ErrorMessages } from '../constants/errors.js'

// ── Controller factory (enables dependency injection) ─────────────────────────

export function createPaymentController(service: PaymentService = defaultPaymentService) {
  /**
   * POST /api/payments/tip
   * Body: { from, to, amount }
   */
  const processTip = catchAsync(async (req: Request, res: Response) => {
    const { from, to, amount } = req.body
    if (!from || !to || amount === undefined) {
      throw new AppError(ErrorMessages.TIP_FIELDS_REQUIRED, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
    }
    const result = service.tip({ from: String(from), to: String(to), amount: Number(amount) })
    return res.status(HttpStatus.OK).json({ data: result, status: 'success', code: HttpStatus.OK })
  })

  /**
   * POST /api/payments/escrow
   * Body: { from, to, amount, expiryDate }
   */
  const createEscrow = catchAsync(async (req: Request, res: Response) => {
    const { from, to, amount, expiryDate } = req.body
    if (!from || !to || amount === undefined || !expiryDate) {
      throw new AppError(
        ErrorMessages.ESCROW_FIELDS_REQUIRED,
        HttpStatus.BAD_REQUEST,
        true,
        ErrorCode.VALIDATION_ERROR,
      )
    }
    const result = service.createEscrow({
      from: String(from),
      to: String(to),
      amount: Number(amount),
      expiryDate: new Date(expiryDate),
    })
    return res.status(HttpStatus.CREATED).json({ data: result, status: 'success', code: HttpStatus.CREATED })
  })

  /**
   * GET /api/payments/fee
   */
  const getFee = (_req: Request, res: Response) => {
    return res.status(HttpStatus.OK).json({
      data: { fee_bps: service.getFeeBps() },
      status: 'success',
      code: HttpStatus.OK,
    })
  }

  /**
   * PATCH /api/payments/fee
   * Body: { fee_bps }
   * Requires admin role.
   */
  const updateFee = catchAsync(async (req: Request, res: Response) => {
    const { fee_bps } = req.body
    if (fee_bps === undefined) {
      throw new AppError(ErrorMessages.FEE_BPS_REQUIRED, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
    }
    service.setFeeBps(req.user?.role ?? '', Number(fee_bps))
    return res.status(HttpStatus.OK).json({
      data: { fee_bps: service.getFeeBps() },
      status: 'success',
      code: HttpStatus.OK,
    })
  })

  return { processTip, createEscrow, getFee, updateFee }
}

// ── Default exports backed by the shared singleton ────────────────────────────
// Route files import these directly; tests inject a custom service via the factory.

const defaultController = createPaymentController()

export const { processTip, createEscrow, getFee, updateFee } = defaultController
