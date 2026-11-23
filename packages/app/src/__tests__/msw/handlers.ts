/**
 * Shared MSW v2 handlers for app tests (issue #1870).
 *
 * Handlers cover the API surfaces used by `src/lib/api/*` plus the Horizon
 * account endpoint used by the wallet hooks. Tests stay fully offline and
 * deterministic: responses are fixed fixtures, never real network calls.
 *
 * Individual tests can override any handler with `server.use(...)` and rely
 * on the global `server.resetHandlers()` in the Vitest setup file.
 */
import { http, HttpResponse } from 'msw';
import { BASE } from '@/lib/api/client';

const API = BASE.replace(/\/+$/, '');

export const mockUser = {
  id: 'user-1',
  email: 'worker@example.com',
  firstName: 'Alex',
  lastName: 'Worker',
  role: 'worker',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const mockCategories = [
  { id: 'cat-1', slug: 'plumber', name: 'Plumbing' },
  { id: 'cat-2', slug: 'electrician', name: 'Electrical' },
];

export const mockWorkers = [
  {
    id: 'worker-1',
    name: 'Plumbing Pro',
    category: { id: 'cat-1', slug: 'plumber', name: 'Plumbing' },
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'worker-2',
    name: 'Electric Expert',
    category: { id: 'cat-2', slug: 'electrician', name: 'Electrical' },
    isActive: false,
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

export const mockJobs = [
  {
    id: 'job-1',
    title: 'Fix a leaky tap',
    description: 'Kitchen sink repair',
    categoryId: 'cat-1',
    status: 'open',
    budget: '25.0000000',
    createdAt: '2026-02-10T00:00:00.000Z',
  },
  {
    id: 'job-2',
    title: 'Install ceiling fan',
    description: 'Replace existing fixture',
    categoryId: 'cat-2',
    status: 'open',
    budget: '40.0000000',
    createdAt: '2026-02-11T00:00:00.000Z',
  },
];

export const mockWalletBalance = '100.0000000';

export const handlers = [
  // ── Auth ────────────────────────────────────────────────────────────────────
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    if (!body?.email) {
      return HttpResponse.json(
        { message: 'Email is required', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ data: { ...mockUser, email: body.email }, token: 'test-token' });
  }),
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    if (!body?.email) {
      return HttpResponse.json(
        { message: 'Email is required', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ data: { ...mockUser, email: body.email } }, { status: 201 });
  }),

  // ── Jobs ────────────────────────────────────────────────────────────────────
  http.get(`${API}/v1/jobs`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? mockJobs.length);
    return HttpResponse.json({ data: mockJobs.slice(0, limit), meta: { total: mockJobs.length } });
  }),
  http.get(`${API}/v1/jobs/:id`, ({ params }) => {
    if (params.id === 'unavailable') {
      return HttpResponse.json(
        { message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const job = mockJobs.find((item) => item.id === params.id);
    if (!job) {
      return HttpResponse.json({ message: 'Job not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return HttpResponse.json({ data: job, status: 'success' });
  }),

  // ── Categories ──────────────────────────────────────────────────────────────
  http.get(`${API}/categories`, () => HttpResponse.json({ data: mockCategories })),

  // ── Workers ─────────────────────────────────────────────────────────────────
  http.get(`${API}/workers`, () =>
    HttpResponse.json({ data: mockWorkers, meta: { total: mockWorkers.length } }),
  ),
  http.get(`${API}/workers/:id`, ({ params }) => {
    const worker = mockWorkers.find((item) => item.id === params.id);
    if (!worker) {
      return HttpResponse.json({ message: 'Worker not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return HttpResponse.json({ data: worker, status: 'success' });
  }),

  // ── Wallet (Horizon) ────────────────────────────────────────────────────────
  http.get('https://horizon-testnet.stellar.org/accounts/:address', () =>
    HttpResponse.json({
      balances: [{ asset_type: 'native', balance: mockWalletBalance }],
    }),
  ),
];
