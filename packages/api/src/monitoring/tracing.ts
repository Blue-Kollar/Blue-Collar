/**
 * OpenTelemetry tracing — OTLP exporter.
 *
 * Exports traces to an OTLP-compatible backend (Jaeger, Grafana Tempo, etc.)
 * via the endpoint configured in OTEL_EXPORTER_OTLP_ENDPOINT.
 *
 * Auto-instruments Express, Prisma (via @prisma/instrumentation), and HTTP.
 * Must be imported before any other module in the entry point.
 */
import { context,trace } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318/v1/traces',
})

export const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'bluecollar-api',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
  }),
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
})

export function initializeTracing(): void {
  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => {})
      .catch(() => {})
      .finally(() => process.exit(0))
  })
}

/** Returns the current trace ID, or undefined when no active span exists. */
export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan()
  if (!span) return undefined
  const traceId = span.spanContext().traceId
  return traceId === '00000000000000000000000000000000' ? undefined : traceId
}
