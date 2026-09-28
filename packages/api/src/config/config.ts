/**
 * Centralized configuration module.
 *
 * Validates all environment variables at startup and exports a typed `config`
 * object. Import `config` instead of reading `process.env` directly.
 *
 * Required variables throw at startup if missing.
 * Optional variables fall back to documented defaults.
 */

import { TESTNET_HORIZON_URL } from '@bluecollar/sdk';

// ── Helpers ───────────────────────────────────────────────────────────────────

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Config error: required env var "${key}" is missing or empty`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) throw new Error(`Config error: "${key}" must be an integer, got "${raw}"`);
  return parsed;
}

function optionalBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`Config error: "${key}" must be true/false/1/0, got "${raw}"`);
}

// ── Config object ─────────────────────────────────────────────────────────────

export const config = {
  /** Runtime environment */
  env: optional('NODE_ENV', 'development') as 'development' | 'test' | 'production',

  /** API server port */
  port: optionalInt('PORT', 3000),

  /** Public URL of the frontend app */
  appUrl: required('APP_URL'),

  /** Log level */
  logLevel: optional('LOG_LEVEL', 'info'),

  /** Comma-separated allowed CORS origins */
  allowedOrigins: optional('ALLOWED_ORIGINS', 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),

  db: {
    /** Primary database connection string */
    url: required('DATABASE_URL'),
  },

  auth: {
    /** JWT signing secret */
    jwtSecret: required('JWT_SECRET'),
    /** Google OAuth client ID */
    googleClientId: required('GOOGLE_CLIENT_ID'),
    /** Google OAuth client secret */
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  },

  mail: {
    host: required('MAIL_HOST'),
    port: optionalInt('MAIL_PORT', 587),
    user: required('MAIL_USER'),
    pass: required('MAIL_PASS'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  upload: {
    dir: optional('UPLOAD_DIR', 'storage/uploads'),
    maxFileSize: optionalInt('MAX_FILE_SIZE', 5_242_880),
  },

  push: {
    vapidPublicKey: optional('VAPID_PUBLIC_KEY', ''),
    vapidPrivateKey: optional('VAPID_PRIVATE_KEY', ''),
  },

  stellar: {
    /** Horizon RPC base URL */
    horizonUrl: optional('HORIZON_URL', TESTNET_HORIZON_URL),
    /** Stellar network passphrase: testnet or mainnet */
    network: optional('STELLAR_NETWORK', 'testnet') as 'testnet' | 'mainnet',
    /** Deployed Registry Soroban contract ID (optional at startup) */
    registryContractId: optional('REGISTRY_CONTRACT_ID', ''),
    /** Deployed Market Soroban contract ID (optional at startup) */
    marketContractId: optional('MARKET_CONTRACT_ID', ''),
  },
} as const;

export type Config = typeof config;
export default config;
