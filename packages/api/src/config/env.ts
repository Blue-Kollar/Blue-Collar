/**
 * Environment configuration module
 * Validates the presence of required environment variables at startup
 * and exports them as typed constants.
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PORT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USER',
  'MAIL_PASS',
  'APP_URL',
] as const;

// Ensure all required environment variables are present
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Startup Error: Required environment variable "${envVar}" is missing or empty.`);
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  PORT: parseInt(process.env.PORT as string, 10),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
  MAIL_HOST: process.env.MAIL_HOST as string,
  MAIL_PORT: parseInt(process.env.MAIL_PORT as string, 10),
  MAIL_USER: process.env.MAIL_USER as string,
  MAIL_PASS: process.env.MAIL_PASS as string,
  APP_URL: process.env.APP_URL as string,
} as const;

export default env;
