/**
 * Pact Provider Verification – BlueCollarAPI
 * Closes #430
 *
 * Verifies that the running API satisfies all consumer pacts.
 * Run with: pnpm test:contract:provider
 */
import { Verifier } from '@pact-foundation/pact';
import { createServer } from 'http';
import path from 'path';
import { afterAll,beforeAll, describe, it } from 'vitest';

import app from '../../app.js';

let server: ReturnType<typeof createServer>;
let port: number;

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Provider Verification – BlueCollarAPI', () => {
  it('satisfies all consumer pacts', async () => {
    const verifier = new Verifier({
      provider: 'BlueCollarAPI',
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: [path.resolve(__dirname, '../../../pacts')],
      logLevel: 'warn',
      stateHandlers: {
        'workers exist': async () => {
          // State setup handled by test DB seed; no-op in unit mode
        },
        'worker with id worker-id-1 exists': async () => {
          // no-op
        },
        'categories exist': async () => {
          // no-op
        },
        'user with email test@example.com exists': async () => {
          // no-op
        },
      },
    });

    await verifier.verifyProvider();
  }, 60_000);
});
