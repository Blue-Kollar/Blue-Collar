import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, propagation, SpanStatusCode } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Set propagator
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {
    'Content-Type': 'application/json',
  },
});

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'blue-collar-api',
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const sdk = new NodeSDK({
  resource,
  traceExporter: exporter,
  spanProcessor: new BatchSpanProcessor(exporter),
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingPaths: ['/health', '/metrics', '/favicon.ico'],
      requestHook: (span, request) => {
        span.setAttribute('http.request.method', request.method);
        span.setAttribute('http.url', request.url);
      },
      responseHook: (span, response) => {
        span.setAttribute('http.status_code', response.statusCode);
      },
    }),
    new ExpressInstrumentation({
      ignoreLayers: ['middleware', 'static'],
      requestHook: (span, request) => {
        const route = request.route?.path || request.path;
        span.setAttribute('express.route', route);
        span.setAttribute('http.route', route);
        
        // Add user ID if available
        if ((request as any).user?.id) {
          span.setAttribute('user.id', (request as any).user.id);
        }
      },
    }),
    new PgInstrumentation({
      requestHook: (span, queryInfo) => {
        const sanitizedQuery = queryInfo.query?.replace(/\s+/g, ' ').trim();
        span.setAttribute('db.query.text', sanitizedQuery);
        span.setAttribute('db.system', 'postgresql');
      },
      responseHook: (span, result) => {
        span.setAttribute('db.rows_affected', result.rowCount || 0);
      },
    }),
  ],
});

export const initializeTracing = () => {
  if (process.env.OTEL_DISABLED === 'true') {
    console.log('OpenTelemetry tracing is disabled');
    return;
  }

  try {
    sdk.start();
    console.log('OpenTelemetry tracing initialized');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
};

export const shutdownTracing = async () => {
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry tracing shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry:', error);
  }
};

// Helper to start a span
export const startSpan = (name: string, attributes?: Record<string, any>) => {
  const tracer = trace.getTracer('blue-collar-api');
  const span = tracer.startSpan(name, {
    attributes: {
      ...attributes,
      'service.name': process.env.OTEL_SERVICE_NAME || 'blue-collar-api',
    },
  });
  return { span, ctx: trace.setSpan(context.active(), span) };
};

/**
 * Minimal span surface used by the error helper. Declared locally because the
 * `@opentelemetry/api` `Span` type is only available when the (optional) OTel
 * packages are installed — this avoids `any` without a hard dependency.
 */
interface EndableSpan {
  setStatus(status: { code: number; message?: string }): void
  recordException(error: Error): void
  end(): void
}

// Helper to end a span with error handling
export const endSpanWithError = (span: EndableSpan, error: Error) => {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  span.recordException(error);
  span.end();
};

export { sdk, trace, context, propagation };
