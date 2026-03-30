import type { Request, Response } from 'express'
import * as stellarService from '../services/stellar.service.js'
import { handleError } from '../utils/handleError.js'
import { WorkerResource } from '../resources/index.js'

export async function registerOnChain(req: Request, res: Response) {
  try {
    const { contractId } = req.body
    if (!contractId) {
      return res.status(400).json({ status: 'error', message: 'contractId is required', code: 400 })
    }
    const worker = await stellarService.registerOnChain(req.params.id, contractId)
    return res.json({
      data: WorkerResource(worker as any),
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}
