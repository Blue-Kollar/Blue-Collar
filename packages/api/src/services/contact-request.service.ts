import { contactRequestRepository as defaultContactRequestRepository } from '../repositories/contact-request.repository.js'
import { AppError } from '../utils/AppError.js'
import { sendContactRequestEmail } from '../mailer/index.js'
import type { ContactRequestServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createContactRequestService(deps: ContactRequestServiceDeps) {
  const { contactRequestRepository: repo } = deps

  return {
    async createContactRequest(workerId: string, fromUserId: string, message: string) {
      const worker = await repo.findWorkerWithCurator(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      const contactRequest = await repo.createContactRequest({
        workerId,
        fromUserId,
        message,
        status: 'pending',
      })

      // Send email to curator
      await sendContactRequestEmail((worker as any).curator.email, worker.name, (contactRequest as any).fromUser.firstName)

      return contactRequest
    },

    async getContactRequests(workerId: string) {
      return repo.findContactRequests(workerId)
    },

    async updateContactRequestStatus(requestId: string, status: 'accepted' | 'declined') {
      const request = await repo.findContactRequestById(requestId)
      if (!request) throw new AppError('Contact request not found', 404)

      return repo.updateContactRequestStatus(requestId, status)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createContactRequestService({
  contactRequestRepository: defaultContactRequestRepository,
})

export async function createContactRequest(workerId: string, fromUserId: string, message: string) {
  return _defaultService.createContactRequest(workerId, fromUserId, message)
}

export async function getContactRequests(workerId: string) {
  return _defaultService.getContactRequests(workerId)
}

export async function updateContactRequestStatus(requestId: string, status: 'accepted' | 'declined') {
  return _defaultService.updateContactRequestStatus(requestId, status)
}
