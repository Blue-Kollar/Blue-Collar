/**
 * Tests for the monitoring alert rule evaluation engine (issue #1277).
 *
 * Covers:
 *  - primitive threshold comparison (incl. boundary values)
 *  - missing / null / undefined / NaN / non-numeric metric values
 *  - expression parsing (simple + rate()/sum() wrapped forms)
 *  - YAML group loading
 *  - debounce (`for:`) pending → firing → ok transitions
 *  - disabled rules, multiple rules, empty input
 *  - severity propagation
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  AlertEvaluator,
  evaluateComparison,
  evaluateRules,
  loadAlertGroups,
  parseAlertExpression,
  parseDuration,
  type AlertRule,
  type MetricSample,
  type RawAlertGroups,
} from '../src/alerts'
import { makeTestAccountSet } from '@bluecollar/test-utils'

// ─── evaluateComparison ────────────────────────────────────────────────────────

describe('evaluateComparison', () => {
  it('returns true when value is strictly above a ">" threshold', () => {
    expect(evaluateComparison(11, '>', 10)).toBe(true)
  })

  it('returns false at the boundary for ">" (strict)', () => {
    expect(evaluateComparison(10, '>', 10)).toBe(false)
  })

  it('returns false when value is below a ">" threshold', () => {
    expect(evaluateComparison(9, '>', 10)).toBe(false)
  })

  it('returns false at the boundary for "<" (strict)', () => {
    expect(evaluateComparison(10, '<', 10)).toBe(false)
  })

  it('returns true when value is strictly below a "<" threshold', () => {
    expect(evaluateComparison(9, '<', 10)).toBe(true)
  })

  it('returns true at the boundary for ">="', () => {
    expect(evaluateComparison(10, '>=', 10)).toBe(true)
  })

  it('returns true at the boundary for "<="', () => {
    expect(evaluateComparison(10, '<=', 10)).toBe(true)
  })

  it('returns true for "==" only at the boundary', () => {
    expect(evaluateComparison(10, '==', 10)).toBe(true)
    expect(evaluateComparison(11, '==', 10)).toBe(false)
  })

  it('returns true for "!=" everywhere except the boundary', () => {
    expect(evaluateComparison(11, '!=', 10)).toBe(true)
    expect(evaluateComparison(10, '!=', 10)).toBe(false)
  })

  it('returns false for an unknown operator (defensive)', () => {
    // @ts-expect-error exercise the default branch
    expect(evaluateComparison(10, '%%', 10)).toBe(false)
  })
})

// ─── parseAlertExpression ──────────────────────────────────────────────────────

describe('parseAlertExpression', () => {
  it('parses a simple metric < threshold expression', () => {
    expect(parseAlertExpression('contract_balance < 1000')).toEqual({
      metric: 'contract_balance',
      operator: '<',
      threshold: 1000,
    })
  })

  it('parses a rate()-wrapped > expression and extracts the inner metric', () => {
    expect(parseAlertExpression('rate(contract_transactions_failed[5m]) > 0.1')).toEqual({
      metric: 'contract_transactions_failed',
      operator: '>',
      threshold: 0.1,
    })
  })

  it('parses a ratio expression and de-duplicates the metric', () => {
    const parsed = parseAlertExpression(
      'sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m])) > 0.05',
    )
    expect(parsed.metric).toBe('http_requests_total')
    expect(parsed.operator).toBe('>')
    expect(parsed.threshold).toBe(0.05)
  })

  it('parses histogram_quantile expressions', () => {
    const parsed = parseAlertExpression(
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2',
    )
    expect(parsed.metric).toBe('http_request_duration_seconds_bucket')
    expect(parsed.operator).toBe('>')
    expect(parsed.threshold).toBe(2)
  })

  it('parses "<=" and ">=" operators', () => {
    expect(parseAlertExpression('queue_depth <= 5')).toEqual({
      metric: 'queue_depth',
      operator: '<=',
      threshold: 5,
    })
    expect(parseAlertExpression('queue_depth >= 5')).toEqual({
      metric: 'queue_depth',
      operator: '>=',
      threshold: 5,
    })
  })

  it('throws when no comparison operator is present', () => {
    expect(() => parseAlertExpression('contract_balance + 1000')).toThrow(/no comparison/i)
  })

  it('throws when the threshold is not numeric', () => {
    expect(() => parseAlertExpression('contract_balance > abc')).toThrow(/threshold/i)
  })
})

// ─── parseDuration ──────────────────────────────────────────────────────────────

describe('parseDuration', () => {
  it('parses milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500)
  })
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30_000)
  })
  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300_000)
  })
  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7_200_000)
  })
  it('returns 0 for undefined / empty', () => {
    expect(parseDuration(undefined)).toBe(0)
    expect(parseDuration('')).toBe(0)
  })
  it('returns 0 for an unparseable duration', () => {
    expect(parseDuration('soon')).toBe(0)
  })
})

// ─── loadAlertGroups ───────────────────────────────────────────────────────────

describe('loadAlertGroups', () => {
  const groups: RawAlertGroups = {
    groups: [
      {
        name: 'contract-alerts',
        rules: [
          {
            alert: 'ContractBalanceLow',
            expr: 'contract_balance < 1000',
            for: '5m',
            labels: { severity: 'warning', service: 'contracts' },
          },
          {
            alert: 'ContractFailure',
            expr: 'rate(contract_transactions_failed[5m]) > 0.1',
            for: '5m',
            labels: { severity: 'critical' },
          },
        ],
      },
    ],
  }

  it('converts raw groups into structured rules', () => {
    const rules = loadAlertGroups(groups)
    expect(rules).toHaveLength(2)
    expect(rules[0]).toMatchObject({
      id: 'ContractBalanceLow',
      metric: 'contract_balance',
      operator: '<',
      threshold: 1000,
      severity: 'warning',
      forMs: 300_000,
    })
    expect(rules[1]).toMatchObject({
      id: 'ContractFailure',
      metric: 'contract_transactions_failed',
      operator: '>',
      threshold: 0.1,
      severity: 'critical',
    })
  })

  it('defaults severity to warning when not provided', () => {
    const rules = loadAlertGroups({
      groups: [{ name: 'g', rules: [{ alert: 'X', expr: 'm > 1' }] }],
    })
    expect(rules[0].severity).toBe('warning')
    expect(rules[0].forMs).toBe(0)
  })

  it('handles empty groups gracefully', () => {
    expect(loadAlertGroups({ groups: [] })).toEqual([])
  })
})

// ─── evaluateComparison boundary-driven rules (stateful evaluator) ──────────────

function rule(partial: Partial<AlertRule> & Pick<AlertRule, 'id' | 'metric' | 'operator' | 'threshold'>): AlertRule {
  return { enabled: true, ...partial }
}

describe('AlertEvaluator — threshold behaviour', () => {
  let evaluator: AlertEvaluator

  beforeEach(() => {
    evaluator = new AlertEvaluator([
      rule({ id: 'above', metric: 'error_rate', operator: '>', threshold: 0.05 }),
      rule({ id: 'below', metric: 'balance', operator: '<', threshold: 1000 }),
    ])
  })

  it('does not fire when the metric is below an ">" threshold', () => {
    const [above] = evaluator.evaluate({ error_rate: 0.01 })
    expect(above.firing).toBe(false)
    expect(above.status).toBe('ok')
  })

  it('does not fire at the exact ">" boundary', () => {
    const [above] = evaluator.evaluate({ error_rate: 0.05 })
    expect(above.firing).toBe(false)
    expect(above.status).toBe('ok')
  })

  it('fires when the metric is strictly above the ">" threshold', () => {
    const [above] = evaluator.evaluate({ error_rate: 0.1 })
    expect(above.firing).toBe(true)
    expect(above.status).toBe('firing')
    expect(above.severity).toBe('warning')
  })

  it('does not fire at the exact "<" boundary', () => {
    const [, below] = evaluator.evaluate({ balance: 1000 })
    expect(below.firing).toBe(false)
    expect(below.status).toBe('ok')
  })

  it('fires when the metric is strictly below the "<" threshold', () => {
    const [, below] = evaluator.evaluate({ balance: 999 })
    expect(below.firing).toBe(true)
    expect(below.status).toBe('firing')
  })

  it('reports breaching=true for the sample even while debounce keeps it pending', () => {
    const [above] = evaluator.evaluate({ error_rate: 0.1 })
    expect(above.breaching).toBe(true)
  })
})

// ─── evaluateComparison missing / invalid metric values ────────────────────────

describe('AlertEvaluator — missing & invalid metrics', () => {
  const evaluator = new AlertEvaluator([
    rule({ id: 'balance', metric: 'balance', operator: '<', threshold: 1000 }),
  ])

  it('reports no-data when the metric is absent', () => {
    const [e] = evaluator.evaluate({})
    expect(e.status).toBe('no-data')
    expect(e.firing).toBe(false)
    expect(e.value).toBeNull()
  })

  it('reports no-data when the metric is null', () => {
    const [e] = evaluator.evaluate({ balance: null })
    expect(e.status).toBe('no-data')
  })

  it('reports no-data when the metric is undefined', () => {
    const [e] = evaluator.evaluate({ balance: undefined })
    expect(e.status).toBe('no-data')
  })

  it('reports no-data when the metric value is NaN', () => {
    const [e] = evaluator.evaluate({ balance: Number.NaN })
    expect(e.status).toBe('no-data')
  })

  it('reports no-data when the metric value is a non-numeric string', () => {
    const [e] = evaluator.evaluate({ balance: 'not-a-number' as unknown as number })
    expect(e.status).toBe('no-data')
  })

  it('reports no-data when the metric value is a boolean', () => {
    const [e] = evaluator.evaluate({ balance: true as unknown as number })
    expect(e.status).toBe('no-data')
  })

  it('never flags no-data as firing', () => {
    const evals = evaluator.evaluate({ balance: 'x' as unknown as number })
    expect(evals.every((e) => e.firing === false)).toBe(true)
  })
})

// ─── debounce (`for:`) transitions ─────────────────────────────────────────────

describe('AlertEvaluator — debounce / for: transitions', () => {
  const rules = [
    rule({ id: 'slow', metric: 'latency', operator: '>', threshold: 2, forMs: 5_000 }),
  ]

  it('is pending (not firing) while inside the for window', () => {
    const evaluator = new AlertEvaluator(rules)
    const [pending] = evaluator.evaluate({ latency: 9 }, 1_000)
    expect(pending.status).toBe('pending')
    expect(pending.firing).toBe(false)
    expect(pending.breachingSince).toBe(1_000)
  })

  it('fires only after the for window elapses', () => {
    const evaluator = new AlertEvaluator(rules)
    evaluator.evaluate({ latency: 9 }, 1_000) // start breaching
    const [firing] = evaluator.evaluate({ latency: 9 }, 1_000 + 5_000)
    expect(firing.status).toBe('firing')
    expect(firing.firing).toBe(true)
  })

  it('resets debounce and becomes ok when the breach clears', () => {
    const evaluator = new AlertEvaluator(rules)
    evaluator.evaluate({ latency: 9 }, 1_000)
    const [ok] = evaluator.evaluate({ latency: 1 }, 2_000)
    expect(ok.status).toBe('ok')
    expect(ok.firing).toBe(false)
    expect(ok.breachingSince).toBeNull()
  })

  it('re-arms the debounce after recovering, requiring for: to elapse again', () => {
    const evaluator = new AlertEvaluator(rules)
    evaluator.evaluate({ latency: 9 }, 1_000) // breaching since 1000
    evaluator.evaluate({ latency: 1 }, 2_000) // recovered
    const [pending] = evaluator.evaluate({ latency: 9 }, 2_500) // breach again
    expect(pending.status).toBe('pending')
    expect(pending.breachingSince).toBe(2_500)
  })

  it('preserves debounce state across hydrate()', () => {
    const first = new AlertEvaluator(rules)
    first.evaluate({ latency: 9 }, 1_000)
    const snapshot = first.getState()

    const second = new AlertEvaluator(rules)
    second.hydrate(snapshot)
    const [firing] = second.evaluate({ latency: 9 }, 1_000 + 5_000)
    expect(firing.status).toBe('firing')
  })

  it('fires immediately when forMs is 0 / undefined', () => {
    const evaluator = new AlertEvaluator([
      rule({ id: 'now', metric: 'x', operator: '>', threshold: 1 }),
    ])
    const [e] = evaluator.evaluate({ x: 5 }, 0)
    expect(e.status).toBe('firing')
  })
})

// ─── disabled rules & multiple rules & empty input ────────────────────────────

describe('AlertEvaluator — disabled, multiple, empty', () => {
  it('marks disabled rules and skips evaluation', () => {
    const evaluator = new AlertEvaluator([
      rule({ id: 'off', metric: 'x', operator: '>', threshold: 1, enabled: false }),
    ])
    const [e] = evaluator.evaluate({ x: 99 })
    expect(e.status).toBe('disabled')
    expect(e.firing).toBe(false)
  })

  it('evaluates multiple independent rules in one pass', () => {
    const evaluator = new AlertEvaluator([
      rule({ id: 'a', metric: 'balance', operator: '<', threshold: 1000 }),
      rule({ id: 'b', metric: 'missing', operator: '>', threshold: 1 }),
      rule({ id: 'c', metric: 'cpu', operator: '>', threshold: 90, severity: 'critical' }),
    ])
    const evals = evaluator.evaluate({ balance: 10, cpu: 99 })
    expect(evals).toHaveLength(3)
    const byId = Object.fromEntries(evals.map((e) => [e.ruleId, e]))
    expect(byId.a.firing).toBe(true)
    expect(byId.b.status).toBe('no-data')
    expect(byId.c.firing).toBe(true)
    expect(byId.c.severity).toBe('critical')
  })

  it('returns an empty array for an empty rule set', () => {
    const evaluator = new AlertEvaluator([])
    expect(evaluator.evaluate({ anything: 1 })).toEqual([])
  })

  it('getFiringEvaluations returns only firing rules', () => {
    const evaluator = new AlertEvaluator([
      rule({ id: 'fire', metric: 'a', operator: '>', threshold: 1 }),
      rule({ id: 'ok', metric: 'b', operator: '>', threshold: 100 }),
    ])
    const firing = evaluator.getFiringEvaluations({ a: 5, b: 2 })
    expect(firing.map((e) => e.ruleId)).toEqual(['fire'])
  })

  it('reset() clears debounce state', () => {
    const evaluator = new AlertEvaluator([
      rule({ id: 'slow', metric: 'latency', operator: '>', threshold: 2, forMs: 5_000 }),
    ])
    evaluator.evaluate({ latency: 9 }, 1_000)
    evaluator.reset()
    const [e] = evaluator.evaluate({ latency: 9 }, 1_001)
    expect(e.breachingSince).toBe(1_001)
  })
})

// ─── pure evaluateRules wrapper (state threading) ──────────────────────────────

describe('evaluateRules (stateless wrapper)', () => {
  const rules: AlertRule[] = [
    rule({ id: 'balance', metric: 'balance', operator: '<', threshold: 1000, forMs: 1_000 }),
  ]

  it('threads debounce state across calls', () => {
    const sample: MetricSample = { balance: 10 }
    const r1 = evaluateRules(rules, sample, {}, 0)
    expect(r1.evaluations[0].status).toBe('pending')

    const r2 = evaluateRules(rules, sample, r1.state, 1_200)
    expect(r2.evaluations[0].status).toBe('firing')
  })

  it('returns an evaluations array and a state object', () => {
    const { evaluations, state } = evaluateRules(rules, { balance: 5000 }, {}, 0)
    expect(evaluations[0].status).toBe('ok')
    expect(state.balance).toBeDefined()
  })
})

// ─── integration with shared fixtures (issue #1278 cross-link) ──────────────────

describe('AlertEvaluator — seeded account fixtures as metric source', () => {
  it('can build metric samples from seeded test accounts without secrets', () => {
    const accounts = makeTestAccountSet()
    // The shared fixtures expose deterministic public keys (no real secrets).
    // Here we simply derive a metric sample, proving the shared test-utils
    // package integrates cleanly with the monitoring evaluator.
    const sample: MetricSample = {
      funded_accounts: Object.values(accounts).filter(
        (a) => Number(a.balance) > 0,
      ).length,
    }
    const evaluator = new AlertEvaluator([
      rule({ id: 'too_few_funded', metric: 'funded_accounts', operator: '<', threshold: 3 }),
    ])
    // 3 of the 5 accounts are funded (>0 balance), so the rule should NOT fire.
    const [e] = evaluator.evaluate(sample)
    expect(e.firing).toBe(false)
    expect(e.status).toBe('ok')
  })
})
