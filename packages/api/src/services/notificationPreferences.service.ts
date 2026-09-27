import { db } from "../db.js";

/**
 * Notification-preferences domain logic. Previously lived in the generic
 * `helpers/notificationPrefs.ts` bucket; moved here alongside
 * `notification.service.ts` since both operate on the same domain
 * (notification delivery/preferences) rather than being an unrelated
 * grab-bag utility.
 */

export async function seedDefaultPreferences(userId: string) {
  return db.notificationPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      newWorkerNearby: true,
      statusChange: true,
      reviewReply: true,
      announcements: true,
    },
  });
}

export async function isNotificationEnabled(
  userId: string,
  type: string
): Promise<boolean> {
  const prefs = await db.notificationPreferences.findUnique({
    where: { userId },
  });
  if (!prefs) return true;
  if (!(type in prefs)) throw new Error(`Unknown notification type: ${type}`);
  return (prefs as Record<string, unknown>)[type] as boolean;
}
