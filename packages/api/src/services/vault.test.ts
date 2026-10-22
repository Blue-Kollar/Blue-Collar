import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const client = {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  }
  return { client, VaultCtor: vi.fn(() => client) }
})

vi.mock('node-vault', () => ({ default: mocks.VaultCtor }))

import {
  deleteSecret,
  getSecret,
  listSecrets,
  rotateSecret,
  setSecret,
} from './vault.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('vault secret round-trip', () => {
  it('writes secret material and reads it back unchanged', async () => {
    const material = { privateKey: 'SAC...', publicKey: 'GAC...' }
    const stored: Record<string, string> = {}

    mocks.client.write.mockImplementation(async (_path: string, body: { data: Record<string, string> }) => {
      Object.assign(stored, body.data)
    })
    mocks.client.read.mockImplementation(async () => ({ data: { data: { ...stored } } }))

    await setSecret('stellar/signing-key', material)
    const roundTripped = await getSecret('stellar/signing-key')

    expect(mocks.client.write).toHaveBeenCalledWith('kv/data/bluecollar/stellar/signing-key', {
      data: material,
    })
    expect(roundTripped).toEqual(material)
  })

  it('rotates a secret by replacing its contents', async () => {
    await rotateSecret('stellar/signing-key', { privateKey: 'NEW' })

    expect(mocks.client.write).toHaveBeenCalledWith('kv/data/bluecollar/stellar/signing-key', {
      data: { privateKey: 'NEW' },
    })
  })

  it('deletes a secret', async () => {
    await deleteSecret('stellar/signing-key')

    expect(mocks.client.delete).toHaveBeenCalledWith('kv/data/bluecollar/stellar/signing-key')
  })

  it('lists secret keys', async () => {
    mocks.client.list.mockResolvedValue({ data: { keys: ['api', 'database'] } })

    await expect(listSecrets('')).resolves.toEqual(['api', 'database'])
    expect(mocks.client.list).toHaveBeenCalledWith('kv/metadata/bluecollar/')
  })
})

describe('vault response validation', () => {
  it.each([
    ['missing payload', undefined],
    ['null payload', null],
    ['array payload', ['tampered']],
    ['scalar payload', 'tampered'],
  ])('rejects a %s', async (_label, payload) => {
    mocks.client.read.mockResolvedValue({ data: { data: payload } })

    await expect(getSecret('db')).rejects.toThrow('Vault returned an invalid secret payload')
  })

  it('rejects non-string secret values', async () => {
    mocks.client.read.mockResolvedValue({ data: { data: { password: 1234 } } })

    await expect(getSecret('db')).rejects.toThrow('non-string value for secret key "password"')
  })

  it('propagates backend read failures', async () => {
    const error = new Error('permission denied')
    mocks.client.read.mockRejectedValue(error)

    await expect(getSecret('db')).rejects.toBe(error)
  })

  it('propagates backend write failures', async () => {
    const error = new Error('sealed')
    mocks.client.write.mockRejectedValue(error)

    await expect(setSecret('db', { password: 'x' })).rejects.toBe(error)
  })

  it('propagates backend delete failures', async () => {
    const error = new Error('permission denied')
    mocks.client.delete.mockRejectedValue(error)

    await expect(deleteSecret('db')).rejects.toBe(error)
  })
})
