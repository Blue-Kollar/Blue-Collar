import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/wallet/account/{publicKey}', tags: ['Wallet'],
  summary: 'Get Stellar account info for a public key (public)',
  request: { params: z.object({ publicKey: z.string() }) },
  responses: {
    200: { description: 'Account info', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } },
    404: { description: 'Account not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/wallet/testnet-fund', tags: ['Wallet'],
  summary: 'Fund a testnet account via Friendbot (public)',
  request: { body: { content: { 'application/json': { schema: z.object({ publicKey: z.string() }) } } } },
  responses: { 200: { description: 'Account funded', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/wallet/transactions/{publicKey}', tags: ['Wallet'],
  summary: 'Get recent transactions for a public key (public)',
  request: {
    params: z.object({ publicKey: z.string() }),
    query: z.object({ limit: z.string().optional(), order: z.enum(['asc', 'desc']).optional() }),
  },
  responses: { 200: { description: 'Transactions', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/wallet/balance', tags: ['Wallet'],
  summary: "Get the authenticated user's linked wallet balance",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Balance', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/wallet/link', tags: ['Wallet'],
  summary: 'Link a Stellar public key to the authenticated user',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ publicKey: z.string().length(56) }) } } } },
  responses: {
    201: { description: 'Wallet linked', content: { 'application/json': { schema: z.object({ status: z.literal('success'), code: z.number(), message: z.string(), data: z.record(z.unknown()) }) } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/wallet/build-tx', tags: ['Wallet'],
  summary: 'Build an unsigned Stellar transaction envelope',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ sourcePublicKey: z.string(), destinationPublicKey: z.string(), amount: z.string(), memo: z.string().optional() }) } } } },
  responses: { 200: { description: 'Unsigned transaction XDR', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/wallet/broadcast', tags: ['Wallet'],
  summary: 'Submit a signed transaction to the network',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ signedXdr: z.string() }) } } } },
  responses: { 200: { description: 'Submission result', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/wallet/tx-status/{txHash}', tags: ['Wallet'],
  summary: 'Poll the status of a submitted transaction',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ txHash: z.string() }) },
  responses: { 200: { description: 'Transaction status', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})
