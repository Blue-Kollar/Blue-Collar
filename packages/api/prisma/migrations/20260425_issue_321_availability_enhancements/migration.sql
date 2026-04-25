-- Issue #321: Worker availability management enhancements
-- Add timezone and isRecurring fields to Availability
-- Drop old unique constraint (workerId, dayOfWeek) and add new one allowing multiple slots per day

-- Drop old unique constraint
ALTER TABLE "Availability" DROP CONSTRAINT IF EXISTS "Availability_workerId_dayOfWeek_key";

-- Add new columns
ALTER TABLE "Availability" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Availability" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT true;

-- Add new unique constraint allowing multiple time slots per day
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_workerId_dayOfWeek_startTime_endTime_key"
  UNIQUE ("workerId", "dayOfWeek", "startTime", "endTime");

-- CreateTable: Bookmark (if not exists)
CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_workerId_key" ON "Bookmark"("userId", "workerId");
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PushSubscription (if not exists)
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum: ReviewStatus (if not exists)
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum: SubscriptionTier (if not exists)
DO $$ BEGIN
  CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN null; END $$;
