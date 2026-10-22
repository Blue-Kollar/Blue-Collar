/**
 * Centralized configuration module.
 *
 * Validates all environment variables at startup with a zod schema and exports
 * a typed `config` object. Import `config` instead of reading `process.env`
 * directly.
 *
 * Required variables throw at startup if missing. Optional variables fall back
 * to documented defaults.
 */

import { z } from 'zod';
import { TESTNET_HORIZON_URL } from '@bluecollar/sdk';

// ── Schema ────────────────────────────────────────────────────────────────────

const nonEmpty = (name: string) =>
  z.string({ required_error: `required env var "${name}" is missing or empty` })
    .min(1, `required env var "${name}" is missing or empty`);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: nonEmpty('APP_URL'),
  LOG_LEVEL: z.string().default('info'),
  LOG_DIR: z.string().default('storage/logs'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3001'),

  DATABASE_URL: nonEmpty('DATABASE_URL'),
  JWT_SECRET: nonEmpty('JWT_SECRET'),
  GOOGLE_CLIENT_ID: nonEmpty('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: nonEmpty('GOOGLE_CLIENT_SECRET'),

  MAIL_HOST: nonEmpty('MAIL_HOST'),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_USER: nonEmpty('MAIL_USER'),
  MAIL_PASS: nonEmpty('MAIL_PASS'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  UPLOAD_DIR: z.string().default('storage/uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(5_242_880),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),

  HORIZON_URL: z.string().default(TESTNET_HORIZON_URL),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  REGISTRY_CONTRACT_ID: z.string().default(''),
  MARKET_CONTRACT_ID: z.string().default(''),

  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  VAULT_ADDR: z.string().default('http://localhost:8200'),
  VAULT_TOKEN: z.string().optional(),

  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default(''),
  S3_SIGNED_URL_TTL: z.coerce.number().int().positive().default(3600),
});

export type Env = z.infer<typeof envSchema>;

// ── Config types ──────────────────────────────────────────────────────────────

export interface Config {
  env: Env['NODE_ENV'];
  port: number;
  appUrl: string;
  logLevel: string;
  logDir: string;
  allowedOrigins: string[];
  db: { url: string };
  auth: { jwtSecret: string; googleClientId: string; googleClientSecret: string };
  mail: { host: string; port: number; user: string; pass: string };
  redis: { url: string };
  upload: { dir: string; maxFileSize: number };
  push: { vapidPublicKey: string; vapidPrivateKey: string };
  stellar: {
    horizonUrl: string;
    network: 'testnet' | 'mainnet';
    registryContractId: string;
    marketContractId: string;
  };
  worker: { shutdownTimeoutMs: number };
  vault: { addr: string; token: string | undefined };
  storage: {
    region: string;
    endpoint: string | undefined;
    accessKey: string | undefined;
    secretKey: string | undefined;
    bucket: string;
    signedUrlTtl: number;
  };
}

// ── Loader ────────────────────────────────────────────────────────────────────

function normaliseEnv(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(normaliseEnv(source));

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const key = issue.path.join('.') || 'env';
        return `${key}: ${issue.message}`;
      })
      .join('; ');
    throw new Error(`Config error: ${details}`);
  }

  const e = parsed.data;

  return {
    env: e.NODE_ENV,
    port: e.PORT,
    appUrl: e.APP_URL,
    logLevel: e.LOG_LEVEL,
    logDir: e.LOG_DIR,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
    db: { url: e.DATABASE_URL },
    auth: {
      jwtSecret: e.JWT_SECRET,
      googleClientId: e.GOOGLE_CLIENT_ID,
      googleClientSecret: e.GOOGLE_CLIENT_SECRET,
    },
    mail: {
      host: e.MAIL_HOST,
      port: e.MAIL_PORT,
      user: e.MAIL_USER,
      pass: e.MAIL_PASS,
    },
    redis: { url: e.REDIS_URL },
    upload: { dir: e.UPLOAD_DIR, maxFileSize: e.MAX_FILE_SIZE },
    push: { vapidPublicKey: e.VAPID_PUBLIC_KEY, vapidPrivateKey: e.VAPID_PRIVATE_KEY },
    stellar: {
      horizonUrl: e.HORIZON_URL,
      network: e.STELLAR_NETWORK,
      registryContractId: e.REGISTRY_CONTRACT_ID,
      marketContractId: e.MARKET_CONTRACT_ID,
    },
    worker: { shutdownTimeoutMs: e.WORKER_SHUTDOWN_TIMEOUT_MS },
    vault: { addr: e.VAULT_ADDR, token: e.VAULT_TOKEN },
    storage: {
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKey: e.S3_ACCESS_KEY,
      secretKey: e.S3_SECRET_KEY,
      bucket: e.S3_BUCKET,
      signedUrlTtl: e.S3_SIGNED_URL_TTL,
    },
  };
}

export const config = loadConfig();
export default config;
