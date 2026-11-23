/**
 * Tests for the shared MSW handlers (issue #1870).
 *
 * These verify that the fixtures used across app tests are reachable through
 * the real apiClient and that error responses (4xx and 5xx) are deterministic
 * and fully offline.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiClient, buildUrl } from '@/lib/api/client';
import { mockCategories, mockJobs, mockUser, mockWalletBalance, mockWorkers } from './handlers';
import { server } from './server';

describe('shared MSW handlers', () => {
  describe('auth', () => {
    it('logs in with a fixed token and user', async () => {
      const response = (await apiClient.post('/auth/login', {
        email: 'worker@example.com',
        password: 'secret',
      })) as { token: string; data: { email: string; role: string } };

      expect(response.token).toBe('test-token');
      expect(response.data.email).toBe('worker@example.com');
      expect(response.data.role).toBe(mockUser.role);
    });

    it('returns a 4xx validation error when email is missing', async () => {
      const response = await fetch(buildUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('registers a new user with 201', async () => {
      const response = await fetch(buildUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com' }),
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        data: { email: 'new@example.com' },
      });
    });
  });

  describe('jobs', () => {
    it('lists jobs through the api client', async () => {
      const response = (await apiClient.get('/v1/jobs')) as { data: typeof mockJobs };
      expect(response.data).toEqual(mockJobs);
    });

    it('honours a query parameter when listing jobs', async () => {
      const response = (await apiClient.get('/v1/jobs?limit=1')) as { data: typeof mockJobs };
      expect(response.data).toHaveLength(1);
      expect(response.data[0]).toEqual(mockJobs[0]);
    });

    it('returns a job detail by id', async () => {
      const response = (await apiClient.get('/v1/jobs/job-2')) as {
        data: { id: string };
        status: string;
      };
      expect(response.data.id).toBe('job-2');
      expect(response.status).toBe('success');
    });

    it('returns 404 for an unknown job', async () => {
      const response = await fetch(buildUrl('/v1/jobs/unknown'));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns a 5xx response from the shared handler', async () => {
      const response = await fetch(buildUrl('/v1/jobs/unavailable'));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('categories and workers', () => {
    it('serves the category fixture', async () => {
      const response = (await apiClient.get('/categories')) as { data: typeof mockCategories };
      expect(response.data).toEqual(mockCategories);
    });

    it('serves worker list and detail fixtures', async () => {
      const list = (await apiClient.get('/workers')) as { data: typeof mockWorkers };
      expect(list.data).toEqual(mockWorkers);

      const detail = (await apiClient.get('/workers/worker-1')) as {
        data: { name: string };
      };
      expect(detail.data.name).toBe('Plumbing Pro');
    });

    it('returns a 5xx response when a test overrides the handler', async () => {
      server.use(
        http.get(buildUrl('/categories'), () =>
          HttpResponse.json({ message: 'Database unavailable' }, { status: 503 }),
        ),
      );

      const response = await fetch(buildUrl('/categories'));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ message: 'Database unavailable' });
    });
  });

  describe('wallet', () => {
    it('serves a native Horizon balance without network access', async () => {
      const response = await fetch('https://horizon-testnet.stellar.org/accounts/GTESTADDRESS');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        balances: [{ asset_type: 'native', balance: mockWalletBalance }],
      });
    });
  });
});
