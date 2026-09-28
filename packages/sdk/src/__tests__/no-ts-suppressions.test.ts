/**
 * Regression guard (#1485): the shared SDK is consumed by frontend and
 * mobile, so type-suppression comments here propagate risk to every
 * consumer. This test fails if a suppression is added without an
 * inline reason.
 *
 * Allowed forms:
 *   // @ts-expect-error - <non-empty reason>
 *
 * Forbidden forms:
 *   // @ts-ignore                      (never allowed — use @ts-expect-error)
 *   // @ts-expect-error                (no reason)
 *   // @ts-expect-error - TODO         (placeholder reason)
 *   // @ts-expect-error - TODO: add reason
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SDK_ROOT = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('packages/sdk has no unjustified TypeScript suppressions (#1485)', () => {
  const files = walk(SDK_ROOT);

  it('contains no @ts-ignore comments', () => {
    const hits: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/@ts-ignore\b/.test(line)) {
          hits.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits, `Use @ts-expect-error with a reason instead of @ts-ignore:\n${hits.join('\n')}`).toEqual([]);
  });

  it('every @ts-expect-error has a non-placeholder reason', () => {
    const bad: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/@ts-expect-error\s*(.*)$/);
        if (!m) return;
        const reason = m[1].replace(/^[-\s]+/, '').trim();
        if (
          reason.length === 0 ||
          /^TODO/i.test(reason) ||
          /^add reason$/i.test(reason) ||
          /^FIXME/i.test(reason)
        ) {
          bad.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      bad,
      `Every @ts-expect-error needs a specific reason on the same line:\n${bad.join('\n')}`,
    ).toEqual([]);
  });
});
