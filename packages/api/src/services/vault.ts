import * as NodeVault from 'node-vault';

import { logger } from '../config/logger.js'

const vault = new NodeVault({
  endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
  token: process.env.VAULT_TOKEN,
});

export async function getSecret(path: string): Promise<Record<string, string>> {
  try {
    const secret = await vault.read(`kv/data/bluecollar/${path}`);
    return secret.data.data;
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
