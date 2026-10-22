/**
 * @bluecollar/monitoring — Alert rule evaluation engine
 *
 * Issue #1277 — Add test coverage for packages/monitoring alert rule logic.
 *
 * The monitoring service ships a set of Prometheus-style alert rules under
 * `packages/monitoring/alerts/*.yml` (e.g. `contract_balance < 1000`,
 * `rate(queue_messages_dead_lettered[5m]) > 0`).  This module provides the
 * pure evaluation logic that turns those declarative rules (plus a live sample
 * of metric values) into firing / pending / ok / no-data decisions.
 *
 * It deliberately has NO I/O or SDK dependencies so it can be unit-tested in a
 * plain Node environment.
 *
 * ─── Public surface ───────────────────────────────────────────────────────────
 *   evaluateComparison(value, operator, threshold)   — primitive comparator
 *   parseAlertExpression(expr)                        — expr → { metric, operator, threshold }
 *   loadAlertGroups(groups)                           — YAML groups → AlertRule[]
 *   evaluateRules(rules, metrics, state?)             — pure evaluator (stateless wrapper)
 *   class AlertEvaluator                              — stateful evaluator (debounce/`for`)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export type AlertSeverity = 'info' | 'warning' | 'critical'

/** A single metric sample: metric name → numeric value (or missing/invalid). */
export type MetricSample = Record<string, number | string | boolean | null | undefined>

/** A structured, evaluator-ready alert rule. */
export interface AlertRule {
  /** Stable identifier (usually the alert name from the YAML). */
  id: string
  /** Human readable name. */
  name?: string
  /** Metric name resolved from the sample map. */
  metric: string
  /** Comparison operator applied to (value <operator> threshold). */
  operator: ComparisonOperator
  /** Threshold the metric is compared against. */
  threshold: number
  /** Severity label carried through to the evaluation. */
  severity?: AlertSeverity
  /**
   * "for" duration in milliseconds (matches Prometheus `for:`).
   * The rule must breach continuously for this long before it is reported as
   * firing — this is the debounce that prevents flapping. Defaults to 0.
   */
  forMs?: number
  /** When false the rule is ignored. Defaults to true. */
  enabled?: boolean
}

export type AlertStatus = 'firing' | 'pending' | 'ok' | 'no-data' | 'disabled'

export interface AlertEvaluation {
  ruleId: string
  metric: string
  status: AlertStatus
  severity: AlertSeverity
  firing: boolean
  /** Whether the most recent sample breached the threshold (pre-debounce). */
  breaching: boolean
  value: number | null
  threshold: number
  operator: ComparisonOperator
  /** Epoch ms the alert first began breaching (for debounce tracking). */
  breachingSince: number | null
  message: string
}

/** Per-rule debounce state owned by the evaluator. */
export interface RuleState {
  breachingSince: number | null
}

export type EvaluatorState = Record<string, RuleState>

// ─── Raw YAML shapes (only the parts we consume) ──────────────────────────────

export interface RawAlertRule {
  alert: string
  expr: string
  for?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface RawAlertGroup {
  name: string
  rules: RawAlertRule[]
}

export interface RawAlertGroups {
  groups: RawAlertGroup[]
}

// ─── Primitive comparator ──────────────────────────────────────────────────────

/**
 * Evaluate `value <operator> threshold`.
 *
 * Boundaries are strict: `>` returns false when value === threshold, and `<`
 * returns false when value === threshold (use `>=` / `<=` for inclusive tests).
 */
export function evaluateComparison(
  value: number,
  operator: ComparisonOperator,
  threshold: number,
): boolean {
  switch (operator) {
    case '>':
      return value > threshold
    case '<':
      return value < threshold
    case '>=':
      return value >= threshold
    case '<=':
      return value <= threshold
    case '==':
      return value === threshold
    case '!=':
      return value !== threshold
    default:
      return false
  }
}

// ─── Expression parser ─────────────────────────────────────────────────────────

const COMPARISON_RE = /(.*?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/

/** Tokens that look like functions/aggregations and are not metric names. */
const RESERVED_TOKENS = new Set([
  'rate',
  'sum',
  'histogram_quantuple',
  'histogram_quantile',
  'by',
  'le',
  'count',
  'avg',
  'max',
  'min',
  'increase',
  'irate',
  'abs',
  'clamp_max',
  'clamp_min',
])

/**
 * Parse a Prometheus-style alert expression into a structured
 * `{ metric, operator, threshold }` triple.
 *
 * Supported forms (all present in packages/monitoring/alerts/*.yml):
 *   contract_balance < 1000
 *   queue_messages_unprocessed > 1000
 *   rate(contract_transactions_failed[5m]) > 0.1
 *   sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m])) > 0.05
 *
 * @throws Error when the expression has no comparison operator or no numeric threshold.
 */
export function parseAlertExpression(expr: string): {
  metric: string
  operator: ComparisonOperator
  threshold: number
} {
  const match = COMPARISON_RE.exec(expr)
  if (!match) {
    throw new Error(`Unable to parse alert expression (no comparison found): ${expr}`)
  }

  const lhs = match[1]
  const operator = match[2] as ComparisonOperator
  const rhs = match[3].trim()

  const threshold = Number(rhs)
  if (!Number.isFinite(threshold)) {
    throw new Error(`Unable to parse alert threshold from expression: ${expr}`)
  }

  // Extract candidate metric identifiers from the LHS by stripping function
  // wrappers, aggregation clauses, label matchers and time windows.
  const cleaned = lhs
    .replace(/\b\w+\s*\(/g, ' ') // function calls:  rate(  sum(
    .replace(/\)/g, ' ') // closing parens
    .replace(/\[[^\]]*\]/g, ' ') // [5m] windows
    .replace(/\{[^}]*\}/g, ' ') // {status=~"5.."} label matchers
    .replace(/\bby\s*\([^)]*\)/g, ' ') //  by (le)
    .replace(/[^\w\s]/g, ' ') // remaining punctuation

  const candidates = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && /^[a-zA-Z_]/.test(t) && !RESERVED_TOKENS.has(t))

  if (candidates.length === 0) {
    throw new Error(`Unable to extract a metric name from expression: ${expr}`)
  }

  // De-duplicate while preserving order; use the first distinct metric.
  const seen = new Set<string>()
  let metric = candidates[0]
  for (const c of candidates) {
    if (!seen.has(c)) {
      seen.add(c)
      metric = c
      break
    }
  }

  return { metric, operator, threshold }
}

// ─── YAML group loader ─────────────────────────────────────────────────────────

const DURATION_RE = /^(\d+)\s*(ms|s|m|h)$/

/** Parse a Prometheus duration string (`5m`, `30s`, `2h`) into milliseconds. */
export function parseDuration(duration: string | undefined): number {
  if (!duration) return 0
  const match = DURATION_RE.exec(duration.trim())
  if (!match) return 0
  const amount = Number(match[1])
  const unit = match[2]
  switch (unit) {
    case 'ms':
      return amount
    case 's':
      return amount * 1_000
    case 'm':
      return amount * 60_000
    case 'h':
      return amount * 3_600_000
    default:
      return 0
  }
}

/**
 * Convert the raw `groups` object loaded from an alert YAML file into an array
 * of structured {@link AlertRule}s ready for evaluation.
 */
export function loadAlertGroups(groups: RawAlertGroups): AlertRule[] {
  const rules: AlertRule[] = []
  for (const group of groups.groups ?? []) {
    for (const raw of group.rules ?? []) {
      const parsed = parseAlertExpression(raw.expr)
      rules.push({
        id: raw.alert,
        name: raw.alert,
        metric: parsed.metric,
        operator: parsed.operator,
        threshold: parsed.threshold,
        severity: (raw.labels?.severity as AlertSeverity) ?? 'warning',
        forMs: parseDuration(raw.for),
      })
    }
  }
  return rules
}

// ─── Pure evaluator ────────────────────────────────────────────────────────────

function resolveValue(metric: string, sample: MetricSample): number | null {
  const raw = sample[metric]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return null
}

/**
 * Evaluate a list of rules against a metric sample.
 *
 * This is a stateless wrapper around {@link AlertEvaluator} that keeps the
 * debounce state internally and returns it alongside the evaluations so it can
 * be threaded across invocations.
 */
export function evaluateRules(
  rules: AlertRule[],
  sample: MetricSample,
  previousState: EvaluatorState = {},
  now: number = Date.now(),
): { evaluations: AlertEvaluation[]; state: EvaluatorState } {
  const evaluator = new AlertEvaluator(rules)
  evaluator.hydrate(previousState)
  const evaluations = evaluator.evaluate(sample, now)
  return { evaluations, state: evaluator.getState() }
}

// ─── Stateful evaluator ────────────────────────────────────────────────────────

/**
 * Stateful alert evaluator.
 *
 * Maintains per-rule debounce state for the Prometheus `for:` semantics: a rule
 * is only reported as `firing` once its metric has breached the threshold
 * continuously for at least `forMs`.  While breaching but inside the debounce
 * window the rule is `pending`.  Missing/invalid metric values yield `no-data`
 * and never count as firing.
 */
export class AlertEvaluator {
  private rules: AlertRule[]
  private state: EvaluatorState

  constructor(rules: AlertRule[] = []) {
    this.rules = rules
    this.state = {}
    for (const rule of rules) {
      this.state[rule.id] = { breachingSince: null }
    }
  }

  /** Replace the active rule set (existing state is preserved when ids overlap). */
  setRules(rules: AlertRule[]): void {
    this.rules = rules
    for (const rule of rules) {
      if (!this.state[rule.id]) {
        this.state[rule.id] = { breachingSince: null }
      }
    }
  }

  /** Replace the entire internal state (used to restore persisted state). */
  hydrate(state: EvaluatorState): void {
    this.state = {}
    for (const rule of this.rules) {
      const existing = state[rule.id] ?? {}
      this.state[rule.id] = {
        ...existing,
        breachingSince: existing.breachingSince ?? null,
      }
    }
  }

  getState(): EvaluatorState {
    return this.state
  }

  /** Reset all debounce state without changing the rules. */
  reset(): void {
    for (const rule of this.rules) {
      this.state[rule.id] = { breachingSince: null }
    }
  }

  /**
   * Evaluate every rule against `sample` at time `now` (epoch ms).
   * Mutates internal debounce state and returns one evaluation per rule.
   */
  evaluate(sample: MetricSample, now: number = Date.now()): AlertEvaluation[] {
    const evaluations: AlertEvaluation[] = []

    for (const rule of this.rules) {
      const enabled = rule.enabled !== false
      const value = enabled ? resolveValue(rule.metric, sample) : null
      const severity: AlertSeverity = rule.severity ?? 'warning'
      const st = this.state[rule.id] ?? (this.state[rule.id] = { breachingSince: null })

      // Disabled rules.
      if (!enabled) {
        evaluations.push({
          ruleId: rule.id,
          metric: rule.metric,
          status: 'disabled',
          severity,
          firing: false,
          breaching: false,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          breachingSince: null,
          message: `Rule "${rule.id}" is disabled`,
        })
        continue
      }

      // Missing / invalid metric value.
      if (value === null) {
        st.breachingSince = null
        evaluations.push({
          ruleId: rule.id,
          metric: rule.metric,
          status: 'no-data',
          severity,
          firing: false,
          breaching: false,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          breachingSince: null,
          message: `No data for metric "${rule.metric}"`,
        })
        continue
      }

      const breaching = evaluateComparison(value, rule.operator, rule.threshold)
      const forMs = rule.forMs ?? 0

      if (!breaching) {
        st.breachingSince = null
        evaluations.push({
          ruleId: rule.id,
          metric: rule.metric,
          status: 'ok',
          severity,
          firing: false,
          breaching: false,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          breachingSince: null,
          message: `Metric "${rule.metric}" (${value}) is within threshold ${rule.operator} ${rule.threshold}`,
        })
        continue
      }

      // Breaching — handle debounce.
      if (st.breachingSince === null) {
        st.breachingSince = now
      }
      const elapsed = now - st.breachingSince

      if (elapsed >= forMs) {
        evaluations.push({
          ruleId: rule.id,
          metric: rule.metric,
          status: 'firing',
          severity,
          firing: true,
          breaching: true,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          breachingSince: st.breachingSince,
          message: `ALERT ${severity.toUpperCase()}: "${rule.metric}"=${value} breaches ${rule.operator} ${rule.threshold}`,
        })
      } else {
        evaluations.push({
          ruleId: rule.id,
          metric: rule.metric,
          status: 'pending',
          severity,
          firing: false,
          breaching: true,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          breachingSince: st.breachingSince,
          message: `Pending: "${rule.metric}"=${value} breaching ${rule.operator} ${rule.threshold} for ${elapsed}ms of ${forMs}ms`,
        })
      }
    }

    return evaluations
  }

  /** Convenience: only the currently firing evaluations. */
  getFiringEvaluations(sample: MetricSample, now: number = Date.now()): AlertEvaluation[] {
    return this.evaluate(sample, now).filter((e) => e.firing)
  }
}

export default AlertEvaluator
