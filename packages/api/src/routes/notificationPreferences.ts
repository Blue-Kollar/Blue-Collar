import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { logger } from '../config/logger.js';

const router = Router();

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
    const userId = req.user!.id;
    let prefs = await db.notificationPreferences.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await db.notificationPreferences.create({
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
    const userId = req.user!.id;
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

    const prefs = await db.notificationPreferences.upsert({
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
