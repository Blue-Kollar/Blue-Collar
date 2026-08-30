import { db } from "../db.js";

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
