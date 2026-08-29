import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from '../config/logger.js';

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_FIELDS = [
  "newWorkerNearby",
  "statusChange",
  "reviewReply",
  "announcements",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

// GET /api/users/me/notifications
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    let prefs = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreferences.create({
        data: {
          userId,
          newWorkerNearby: true,
          statusChange: true,
          reviewReply: true,
          announcements: true,
        },
      });
    }
    res.json(prefs);
  } catch (err) {
    logger.error({ err }, 'GET notification prefs error');
    res.status(500).json({ error: "Internal server error." });
  }
});

// PUT /api/users/me/notifications
router.put("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const updates: Partial<Record<AllowedField, boolean>> = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        if (typeof req.body[field] !== "boolean") {
          return res
            .status(400)
            .json({ error: `Field '${field}' must be a boolean.` });
        }
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided." });
    }

    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: updates,
      create: {
        userId,
        newWorkerNearby: true,
        statusChange: true,
        reviewReply: true,
        announcements: true,
        ...updates,
      },
    });

    res.json(prefs);
  } catch (err) {
    logger.error({ err }, 'PUT notification prefs error');
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
