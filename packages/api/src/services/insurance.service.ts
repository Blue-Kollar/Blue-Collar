import { insuranceRepository as defaultInsuranceRepository } from '../repositories/insurance.repository.js'
import { AppError } from '../utils/AppError.js'
import { sendInsuranceRenewalReminder } from '../mailer/index.js'
import type { InsuranceServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createInsuranceService(deps: InsuranceServiceDeps) {
  const { insuranceRepository: repo } = deps

  return {
    async uploadInsurance(
      workerId: string,
      documentUrl: string,
      expiresAt: Date,
      provider?: string,
      policyNumber?: string,
    ) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      return repo.createDocument({ workerId, documentUrl, expiresAt, provider, policyNumber } as any)
    },

    async getWorkerInsurance(workerId: string) {
      return repo.findByWorker(workerId)
    },

    async updateInsuranceStatus(id: string, status: 'verified' | 'rejected') {
      const doc = await repo.findDocumentById(id)
      if (!doc) throw new AppError('Insurance document not found', 404)
      return repo.updateStatus(id, status)
    },

    /**
     * Send renewal reminders for documents expiring within the next `daysAhead` days.
     * Called by a scheduled job / cron.
     */
    async sendRenewalReminders(daysAhead = 30) {
      const threshold = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)

      const expiring = await repo.findExpiring(threshold)

      await Promise.allSettled(
        expiring.map((doc: any) =>
          sendInsuranceRenewalReminder(
            doc.worker.curator.email,
            doc.worker.name,
            doc.expiresAt,
          ),
        ),
      )

      return expiring.length
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createInsuranceService({
  insuranceRepository: defaultInsuranceRepository,
})

export async function uploadInsurance(
  workerId: string,
  documentUrl: string,
  expiresAt: Date,
  provider?: string,
  policyNumber?: string,
) {
  return _defaultService.uploadInsurance(workerId, documentUrl, expiresAt, provider, policyNumber)
}

export async function getWorkerInsurance(workerId: string) {
  return _defaultService.getWorkerInsurance(workerId)
}

export async function updateInsuranceStatus(id: string, status: 'verified' | 'rejected') {
  return _defaultService.updateInsuranceStatus(id, status)
}

export async function sendRenewalReminders(daysAhead = 30) {
  return _defaultService.sendRenewalReminders(daysAhead)
}
