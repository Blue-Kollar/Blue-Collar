import type { Request, Response } from 'express'
import { importWorkersFromCsv } from '../services/csv-import.service.js'
import { handleError } from '../utils/handleError.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

/**
 * POST /api/admin/workers/import
 * Upload a CSV file to bulk-import workers. Admin only.
 *
 * Expects multipart/form-data with a `file` field (text/csv).
 * Returns an import summary with counts and per-row errors.
 */
export async function importWorkersFromCsvController(req: Request, res: Response) {
  try {
    if (!req.file) {
      throw new AppError('CSV file is required', 400, true, ErrorCode.VALIDATION_ERROR)
    }

    const csvText = req.file.buffer.toString('utf-8')
    const result = await importWorkersFromCsv(csvText, req.user!.id)

    if (result.imported === 0) {
      throw new AppError(`No workers imported. ${result.failed} row(s) failed.`, 400, true, ErrorCode.VALIDATION_ERROR)
    }

    return res.status(201).json({
      data: result,
      status: 'success',
      message: `Imported ${result.imported} worker(s). ${result.failed} row(s) failed.`,
      code: 201,
    })
  } catch (err) {
    const message = getErrorMessage(err)
    if (message.startsWith('Missing required CSV column')) {
      throw new AppError(message, 400, true, ErrorCode.VALIDATION_ERROR)
    }
    return handleError(res, err)
  }
}
