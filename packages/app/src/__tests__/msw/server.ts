/**
 * Shared MSW v2 server for Vitest (issue #1870).
 *
 * Started once from `src/__tests__/setup.ts`; handlers are reset after every
 * test so an override in one test cannot leak into the next.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
