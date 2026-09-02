/**
 * Pact Consumer Contract Tests – Workers API
 * Closes #430
 */
import { MatchersV3,PactV3 } from '@pact-foundation/pact';
import path from 'path';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

const { like, eachLike, string, integer } = MatchersV3;

const provider = new PactV3({
  consumer: 'BlueCollarApp',
  provider: 'BlueCollarAPI',
  dir: path.resolve(__dirname, '../../../pacts'),
  logLevel: 'warn',
});

describe('Workers API – Consumer Contract', () => {
  describe('GET /api/workers', () => {
    beforeAll(async () => {
      await provider.addInteraction({
        states: [{ description: 'workers exist' }],
        uponReceiving: 'a request for all workers',
        withRequest: {
          method: 'GET',
          path: '/api/workers',
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: string('success'),
            data: eachLike({
              id: string('worker-id-1'),
              name: string('John Doe'),
              category: like({ id: string('cat-1'), name: string('Plumber') }),
              isActive: like(true),
            }),
          },
        },
      });
    });

    it('returns a list of workers', async () => {
      await provider.executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/workers`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.status).toBe('success');
        expect(Array.isArray(body.data)).toBe(true);
      });
    });
  });

  describe('GET /api/workers/:id', () => {
    beforeAll(async () => {
      await provider.addInteraction({
        states: [{ description: 'worker with id worker-id-1 exists' }],
        uponReceiving: 'a request for a single worker',
        withRequest: {
          method: 'GET',
          path: '/api/workers/worker-id-1',
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: string('success'),
            data: {
              id: string('worker-id-1'),
              name: string('John Doe'),
              category: like({ id: string('cat-1'), name: string('Plumber') }),
              isActive: like(true),
            },
          },
        },
      });
    });

    it('returns a single worker', async () => {
      await provider.executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/workers/worker-id-1`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.id).toBe('worker-id-1');
      });
    });
  });

  describe('GET /api/categories', () => {
    beforeAll(async () => {
      await provider.addInteraction({
        states: [{ description: 'categories exist' }],
        uponReceiving: 'a request for all categories',
        withRequest: {
          method: 'GET',
          path: '/api/categories',
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: string('success'),
            data: eachLike({
              id: string('cat-1'),
              name: string('Plumber'),
            }),
          },
        },
      });
    });

    it('returns a list of categories', async () => {
      await provider.executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/categories`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.status).toBe('success');
        expect(Array.isArray(body.data)).toBe(true);
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      await provider.addInteraction({
        states: [{ description: 'user with email test@example.com exists' }],
        uponReceiving: 'a valid login request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: {
            email: 'test@example.com',
            password: 'Password123!',
          },
        },
        willRespondWith: {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: string('success'),
            token: string('jwt-token'),
            data: like({
              id: string('user-id-1'),
              email: string('test@example.com'),
              role: string('user'),
            }),
          },
        },
      });
    });

    it('returns a token on valid login', async () => {
      await provider.executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
        });
        const body = await res.json();
        expect(res.status).toBe(202);
        expect(body.token).toBeDefined();
      });
    });
  });
});
