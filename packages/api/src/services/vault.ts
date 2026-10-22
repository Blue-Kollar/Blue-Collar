import NodeVault from 'node-vault';
import { logger } from '@/config/logger.js'
import { config } from '@/config/config.js'

const vault = NodeVault({
  endpoint: config.vault.addr,
  token: config.vault.token,
});

/**
 * Validate a payload returned by Vault before handing it to callers.
 * A tampered or malformed response must never be treated as secret material.
 */
function parseSecretPayload(payload: unknown): Record<string, string> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Vault returned an invalid secret payload');
  }

  const secret: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== 'string') {
      throw new Error(`Vault returned a non-string value for secret key "${key}"`);
    }
    secret[key] = value;
  }
  return secret;
}

export async function getSecret(path: string): Promise<Record<string, string>> {
  try {
    const secret = await vault.read(`kv/data/bluecollar/${path}`);
    return parseSecretPayload(secret?.data?.data);
  } catch (error) {
    logger.error({ err: error, path }, 'Failed to retrieve secret')
    throw error;
  }
}

export async function setSecret(path: string, data: Record<string, string>): Promise<void> {
  try {
    await vault.write(`kv/data/bluecollar/${path}`, { data });
  } catch (error) {
    logger.error({ err: error, path }, 'Failed to set secret')
    throw error;
  }
}

export async function rotateSecret(path: string, newData: Record<string, string>): Promise<void> {
  try {
    await setSecret(path, newData);
    logger.info({ path }, 'Secret rotated')
  } catch (error) {
    logger.error({ err: error, path }, 'Failed to rotate secret')
    throw error;
  }
}

export async function deleteSecret(path: string): Promise<void> {
  try {
    await vault.delete(`kv/data/bluecollar/${path}`);
    logger.info({ path }, 'Secret deleted')
  } catch (error) {
    logger.error({ err: error, path }, 'Failed to delete secret')
    throw error;
  }
}

export async function listSecrets(path: string): Promise<string[]> {
  try {
    const result = await vault.list(`kv/metadata/bluecollar/${path}`);
    return result.data.keys;
  } catch (error) {
    logger.error({ err: error, path }, 'Failed to list secrets')
    throw error;
  }
}
