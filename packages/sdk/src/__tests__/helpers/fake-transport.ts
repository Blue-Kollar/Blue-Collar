/**
 * Shared fake transport for SDK tests.
 *
 * Tests must never reach Horizon or Soroban RPC. Use `jsonResponse` to build
 * canned responses and `fakeFetch` to route requests to handlers you control.
 * Request payloads are recorded on the returned spy so tests can assert on them.
 */
import { vi } from 'vitest';

export type FakeRoute = (url: string, init?: RequestInit) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), { status, statusText });
}

/**
 * Replace the global `fetch` with a fake that delegates to `route`.
 * Returns the spy so callers can inspect `mock.calls` for URLs and bodies.
 */
export function fakeFetch(route: FakeRoute) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    route(String(input), init),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Parse the JSON-RPC or REST body of a recorded request. */
export function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(String(init?.body ?? 'null'));
}
