# Graceful Shutdown Implementation (#1642)

## Overview

The BlueCollar API implements graceful shutdown to ensure clean termination when receiving `SIGTERM` or `SIGINT` signals. This prevents data loss, incomplete transactions, and resource leaks.

## Shutdown Flow

When the application receives `SIGTERM` or `SIGINT`, the following sequence executes:

```
SIGTERM/SIGINT
     ↓
[1] Stop accepting new connections (server.close())
     ↓
[2] Drain in-flight requests (wait for completion or timeout)
     ↓
[3] Stop background jobs (reminder job, horizon poller, etc.)
     ↓
[4] Close database connections (Prisma disconnect)
     ↓
[5] Close Redis connections (QUIT + disconnect)
     ↓
[6] Exit process (code 0 on success, code 1 on error)
```

## Configuration

### Environment Variables

- **`SHUTDOWN_TIMEOUT_MS`** (default: 30000ms)
  - Total time allowed for the entire shutdown sequence
  - If exceeded, process exits with error code 1

- **`DRAIN_TIMEOUT_MS`** (default: 5000ms)
  - Time allowed for in-flight requests to complete
  - After this timeout, shutdown continues regardless of pending requests
  - WebSocket connections are closed by `server.close()`

### Example Configuration

```bash
# Allow 10 seconds for in-flight requests before forcing close
DRAIN_TIMEOUT_MS=10000

# Allow 60 seconds for entire shutdown sequence
SHUTDOWN_TIMEOUT_MS=60000
```

## Implementation Details

### Main Handler

Located in `src/utils/shutdown.ts`:

```typescript
import { createGracefulShutdownHandler } from '@/utils/shutdown.js'

// In index.ts
const shutdownHandler = createGracefulShutdownHandler(server)
process.on('SIGTERM', shutdownHandler)
process.on('SIGINT', shutdownHandler)
```

### Phase 1: Stop Accepting Connections

```typescript
httpServer.close(() => {
  logger.info('Server stopped accepting connections')
})
```

- Stops listening on the port
- Existing keep-alive connections may stay open briefly
- All new connection attempts are rejected

### Phase 2: Drain In-Flight Requests

```typescript
// Wait for all active requests to complete
const connections = httpServer.connections ?? 0
// Poll connection count until 0 or timeout
```

- Monitors `server.connections` (native Node.js property)
- Polls every 100ms
- Waits up to `DRAIN_TIMEOUT_MS` for requests to finish
- Log progress every second

### Phase 3: Stop Background Jobs

```typescript
stopAllJobs() // Calls stop functions for all job runners
```

Jobs stopped:
- Reminder job (verification reminders)
- Horizon poller (Stellar network polling)

### Phase 4: Close Database Connections

```typescript
await disconnectDb() // Both primary and read-replica
```

- Closes both write and read-replica Prisma client pools
- Ensures pending queries complete or timeout within Prisma's configured timeouts

### Phase 5: Close Redis Connections

```typescript
await disconnectRedis()
```

- Sends QUIT command for graceful close
- Falls back to disconnect if QUIT fails
- Handles already-closed connections gracefully

### Phase 6: Exit Process

```typescript
process.exit(0) // Success
// or
process.exit(1) // Error occurred
```

## Error Handling

Each phase includes error handling:

- **Connection errors**: Logged and continue shutdown
- **Request drain timeout**: Logged as warning, shutdown continues
- **Database close errors**: Logged, but continue shutdown
- **Redis close errors**: Logged as debug, continue shutdown
- **Fatal errors in catch block**: Exit with code 1

## Logging

All shutdown events are logged with appropriate levels:

- `info`: Normal shutdown flow (start, phases complete, completion)
- `warn`: Timeouts exceeded or concerning conditions
- `debug`: Detailed progress information

Example logs:

```
Graceful shutdown initiated
Stopping acceptance of new connections
Server stopped accepting connections
Draining in-flight requests (connections: 5)
Waiting for requests to drain (remaining: 3, elapsedMs: 1000)
All requests drained (elapsedMs: 2500)
Stopping all background jobs
All background jobs stopped
Closing database connections
Closing Redis connection
Graceful shutdown completed successfully
```

## Testing

Integration tests verify:

- Handler is created successfully
- Concurrent shutdown attempts are prevented
- Server stops accepting connections
- Timeouts are respected
- In-flight requests can drain
- All shutdown phases execute in order
- Error conditions are handled

Run tests:

```bash
npm run test -- shutdown.integration.test.ts --run
```

## Kubernetes/Container Usage

For containerized deployments (Docker, Kubernetes):

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: api
    image: bluecollar:api
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 10"]  # Grace period
    terminationGracePeriodSeconds: 40  # Total grace period (must be > DRAIN_TIMEOUT_MS)
```

Set environment variables:

```yaml
env:
- name: DRAIN_TIMEOUT_MS
  value: "10000"  # 10 seconds for requests to drain
- name: SHUTDOWN_TIMEOUT_MS
  value: "30000"  # 30 seconds total
```

### Docker Compose

```yaml
services:
  api:
    image: bluecollar:api
    environment:
      DRAIN_TIMEOUT_MS: 10000
      SHUTDOWN_TIMEOUT_MS: 30000
    stop_grace_period: 40s  # Must be > SHUTDOWN_TIMEOUT_MS
```

## Production Recommendations

1. **Set appropriate timeouts** based on your workload:
   - Light workloads (few requests): 5-10 second drain, 15-20 second total
   - Heavy workloads (many requests): 15-30 second drain, 45-60 second total

2. **Monitor shutdown logs** for unexpected timeouts:
   - Timeouts indicate requests taking longer than expected
   - May indicate database locks or slow queries

3. **Test shutdown behavior**:
   - Use load testing during shutdown
   - Verify no requests are dropped
   - Check logs for errors

4. **Container orchestration**:
   - Set `terminationGracePeriodSeconds` > `SHUTDOWN_TIMEOUT_MS`
   - Include `preStop` hook for additional grace period if needed
   - Use health checks to detect issues early

## Troubleshooting

### Requests are being dropped

**Symptom**: Client receives connection reset or timeout errors

**Solution**:
- Increase `DRAIN_TIMEOUT_MS`
- Check for slow queries using database logs
- Verify no deadlocks in transactions

### Shutdown takes too long

**Symptom**: Process takes >30 seconds to shutdown

**Solution**:
- Increase `SHUTDOWN_TIMEOUT_MS` if needed
- Check background job stop methods
- Verify database connections aren't hanging

### Redis connection errors during shutdown

**Symptom**: Error logs mention Redis during shutdown

**Solution**:
- Normal if Redis was already unavailable
- Check Redis health logs
- May indicate network issues

## Related Issues

- #1215: Error handling standardization
- #1235: Background jobs module
- #518: Admin export functionality
- #1641: Streaming CSV exports (uses graceful shutdown)

## References

- Node.js HTTP Server: https://nodejs.org/api/http.html#http_server_close
- Kubernetes Termination: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/
- Prisma Disconnection: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#disconnect
- Redis Connection Closing: https://github.com/luin/ioredis#connection
