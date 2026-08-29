-- Issue: per-worker personal analytics dashboard
CREATE TABLE "WorkerTipEvent" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerTipEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerTipEvent_workerId_createdAt_idx" ON "WorkerTipEvent"("workerId", "createdAt");

ALTER TABLE "WorkerTipEvent" ADD CONSTRAINT "WorkerTipEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
