import type { Notification, NotificationPreferences, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface INotificationRepository extends IRepository<Notification, Prisma.NotificationCreateInput, Prisma.NotificationUpdateInput> {
  createNotification(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification>
  findPreferences(userId: string): Promise<NotificationPreferences | null>
  upsertPreferences(userId: string, data: Partial<{
    newWorkerNearby: boolean
    statusChange: boolean
    reviewReply: boolean
    announcements: boolean
    quietHoursStart?: string
    quietHoursEnd?: string
  }>): Promise<NotificationPreferences>
  findUserEmailAndName(userId: string): Promise<{ email: string; firstName: string } | null>
  findNotificationById(id: string): Promise<{ id: string } | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class NotificationRepository implements INotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    return db.notification.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Notification[]> {
    return db.notification.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return db.notification.create({ data })
  }

  async update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification> {
    return db.notification.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Notification> {
    return db.notification.delete({ where: { id } })
  }

  async count(where?: Prisma.NotificationWhereInput): Promise<number> {
    return db.notification.count({ where })
  }

  async createNotification(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return db.notification.create({ data })
  }

  async findPreferences(userId: string): Promise<NotificationPreferences | null> {
    return db.notificationPreferences.findUnique({ where: { userId } })
  }

  async upsertPreferences(userId: string, data: Partial<{
    newWorkerNearby: boolean
    statusChange: boolean
    reviewReply: boolean
    announcements: boolean
    quietHoursStart?: string
    quietHoursEnd?: string
  }>): Promise<NotificationPreferences> {
    return db.notificationPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
  }

  async findUserEmailAndName(userId: string): Promise<{ email: string; firstName: string } | null> {
    return db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } })
  }

  async findNotificationById(id: string): Promise<{ id: string } | null> {
    return db.notification.findUnique({ where: { id }, select: { id: true } })
  }
}

export const notificationRepository = new NotificationRepository()
