-- Add email verification reminder tracking fields to User
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "reminderSentAt"        TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reminderCount"          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "unsubscribedReminders"  BOOLEAN NOT NULL DEFAULT false;
