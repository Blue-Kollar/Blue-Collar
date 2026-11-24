import { Router, Request, Response } from "express";

const router = Router();

const clients = new Set<Response>();

export function broadcastWorkerStatus(workerId: string, isActive: boolean) {
  const data = JSON.stringify({ workerId, isActive, ts: Date.now() });
  for (const res of clients) {
    try {
      res.write(`event: workerStatus\ndata: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

// GET /api/workers/events
router.get("/", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(": heartbeat\n\n");
  clients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

export default router;
