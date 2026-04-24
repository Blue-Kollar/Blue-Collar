import { Request, Response } from "express";
import { NextFunction } from "express";
import redis from "../utils/redis";
import jwt from 'jsonwebtoken'
import { logger } from "../config/logger";
const ANON_LIMIT = 30
const AUTH_LIMIT = 100;
const WINDOW_SECONDS = 900
const getUserFromToken = (req: Request): { id: string; role: string } | null => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return null;
        return jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        logger.info("no token received from getUserFromToken");
        return null;
    }
}
export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserFromToken(req);
    logger.info(user);
    if (user?.role == "admin") {
        return next();
    }
    const isAuthenticated = !!user;
    const limit = isAuthenticated ? AUTH_LIMIT : ANON_LIMIT;
    const identifier = isAuthenticated ? `auth:${user.id}` : `anon:${req.ip}`;
    const key = `ratelimit:${identifier}`;
    const violationKey = `violations:${identifier}`;
    const blockedUntil = await redis.get(`blocked:${identifier}`);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        const retryAfter = Math.ceil((parseInt(blockedUntil) - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
            status: 'error',
            message: `Too many violations. Try again in ${retryAfter} seconds.`
        });
    }
    const current = await redis.incr(key);
    if (current === 1) {
        await redis.expire(key, WINDOW_SECONDS);
    }
    const ttl = await redis.ttl(key);
    const reset = Math.floor(Date.now() / 1000) + ttl;
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    res.setHeader('X-RateLimit-Reset', reset);
    if (current > limit) {
        const violations = await redis.incr(violationKey);
        await redis.expire(violationKey, 60 * 60);
        const backoffSeconds = Math.pow(2, violations) * 60;
        const blockedUntilTime = Date.now() + backoffSeconds * 1000;
        await redis.set(`blocked:${identifier}`, blockedUntilTime, 'EX', backoffSeconds);
        return res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded.',
            retryAfter: backoffSeconds
        });
    }
    next();
}