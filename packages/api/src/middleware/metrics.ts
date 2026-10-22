import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Default metrics (Node.js performance)
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

export const requestSize = new client.Summary({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

export const responseSize = new client.Summary({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  // Increment active requests
  activeRequests.inc();

  // Track request size
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  requestSize.observe({ method: req.method, route: req.route?.path || req.path }, contentLength);

  const start = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function(body: unknown): Response {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const method = req.method;

    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });

    // Track errors
    if (res.statusCode >= 400) {
      httpRequestErrors.inc({ method, route, status_code: statusCode });
    }

    // Track response size
    const responseSizeBytes = Buffer.byteLength(JSON.stringify(body) || '', 'utf8');
    responseSize.observe({ method, route, status_code: statusCode }, responseSizeBytes);

    // Decrement active requests
    activeRequests.dec();

    return originalSend.call(this, body);
  };

  next();
};

// Metrics endpoint
export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};

// Custom metrics for business logic
export const businessMetrics = {
  // Queue metrics
  queueSize: new client.Gauge({
    name: 'queue_size',
    help: 'Current queue size',
    labelNames: ['queue_name'],
    registers: [register],
  }),

  queueProcessingDuration: new client.Histogram({
    name: 'queue_processing_duration_seconds',
    help: 'Duration of queue processing in seconds',
    labelNames: ['queue_name', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  }),

  // Database metrics
  dbQueryDuration: new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),

  dbConnections: new client.Gauge({
    name: 'db_connections',
    help: 'Number of database connections',
    registers: [register],
  }),

  // Blockchain metrics
  blockHeight: new client.Gauge({
    name: 'blockchain_block_height',
    help: 'Current blockchain block height',
    labelNames: ['network'],
    registers: [register],
  }),

  contractCalls: new client.Counter({
    name: 'contract_calls_total',
    help: 'Total number of contract calls',
    labelNames: ['contract', 'method', 'status'],
    registers: [register],
  }),

  // Worker metrics
  workerActive: new client.Gauge({
    name: 'worker_active',
    help: 'Number of active workers',
    labelNames: ['worker_type'],
    registers: [register],
  }),

  workerJobDuration: new client.Histogram({
    name: 'worker_job_duration_seconds',
    help: 'Duration of worker jobs in seconds',
    labelNames: ['job_type', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  }),
};

// Export register for custom metrics
export const metricsRegister = register;
