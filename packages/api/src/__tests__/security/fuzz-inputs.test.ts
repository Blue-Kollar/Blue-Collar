/**
 * Deterministic input-fuzzing security tests (#1880).
 *
 * Fixed corpora of SQL injection and XSS payloads are replayed across the
 * representative API input boundaries: job search (raw SQL path), auth,
 * messaging, contact requests, wallet memos and HTML email generation.
 *
 * There is no randomness: every payload is a literal from the tables below,
 * every test is repeatable, and all DB/network edges are mocked.
 */
import { describe, it, expect, vi, beforeEach, vi as vitestVi } from 'vitest'
import express from 'express'
import request from 'supertest'

const emailWorkerHarness = vi.hoisted(() => ({ processor: null as null | ((job: unknown) => Promise<void>) }))

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────

vi.mock('@bluecollar/sdk', () => ({
  TESTNET_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  TESTNET_FRIENDBOT_URL: 'https://friendbot.stellar.org',
}))

vi.mock('@/db.js', () => ({
  db: {
    $queryRawUnsafe: vi.fn(),
    searchAnalytics: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/services/worker.service.js', () => ({
  advancedSearch: vi.fn(),
  trackSearchAnalytics: vi.fn(),
}))

vi.mock('@/resources/index.js', () => ({
  WorkerResource: (w: Record<string, unknown>) => w,
}))

vi.mock('@/repositories/messaging.repository.js', () => ({
  messagingRepository: {
    createConversation: vi.fn(async (args: Record<string, unknown>) => ({ id: 'conv-1', ...args })),
    searchMessages: vi.fn(async (_id: string, query: string) => [{ id: 'm-1', body: query }]),
    findConversation: vi.fn().mockResolvedValue({ id: 'conv-1' }),
  },
}))

vi.mock('@/repositories/wallet.repository.js', () => ({
  walletRepository: {
    findByPublicKey: vi.fn(),
    findByUserId: vi.fn(),
    upsertAccount: vi.fn(),
  },
}))

vi.mock('@/clients/stellar.client.js', () => ({
  stellarClient: { getAccountInfo: vi.fn().mockResolvedValue({ balance: 1, sequence: 1n }) },
  StellarClient: vi.fn(),
}))

vi.mock('@/services/contact-request.service.js', () => ({
  createContactRequest: vi.fn(async (_workerId: string, _userId: string, message: string) => ({
    id: 'cr-1',
    message,
  })),
}))

vi.mock('@/mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'fuzz-test' }) },
}))

vi.mock('@/repositories/notification.repository.js', () => ({
  notificationRepository: {
    findUserEmailAndName: vi.fn().mockResolvedValue({ email: 'user@test.local', name: 'User' }),
  },
}))

vi.mock('bullmq', () => ({
  Worker: vitestVi.fn().mockImplementation((_name: string, processor: unknown) => {
    emailWorkerHarness.processor = processor as (job: unknown) => Promise<void>
    return { on: vitestVi.fn(), close: vitestVi.fn() }
  }),
}))

vi.mock('@/config/redis.js', () => ({
  redis: { options: { host: 'localhost', port: 6379 }, connect: vi.fn() },
}))

vi.mock('@/utils/gracefulShutdown.js', () => ({
  registerGracefulShutdown: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { sanitizeText, sanitizeValue, escapeHtml, sanitize } from '@/middleware/sanitize.js'
import { searchWorkers } from '@/services/search.service.js'
import { db } from '@/db.js'
import { loginRules, registerRules } from '@/validations/auth.js'
import { searchWorkersQuerySchema } from '@/validations/worker.js'
import { createMessagingService } from '@/services/messaging.service.js'
import { messagingRepository } from '@/repositories/messaging.repository.js'
import { createWalletService } from '@/services/wallet.service.js'
import { walletRepository } from '@/repositories/wallet.repository.js'
import * as contactRequestService from '@/services/contact-request.service.js'
import { createContactRequest } from '@/controllers/contact-request.js'
import { render } from '@/mailer/templateEngine.js'
import { sendVerificationStatusEmail } from '@/mailer/index.js'
import { EmailChannel } from '@/services/channels/EmailChannel.js'
import { transporter } from '@/mailer/transport.js'
import type { EmailJobData } from '@/queue/index.js'

// ── Payload corpus (static, no randomness) ────────────────────────────────────

const SQLI_PAYLOADS = [
  "' OR 1=1--",
  "' OR 1=1",
  "' AND 1=1",
  "' OR '1'='1",
  "'; DROP TABLE users;--",
  "' UNION SELECT * FROM users --",
  "UNION SELECT username, password FROM users--",
  "admin'--",
  "1; SELECT * FROM information_schema.tables",
  "'/**/OR/**/1=1--",
  "';UPDATE users SET admin=1;--",
  "') OR 1=1; --",
]

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<img src="x" onerror="alert(document.cookie)">',
  '<svg onload=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<body onload=alert(1)>',
  '<SCRIPT>alert(String.fromCharCode(1))</SCRIPT>',
]

const URL_XSS_PAYLOADS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '%3Cscript%3Ealert(1)%3C/script%3E',
]

const ALL_XSS_PAYLOADS = [...XSS_PAYLOADS, ...URL_XSS_PAYLOADS]

const EXECUTABLE_HTML_RE = /<\s*\/?\s*(script|iframe|svg)\b|<\w+[^>]*\s+on(error|load|click)\s*=/i
const DANGEROUS_URL_RE = /(href|src|action)\s*=\s*(?:"[^"]*(javascript|data):|'[^']*(javascript|data):|(javascript|data):)/i

function expectNoExecutableHtml(value: string) {
  expect(value).not.toMatch(EXECUTABLE_HTML_RE)
}

function expectNoDangerousUrl(value: string) {
  expect(value).not.toMatch(DANGEROUS_URL_RE)
}

function expectNoVerbatim(serialized: string, payload: string) {
  expect(serialized).not.toContain(payload)
}

// ── 1. Sanitizer helpers ──────────────────────────────────────────────────────

describe('Fuzz – sanitization helpers', () => {
  it.each(SQLI_PAYLOADS)('sanitizeText blanks SQL payload: %s', (payload) => {
    expect(sanitizeText(payload)).toBe('')
  })

  it.each(XSS_PAYLOADS)('sanitizeText neutralises executable HTML: %s', (payload) => {
    const sanitized = sanitizeText(payload)
    expect(sanitized).not.toBe(payload)
    expectNoExecutableHtml(sanitized)
  })

  it.each(URL_XSS_PAYLOADS)('URL-style XSS stays inert plain text: %s', (payload) => {
    const sanitized = sanitizeText(payload)
    expectNoExecutableHtml(sanitized)
    expect(sanitized).not.toContain('<')
    expect(sanitized).not.toContain('>')
  })

  it.each(XSS_PAYLOADS)('escapeHtml never emits a raw tag: %s', (payload) => {
    const escaped = escapeHtml(payload)
    expectNoVerbatim(escaped, payload)
    expectNoExecutableHtml(escaped)
    expect(escaped).not.toContain('<')
    expect(escaped).not.toContain('>')
  })

  it('sanitizeValue recursively sanitizes nested free text', () => {
    const input = {
      bio: '<script>alert(1)</script>',
      tags: ['<img src=x onerror=alert(1)>', 'clean'],
      meta: { note: "'; DROP TABLE users;--" },
      count: 7,
    }
    const serialized = JSON.stringify(sanitizeValue(input))
    expectNoExecutableHtml(serialized)
    expectNoVerbatim(serialized, '<script>alert(1)</script>')
    expectNoVerbatim(serialized, '<img src=x onerror=alert(1)>')
    expectNoVerbatim(serialized, "'; DROP TABLE users;--")
  })
})

// ── 2. Job search (raw SQL path) ──────────────────────────────────────────────

describe('Fuzz – job search / raw SQL boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.$queryRawUnsafe)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
  })

  it.each(SQLI_PAYLOADS)('FTS payload stays a bound parameter, never SQL: %s', async (payload) => {
    const result = await searchWorkers({ query: payload, lang: 'simple' }, '127.0.0.1')
    const calls = vi.mocked(db.$queryRawUnsafe).mock.calls

    expect(calls).toHaveLength(2)
    for (const [sql] of calls) {
      expect(String(sql)).not.toContain(payload)
      expect(String(sql)).toContain('$1')
      expect(String(sql)).toContain('$2')
      expect(String(sql)).not.toMatch(/drop\s+table|information_schema|1=1/i)
    }
    expect(calls[0]?.[1]).toContain(payload)
    expectNoVerbatim(JSON.stringify(result), payload)
  })

  it.each(XSS_PAYLOADS)('FTS payload is not reflected in search results: %s', async (payload) => {
    vi.mocked(db.$queryRawUnsafe).mockReset()
    vi.mocked(db.$queryRawUnsafe)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])

    const result = await searchWorkers({ query: payload })
    expectNoVerbatim(JSON.stringify(result), payload)
    expectNoExecutableHtml(JSON.stringify(result))
  })

  it.each(SQLI_PAYLOADS)('lang cannot inject a regconfig: %s', async (payload) => {
    vi.mocked(db.$queryRawUnsafe).mockReset()
    vi.mocked(db.$queryRawUnsafe)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])

    await searchWorkers({ query: 'plumber', lang: payload })
    const calls = vi.mocked(db.$queryRawUnsafe).mock.calls
    const params = (calls[0] ?? []).slice(1) as unknown[]
    expect(params[1]).toBe('simple')
    expect(String(calls[0]?.[0])).not.toContain(payload)
  })

  it.each(SQLI_PAYLOADS)('sortBy cannot inject an ORDER BY clause: %s', async (payload) => {
    vi.mocked(db.$queryRawUnsafe).mockReset()
    vi.mocked(db.$queryRawUnsafe)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])

    await searchWorkers({ query: 'plumber', sortBy: payload as never })
    const sql = String(vi.mocked(db.$queryRawUnsafe).mock.calls[0]?.[0])
    expect(sql).not.toContain(payload)
    expect(sql).toMatch(/ORDER BY (rank DESC|.*"createdAt" DESC)/)
  })

  it('search query schema accepts bounded text but rejects injected enum values', () => {
    for (const payload of SQLI_PAYLOADS) {
      expect(searchWorkersQuerySchema.safeParse({ q: payload, lang: payload, sortBy: payload }).success).toBe(false)
      expect(searchWorkersQuerySchema.safeParse({ q: payload }).success).toBe(true)
    }
  })
})

// ── 3. Auth boundary ──────────────────────────────────────────────────────────

function buildAuthApp() {
  const app = express()
  app.use(express.json())
  app.use(sanitize)
  app.post('/login', (req, res) => {
    const parsed = loginRules.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ status: 'error' })
    return res.json({ status: 'success', email: parsed.data.email })
  })
  app.post('/register', (req, res) => {
    const parsed = registerRules.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ status: 'error' })
    return res.json({ status: 'success', firstName: parsed.data.firstName })
  })
  return app
}

describe('Fuzz – auth boundary', () => {
  const app = buildAuthApp()

  it.each(SQLI_PAYLOADS)('rejects SQL payload in email and password: %s', async (payload) => {
    const login = await request(app).post('/login').send({ email: payload, password: payload })
    const register = await request(app)
      .post('/register')
      .send({ email: payload, password: 'Password123!', firstName: 'A', lastName: 'B' })

    expect(login.status).toBe(400)
    expect(register.status).toBe(400)
    expectNoVerbatim(JSON.stringify(login.body), payload)
    expectNoVerbatim(JSON.stringify(register.body), payload)
  })

  it.each(XSS_PAYLOADS)('name payload is rejected or stripped before response: %s', async (payload) => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'fuzz@test.local', password: 'Password123!', firstName: payload, lastName: 'B' })

    expect([200, 400]).toContain(res.status)
    expectNoVerbatim(JSON.stringify(res.body), payload)
    expectNoExecutableHtml(JSON.stringify(res.body))
  })
})

// ── 4. Messaging boundary ─────────────────────────────────────────────────────

describe('Fuzz – messaging boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(SQLI_PAYLOADS)('SQL payload in subject is blanked before persistence: %s', async (payload) => {
    const service = createMessagingService({ messagingRepository: messagingRepository as never })
    await service.createConversation(['u-1', 'u-2'], payload)
    const stored = vi.mocked(messagingRepository.createConversation).mock.calls.at(-1)?.[0]
    expect(stored?.subject).toBe('')
    expectNoVerbatim(JSON.stringify(stored), payload)
  })

  it.each(XSS_PAYLOADS)('XSS payload in subject is sanitized before persistence: %s', async (payload) => {
    const service = createMessagingService({ messagingRepository: messagingRepository as never })
    await service.createConversation(['u-1', 'u-2'], payload)
    const stored = vi.mocked(messagingRepository.createConversation).mock.calls.at(-1)?.[0]
    expectNoVerbatim(JSON.stringify(stored), payload)
    expectNoExecutableHtml(JSON.stringify(stored))
  })

  it.each(ALL_XSS_PAYLOADS)('message search query is sanitized before persistence lookup: %s', async (payload) => {
    const service = createMessagingService({ messagingRepository: messagingRepository as never })
    await service.searchMessages('conv-1', payload, 'u-1')
    const query = vi.mocked(messagingRepository.searchMessages).mock.calls.at(-1)?.[1] ?? ''
    expectNoExecutableHtml(query)
    if (XSS_PAYLOADS.includes(payload)) expectNoVerbatim(JSON.stringify(query), payload)
  })
})

// ── 5. Contact request boundary ───────────────────────────────────────────────

function buildContactApp() {
  const app = express()
  app.use(express.json())
  app.use(sanitize)
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { id: string } }).user = { id: 'u-1' }
    next()
  })
  app.post('/workers/:id/contact', createContactRequest)
  return app
}

describe('Fuzz – contact request boundary', () => {
  const app = buildContactApp()

  beforeEach(() => vi.clearAllMocks())

  it.each(SQLI_PAYLOADS)('rejects SQL payload in contact message: %s', async (payload) => {
    const res = await request(app).post('/workers/w-1/contact').send({ message: payload })
    expect(res.status).toBe(400)
    expect(contactRequestService.createContactRequest).not.toHaveBeenCalled()
  })

  it.each(XSS_PAYLOADS)('sanitizes XSS payload before persistence and response: %s', async (payload) => {
    const res = await request(app).post('/workers/w-1/contact').send({ message: payload })
    if (res.status === 400) {
      expect(contactRequestService.createContactRequest).not.toHaveBeenCalled()
      return
    }
    expect(res.status).toBe(201)
    const persisted = vi.mocked(contactRequestService.createContactRequest).mock.calls.at(-1)?.[2] ?? ''
    expectNoVerbatim(persisted, payload)
    expectNoVerbatim(JSON.stringify(res.body), payload)
    expectNoExecutableHtml(persisted)
  })

  it.each(URL_XSS_PAYLOADS)('URL-style message stays inert text: %s', async (payload) => {
    const res = await request(app).post('/workers/w-1/contact').send({ message: payload })
    if (res.status === 400) {
      expect(contactRequestService.createContactRequest).not.toHaveBeenCalled()
      return
    }
    expect(res.status).toBe(201)
    const persisted = vi.mocked(contactRequestService.createContactRequest).mock.calls.at(-1)?.[2] ?? ''
    expectNoExecutableHtml(persisted)
    expect(persisted).not.toContain('<')
    expect(persisted).not.toContain('>')
  })
})

// ── 6. Wallet memo boundary ───────────────────────────────────────────────────

describe('Fuzz – wallet memo boundary', () => {
  const SOURCE = 'GSOURCE'
  const DEST = 'GDEST'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(walletRepository.findByPublicKey).mockResolvedValue({ publicKey: SOURCE, userId: 'u-1' } as never)
  })

  it.each([...SQLI_PAYLOADS, ...XSS_PAYLOADS])('memo is sanitized in unsigned tx: %s', async (payload) => {
    const service = createWalletService({
      walletRepository: walletRepository as never,
      stellarClient: { getAccountInfo: vi.fn().mockResolvedValue({ balance: 1, sequence: 1n }) } as never,
    })
    const tx = await service.buildUnsignedTx(SOURCE, DEST, '1', payload)
    expect(tx.memo).not.toBe(payload)
    expectNoExecutableHtml(tx.memo)
  })

  it.each(URL_XSS_PAYLOADS)('URL-style memo stays inert text: %s', async (payload) => {
    const service = createWalletService({
      walletRepository: walletRepository as never,
      stellarClient: { getAccountInfo: vi.fn().mockResolvedValue({ balance: 1, sequence: 1n }) } as never,
    })
    const tx = await service.buildUnsignedTx(SOURCE, DEST, '1', payload)
    expectNoExecutableHtml(tx.memo)
  })
})

// ── 7. HTML email generation ──────────────────────────────────────────────────

describe('Fuzz – HTML email boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(ALL_XSS_PAYLOADS)('template vars are escaped: %s', (payload) => {
    const html = render('notification.html', {
      subject: payload,
      name: payload,
      message: payload,
      extraHtml: '',
      ctaText: 'View',
      ctaLink: 'https://example.com',
    })
    if (XSS_PAYLOADS.includes(payload)) expectNoVerbatim(html, payload)
    expectNoExecutableHtml(html)
    expectNoDangerousUrl(html)
  })

  it.each(ALL_XSS_PAYLOADS)('verification review note cannot inject HTML: %s', async (payload) => {
    await sendVerificationStatusEmail('to@test.local', 'First', 'Worker', 'rejected', payload)
    const html = String(vi.mocked(transporter.sendMail).mock.calls.at(-1)?.[0]?.html ?? '')
    if (XSS_PAYLOADS.includes(payload)) expectNoVerbatim(html, payload)
    expectNoExecutableHtml(html)
    expectNoDangerousUrl(html)
  })

  it.each(URL_XSS_PAYLOADS)('notification href rejects non-http(s) schemes: %s', async (payload) => {
    const channel = new EmailChannel()
    const result = await channel.send({
      userId: 'u-1',
      type: 'system',
      title: 'Test',
      message: 'hello',
      href: payload,
    })
    expect(result.status).toBe('sent')
    const html = String(vi.mocked(transporter.sendMail).mock.calls.at(-1)?.[0]?.html ?? '')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain(payload)
    expect(html).toContain('<p>hello</p>')
  })

  it.each(XSS_PAYLOADS)('notification message is escaped in email HTML: %s', async (payload) => {
    const channel = new EmailChannel()
    await channel.send({ userId: 'u-1', type: 'system', title: 'Test', message: payload })
    const html = String(vi.mocked(transporter.sendMail).mock.calls.at(-1)?.[0]?.html ?? '')
    expectNoVerbatim(html, payload)
    expectNoExecutableHtml(html)
  })

  it('queued email worker escapes context.message in HTML', async () => {
    await import('@/workers/email.worker.js')
    expect(emailWorkerHarness.processor).toBeTypeOf('function')

    for (const payload of ALL_XSS_PAYLOADS) {
      await emailWorkerHarness.processor!({
        id: 'job-1',
        data: {
          to: 'to@test.local',
          subject: 'Test',
          templateName: 'notification.html',
          context: { message: payload },
        } satisfies EmailJobData,
      })
      const html = String(vi.mocked(transporter.sendMail).mock.calls.at(-1)?.[0]?.html ?? '')
      if (XSS_PAYLOADS.includes(payload)) expectNoVerbatim(html, payload)
      expectNoExecutableHtml(html)
    }
  })
})
