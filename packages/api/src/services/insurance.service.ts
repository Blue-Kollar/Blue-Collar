import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'
import { sendInsuranceRenewalReminder } from '../mailer/index.js'

export async function uploadInsurance(
  workerId: string,
  documentUrl: string,
  expiresAt: Date,
  provider?: string,
  policyNumber?: string,
) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  return db.insuranceDocument.create({
    data: { workerId, documentUrl, expiresAt, provider, policyNumber },
  })
}

export async function getWorkerInsurance(workerId: string) {
  return db.insuranceDocument.findMany({
    where: { workerId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateInsuranceStatus(id: string, status: 'verified' | 'rejected') {
  const doc = await db.insuranceDocument.findUnique({ where: { id } })
  if (!doc) throw new AppError('Insurance document not found', 404)
  return db.insuranceDocument.update({ where: { id }, data: { status } })
}

/**
 * Send renewal reminders for documents expiring within the next `daysAhead` days.
 * Called by a scheduled job / cron.
 */
export async function sendRenewalReminders(daysAhead = 30) {
  const threshold = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)

  const expiring = await db.insuranceDocument.findMany({
    where: { expiresAt: { lte: threshold }, status: 'verified' },
    include: { worker: { include: { curator: true } } },
  })

  await Promise.allSettled(
    expiring.map((doc) =>
      sendInsuranceRenewalReminder(
        doc.worker.curator.email,
        doc.worker.name,
        doc.expiresAt,
      ),
    ),
  )

  return expiring.length
}
