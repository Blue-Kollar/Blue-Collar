/**
 * Tests for the shared contract test fixtures (issue #1276).
 *
 * These fixtures centralise the repeated "account setup" boilerplate that
 * previously lived inline in contract/SDK integration tests.  The tests here
 * guarantee the helpers produce deterministic, isolated, well-formed accounts
 * and that the common account states (fresh / funded / zero-balance /
 * authorized / unauthorized / sender+recipient) carry the right semantics.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  authorizedAccount,
  buildMockAccountResponse,
  freshAccount,
  fundedAccount,
  makeAccountStates,
  makeSenderRecipient,
  makeTestAccount,
  makeTestAccountSet,
  resetAllCounters,
  unauthorizedAccount,
  zeroBalanceAccount,
} from '../src/contract-fixtures'

const ADMIN_KEY = 'GADMIN111111111111111111111111111111111111111111111111ADMIN'

describe('common account-state fixtures', () => {
  beforeEach(() => resetAllCounters())

  it('freshAccount is unfunded and uninitialized', () => {
    const acct = freshAccount()
    expect(acct.balance).toBe('0.0000000')
    expect(acct.authorized).toBeUndefined()
    expect(acct.label).toBe('fresh')
  })

  it('fundedAccount has the default balance and is authorized by default', () => {
    const acct = fundedAccount()
    expect(acct.balance).toBe('10000.0000000')
    expect(acct.authorized).toBe(true)
  })

  it('fundedAccount honours an explicit balance override', () => {
    const acct = fundedAccount({ balance: '42.0000000' })
    expect(acct.balance).toBe('42.0000000')
  })

  it('zeroBalanceAccount has exactly zero native balance', () => {
    const acct = zeroBalanceAccount()
    expect(acct.balance).toBe('0.0000000')
    expect(acct.label).toBe('zero-balance')
  })

  it('authorizedAccount is flagged authorized', () => {
    expect(authorizedAccount().authorized).toBe(true)
  })

  it('unauthorizedAccount is flagged unauthorized', () => {
    const acct = unauthorizedAccount()
    expect(acct.authorized).toBe(false)
  })

  it('freshAccount can be explicitly marked authorized', () => {
    expect(freshAccount({ authorized: true }).authorized).toBe(true)
  })

  it('makeSenderRecipient returns two distinct funded accounts', () => {
    const { sender, recipient } = makeSenderRecipient()
    expect(sender.publicKey).not.toBe(recipient.publicKey)
    expect(sender.balance).toBe('10000.0000000')
    expect(recipient.balance).toBe('10000.0000000')
    expect(sender.authorized).toBe(true)
  })

  it('makeSenderRecipient honours per-party balance overrides', () => {
    const { sender, recipient } = makeSenderRecipient({
      sender: '1.0000000',
      recipient: '2.0000000',
    })
    expect(sender.balance).toBe('1.0000000')
    expect(recipient.balance).toBe('2.0000000')
  })

  it('makeAccountStates exposes every common state', () => {
    const states = makeAccountStates()
    expect(Object.keys(states).sort()).toEqual(
      ['authorized', 'fresh', 'funded', 'recipient', 'sender', 'unauthorized', 'zeroBalance'].sort(),
    )
    expect(states.fresh.balance).toBe('0.0000000')
    expect(states.funded.authorized).toBe(true)
    expect(states.unauthorized.authorized).toBe(false)
  })
})

describe('determinism & isolation', () => {
  beforeEach(() => resetAllCounters())

  it('makeTestAccount is deterministic across calls within a reset window', () => {
    const a = makeTestAccount({ label: 'admin' })
    const b = makeTestAccount({ label: 'curator' })
    expect(a.publicKey).toBe(ADMIN_KEY)
    expect(b.label).toBe('curator')
  })

  it('resetAllCounters yields identical key sequences run-to-run', () => {
    const first = makeTestAccountSet()
    resetAllCounters()
    const second = makeTestAccountSet()
    expect(first.admin.publicKey).toBe(second.admin.publicKey)
    expect(first.worker.publicKey).toBe(second.worker.publicKey)
  })

  it('worker and feeRecipient start at zero balance by convention', () => {
    const { worker, feeRecipient } = makeTestAccountSet()
    expect(worker.balance).toBe('0.0000000')
    expect(feeRecipient.balance).toBe('0.0000000')
  })
})

describe('funding / account-response fixtures', () => {
  it('buildMockAccountResponse encodes balance and sequence', async () => {
    const acct = fundedAccount({ balance: '250.0000000' })
    const res = buildMockAccountResponse(acct, '987654321')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.balances[0]).toMatchObject({ asset_type: 'native', balance: '250.0000000' })
    expect(body.sequence).toBe('987654321')
  })
})
