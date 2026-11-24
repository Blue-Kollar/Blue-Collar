/**
 * Shared axe-core assertion helper for the app's a11y regression suites
 * (issue #1878).
 *
 * Every key-page test renders into jsdom, calls axe through this helper and
 * asserts that `blocking` is empty. The gate is intentionally strict on
 * WCAG 2.1 A/AA serious + critical violations. Best-practice-only rules can be
 * suppressed per-test via `allowedBestPracticeRules` with an inline comment;
 * a WCAG rule can never be suppressed through that option.
 *
 * `color-contrast` is disabled here because Vitest runs with `css: false` and
 * jsdom has no layout engine, so computed colours are meaningless. Real-browser
 * contrast coverage lives in `e2e/a11y/core-pages.spec.ts`.
 */
import axe, { type Result } from 'axe-core';
import { expect } from 'vitest';

export const WCAG_21_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
] as const;

export interface A11yOptions {
  /**
   * Best-practice (non-WCAG) rule ids that this surface knowingly allows.
   * Each entry must be justified by a comment in the calling test.
   */
  allowedBestPracticeRules?: readonly string[];
  /** Override the default WCAG 2.1 AA + best-practice tag set. */
  tags?: readonly string[];
}

export interface A11yReport {
  /** Violations that must make the test fail. */
  blocking: Result[];
  /** Documented best-practice exceptions that were allowed. */
  allowed: Result[];
  /** Minor/moderate findings that do not breach the serious/critical gate. */
  advisory: Result[];
}

export function formatViolations(violations: readonly Result[]): string {
  if (violations.length === 0) return '';
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help} (${
          v.tags.filter((tag) => tag.startsWith('wcag')).join(', ') || 'best-practice'
        })\n` + `  ${v.nodes.map((n) => n.html).join('\n  ')}`,
    )
    .join('\n');
}

function isWcagRule(violation: Result): boolean {
  return violation.tags.some((tag) => tag.startsWith('wcag'));
}

/**
 * Run axe against a rendered element and classify the violations. Never throws
 * for violations — use `expectNoA11yViolations` (or assert on `blocking`)
 * to fail the test.
 */
export async function getA11yReport(
  element: Element,
  { allowedBestPracticeRules = [], tags = WCAG_21_AA_TAGS }: A11yOptions = {},
): Promise<A11yReport> {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: [...tags] },
    rules: { 'color-contrast': { enabled: false } },
  });

  const allowed = new Set(allowedBestPracticeRules);
  const report: A11yReport = { blocking: [], allowed: [], advisory: [] };

  for (const violation of results.violations) {
    if (allowed.has(violation.id)) {
      if (isWcagRule(violation)) {
        throw new Error(
          `Invalid a11y exception: "${violation.id}" is a WCAG rule and cannot be suppressed ` +
            `via allowedBestPracticeRules. Fix the violation instead.`,
        );
      }
      report.allowed.push(violation);
      continue;
    }

    if (violation.impact === 'critical' || violation.impact === 'serious') {
      report.blocking.push(violation);
    } else {
      report.advisory.push(violation);
    }
  }

  return report;
}

/** Assert that the rendered element has no blocking WCAG 2.1 AA violations. */
export async function expectNoA11yViolations(
  element: Element,
  options: A11yOptions = {},
): Promise<A11yReport> {
  const report = await getA11yReport(element, options);
  expect(
    report.blocking,
    `Accessibility violations:\n${formatViolations(report.blocking)}`,
  ).toHaveLength(0);
  return report;
}
