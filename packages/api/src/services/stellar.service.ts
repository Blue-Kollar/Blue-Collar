import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

export async function registerOnChain(workerId: string, contractId: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  return db.worker.update({
    where: { id: workerId },
    data: { stellarContractId: contractId },
    include: { category: true, curator: true }
  })
}
