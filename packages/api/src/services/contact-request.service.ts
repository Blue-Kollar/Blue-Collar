import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'
import { sendContactRequestEmail } from '../mailer/index.js'

export async function createContactRequest(workerId: string, fromUserId: string, message: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: { curator: true }
  })
  if (!worker) throw new AppError('Worker not found', 404)

  const contactRequest = await db.contactRequest.create({
    data: {
      workerId,
      fromUserId,
      message,
      status: 'pending'
    },
    include: { fromUser: true, worker: true }
  })

  // Send email to curator
  await sendContactRequestEmail(worker.curator.email, worker.name, contactRequest.fromUser.firstName)

  return contactRequest
}

export async function getContactRequests(workerId: string) {
  return db.contactRequest.findMany({
    where: { workerId },
    include: { fromUser: true },
    orderBy: { createdAt: 'desc' }
  })
}

export async function updateContactRequestStatus(requestId: string, status: 'accepted' | 'declined') {
  const request = await db.contactRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new AppError('Contact request not found', 404)

  return db.contactRequest.update({
    where: { id: requestId },
    data: { status },
    include: { fromUser: true, worker: true }
  })
}
