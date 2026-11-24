/**
 * Tests for the consolidated public surface of @bluecollar/test-utils (issue #1879).
 *
 * The root barrel used to contain a duplicate re-export, and two subpaths that
 * are imported by packages/api were missing from package.json. These tests
 * assert that every runtime export of every non-React subpath is reachable
 * from the root, that subpath self-imports resolve through the exports map,
 * and that representative helpers still behave correctly.
 */
import { describe, it, expect, vi } from 'vitest'
import * as root from '../src/index'
import * as factories from '@bluecollar/test-utils/factories'
import * as expressHelpers from '@bluecollar/test-utils/express'
import * as contractFixtures from '@bluecollar/test-utils/contract-fixtures'
import * as stellarMocks from '@bluecollar/test-utils/stellar-mocks'
import * as stellarSdkMock from '@bluecollar/test-utils/stellar-sdk-mock'
import * as dbFixtures from '@bluecollar/test-utils/db-fixtures'
import * as reactHelpers from '@bluecollar/test-utils/react'

const nonReactSubpaths = [
  factories,
  expressHelpers,
  contractFixtures,
  stellarMocks,
  stellarSdkMock,
  dbFixtures,
]

describe('root barrel exports', () => {
  it('re-exports every runtime helper from each non-React subpath', () => {
    for (const module of nonReactSubpaths) {
      for (const [name, value] of Object.entries(module)) {
        expect(root, `${name} must be re-exported from the package root`).toHaveProperty(name)
        expect((root as Record<string, unknown>)[name], `${name} must be the same binding`).toBe(
          value,
        )
      }
    }
  })

  it('keeps React helpers out of the root so non-React tests need no React runtime', () => {
    expect(root).not.toHaveProperty('renderWithProviders')
    expect(root).not.toHaveProperty('useTestAuth')
    expect(typeof reactHelpers.renderWithProviders).toBe('function')
    expect(typeof reactHelpers.useTestAuth).toBe('function')
  })

  it('does not expose the removed createMockTransaction helper', () => {
    expect(root).not.toHaveProperty('createMockTransaction')
    expect(stellarSdkMock).not.toHaveProperty('createMockTransaction')
  })
})

describe('subpath imports through package.json exports map', () => {
  it('resolves all declared subpaths', () => {
    expect(Object.keys(factories)).toContain('userFactory')
    expect(Object.keys(expressHelpers)).toContain('makeResponse')
    expect(Object.keys(contractFixtures)).toContain('makeTestAccount')
    expect(Object.keys(stellarMocks)).toContain('makeMockHorizonFetch')
    expect(Object.keys(stellarSdkMock)).toContain('MockStellarServer')
    expect(Object.keys(dbFixtures)).toContain('createStellarAccount')
    expect(Object.keys(reactHelpers)).toContain('renderWithProviders')
  })

  it('exposes the db-fixtures and stellar-sdk-mock functions used by API integration tests', () => {
    expect(typeof dbFixtures.createStellarAccount).toBe('function')
    expect(typeof dbFixtures.createEscrowRecord).toBe('function')
    expect(typeof dbFixtures.createWebhookSubscription).toBe('function')
    expect(typeof stellarSdkMock.createMockStellarClient).toBe('function')
    expect(typeof stellarSdkMock.MockStellarServer).toBe('function')
  })
})

describe('consolidated helpers still behave correctly', () => {
  it('factories apply overrides', () => {
    const user = root.userFactory({ role: 'admin', verified: false })
    expect(user.role).toBe('admin')
    expect(user.verified).toBe(false)
    expect(user.id).toBeTruthy()
  })

  it('makeResponse remains chainable', () => {
    const res = root.makeResponse()
    expect(res.status(201)).toBe(res)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('stellar fixtures share the canonical address and transaction hash constants', () => {
    expect(stellarSdkMock.mockAccountFixture().id).toBe(stellarMocks.MOCK_STELLAR_ADDRESS)
    expect(stellarSdkMock.mockTransactionFixture().hash).toBe(stellarMocks.MOCK_TX_HASH)
    expect(root.accountFixture().publicKey).toBe(root.MOCK_STELLAR_ADDRESS)
  })

  it('createMockStellarClient accepts an existing MockStellarServer', async () => {
    const server = new root.MockStellarServer()
    const client = root.createMockStellarClient(server)
    expect(client.horizonServer).toBe(server)
    const account = await client.getAccountInfo(root.MOCK_STELLAR_ADDRESS)
    expect(account).toMatchObject({ id: root.MOCK_STELLAR_ADDRESS })
  })

  it('createMockStellarClient still accepts per-method overrides', async () => {
    const getAccountInfo = vi.fn().mockResolvedValue({ id: 'custom' })
    const client = root.createMockStellarClient({ getAccountInfo })
    expect(await client.getAccountInfo('GTEST')).toEqual({ id: 'custom' })
    expect(getAccountInfo).toHaveBeenCalledWith('GTEST')
  })

  it('db fixtures accept a structural Prisma client and honour overrides', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'acc-1' })
    const userCreate = vi.fn()
    const db = {
      stellarAccount: { create },
      user: { create: userCreate },
    }

    const account = await root.createStellarAccount(db as never, {
      userId: 'u-1',
      balance: 250,
    })

    expect(account).toEqual({ id: 'acc-1' })
    expect(userCreate).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u-1', balance: 250 }),
      }),
    )
  })
})
