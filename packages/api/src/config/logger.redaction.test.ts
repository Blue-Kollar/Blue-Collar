/**
 * PII redaction for the structured logger (#1829).
 * Runs pino with the exported REDACT_PATHS against an in-memory stream.
 */

import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Writable } from 'node:stream';
import { REDACT_PATHS } from './logger';

function createCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const log = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { log, lines };
}

describe('logger PII redaction (#1829)', () => {
  it('redacts email and phone at the top level', () => {
    const { log, lines } = createCapturingLogger();

    log.info({ email: 'jane@example.com', phone: '+2348000000000' }, 'signup');

    const entry = JSON.parse(lines[0]);
    expect(entry.email).toBe('[REDACTED]');
    expect(entry.phone).toBe('[REDACTED]');
  });

  it('redacts email and phone nested one level deep', () => {
    const { log, lines } = createCapturingLogger();

    log.info({ user: { email: 'jane@example.com', phone: '+2348000000000' } }, 'profile');

    const entry = JSON.parse(lines[0]);
    expect(entry.user.email).toBe('[REDACTED]');
    expect(entry.user.phone).toBe('[REDACTED]');
  });

  it('keeps non-sensitive fields', () => {
    const { log, lines } = createCapturingLogger();

    log.info({ userId: 'user-1', email: 'jane@example.com' }, 'login');

    const entry = JSON.parse(lines[0]);
    expect(entry.userId).toBe('user-1');
  });
});
