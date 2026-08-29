# API Test Coverage Guide

## Overview

This guide covers the comprehensive testing strategy to achieve and maintain 85%+ test coverage for the Blue-Collar monorepo.

> **Issue #1055** — Minimum coverage thresholds are now **enforced** in each package's
> `vitest.config.ts`. Any PR that causes coverage to drop below the thresholds will fail
> CI. See the [Enforced Thresholds](#enforced-thresholds) section for details.

---

## Enforced Thresholds

Thresholds are configured in each package's `vitest.config.ts` and fail the test run
(`exit 1`) when not met:

| Package | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|------------|
| `packages/api` | 85% | 85% | 80% | 85% |
| `packages/app` | 85% | 85% | 80% | 85% |
| `packages/sdk` | 85% | 85% | 80% | 85% |

**Why 80% for branches?**
Branch coverage measures all conditional paths (if/else, ternaries, switch cases, optional
chaining). Several middleware branches in `packages/api` are conditional on runtime
environment flags not exercisable in unit tests without a live DB (e.g., Redis availability,
SMTP connectivity). These paths are tested by the e2e suite only.

**Why 85% instead of 90%?**
The 85% floor is the initial enforced baseline, established from the current coverage
report. The goal is to prevent *regressions*, not to retroactively demand coverage for
existing untested legacy paths. The threshold can be raised incrementally as more tests
are added.

**Running coverage locally:**
```bash
# Per-package
pnpm --filter @bluecollar/api test:coverage
pnpm --filter @bluecollar/app test:coverage
pnpm --filter @bluecollar/sdk test:coverage
```

---

## Current Coverage Status

### Target Coverage
- **Overall**: 85%+
- **Statements**: 85%+
- **Branches**: 80%+
- **Functions**: 85%+
- **Lines**: 85%+

### Coverage by Module
| Module | Statements | Branches | Functions | Lines |
|--------|-----------|----------|-----------|-------|
| Controllers | 95% | 90% | 95% | 95% |
| Services | 92% | 88% | 93% | 92% |
| Middleware | 90% | 85% | 90% | 90% |
| Utils | 88% | 82% | 88% | 88% |
| Routes | 85% | 80% | 85% | 85% |

## Test Structure

### Test Types

#### 1. Unit Tests
Test individual functions and methods in isolation.

```typescript
// Example: Testing a service function
describe('WorkerService', () => {
  describe('createWorker', () => {
    it('should create a worker with valid data', async () => {
      const workerData = {
        name: 'John Doe',
        category: 'plumber',
        wallet_address: 'GXXX...',
      };
      
      const worker = await workerService.createWorker(workerData);
      
      expect(worker).toBeDefined();
      expect(worker.name).toBe('John Doe');
    });

    it('should throw error for invalid wallet address', async () => {
      const workerData = {
        name: 'John Doe',
        category: 'plumber',
        wallet_address: 'invalid',
      };
      
      await expect(workerService.createWorker(workerData))
        .rejects.toThrow('Invalid wallet address');
    });
  });
});
```

#### 2. Integration Tests
Test multiple components working together.

```typescript
// Example: Testing API endpoint with database
describe('POST /api/workers', () => {
  it('should create worker and return 201', async () => {
    const response = await request(app)
      .post('/api/workers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'John Doe',
        category: 'plumber',
        wallet_address: 'GXXX...',
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('John Doe');
    
    // Verify database state
    const worker = await prisma.worker.findUnique({
      where: { id: response.body.data.id },
    });
    expect(worker).toBeDefined();
  });
});
```

#### 3. Edge Case Tests
Test boundary conditions and error scenarios.

```typescript
describe('Edge Cases', () => {
  it('should handle empty string inputs', async () => {
    await expect(workerService.createWorker({ name: '' }))
      .rejects.toThrow('Name is required');
  });

  it('should handle very long inputs', async () => {
    const longName = 'a'.repeat(1000);
    await expect(workerService.createWorker({ name: longName }))
      .rejects.toThrow('Name too long');
  });

  it('should handle special characters', async () => {
    const worker = await workerService.createWorker({
      name: "O'Brien & Sons",
      category: 'plumber',
    });
    expect(worker.name).toBe("O'Brien & Sons");
  });

  it('should handle concurrent requests', async () => {
    const promises = Array(10).fill(null).map((_, i) =>
      workerService.createWorker({ name: `Worker ${i}` })
    );
    const workers = await Promise.all(promises);
    expect(workers).toHaveLength(10);
  });
});
```

#### 4. Authentication & Authorization Tests
Test security and access control.

```typescript
describe('Authentication', () => {
  it('should reject requests without token', async () => {
    const response = await request(app)
      .get('/api/workers/me');
    
    expect(response.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const response = await request(app)
      .get('/api/workers/me')
      .set('Authorization', 'Bearer invalid-token');
    
    expect(response.status).toBe(401);
  });

  it('should reject requests with expired token', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    
    expect(response.status).toBe(401);
  });
});

describe('Authorization', () => {
  it('should allow admin to access admin routes', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(200);
  });

  it('should deny regular user access to admin routes', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(response.status).toBe(403);
  });

  it('should allow user to update own profile', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Updated Name' });
    
    expect(response.status).toBe(200);
  });

  it('should deny user from updating other profiles', async () => {
    const response = await request(app)
      .put('/api/users/other-user-id')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Updated Name' });
    
    expect(response.status).toBe(403);
  });
});
```

#### 5. Error Handling Tests
Test error scenarios and recovery.

```typescript
describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    // Mock database error
    vi.spyOn(prisma.worker, 'create').mockRejectedValue(
      new Error('Database connection failed')
    );
    
    await expect(workerService.createWorker(validData))
      .rejects.toThrow('Database connection failed');
  });

  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/workers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ invalid: 'data' });
    
    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
  });

  it('should handle rate limit errors', async () => {
    // Make multiple requests to trigger rate limit
    const requests = Array(101).fill(null).map(() =>
      request(app).get('/api/workers')
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should handle file upload errors', async () => {
    const response = await request(app)
      .post('/api/workers/avatar')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from('invalid'), 'test.exe');
    
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid file type/i);
  });
});
```

## Test Coverage Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/migrations/**',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

### Test Setup File
```typescript
// src/__tests__/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear database before each test
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.job.deleteMany();
});

afterEach(async () => {
  // Additional cleanup if needed
});
```

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"

# Run tests with verbose output
npm test -- --reporter=verbose
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Check coverage thresholds
        run: |
          if [ $(jq '.total.statements.pct' coverage/coverage-summary.json | cut -d. -f1) -lt 90 ]; then
            echo "Coverage below 90%"
            exit 1
          fi
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Coverage Reports

### Generating Reports
```bash
# Generate HTML report
npm run test:coverage

# Open HTML report
open coverage/index.html

# Generate JSON report
npm run test:coverage -- --reporter=json

# Generate LCOV report for CI
npm run test:coverage -- --reporter=lcov
```

### Reading Coverage Reports
- **Green**: 90%+ coverage (good)
- **Yellow**: 70-89% coverage (needs improvement)
- **Red**: <70% coverage (critical)

## Best Practices

### 1. Test Naming
```typescript
// Good: Descriptive test names
it('should return 404 when worker not found', async () => {});

// Bad: Vague test names
it('test worker', async () => {});
```

### 2. Test Organization
```typescript
// Group related tests
describe('WorkerController', () => {
  describe('GET /workers', () => {
    it('should return all workers', async () => {});
    it('should filter by category', async () => {});
    it('should paginate results', async () => {});
  });

  describe('POST /workers', () => {
    it('should create worker', async () => {});
    it('should validate input', async () => {});
  });
});
```

### 3. Test Independence
```typescript
// Good: Each test is independent
it('should create worker', async () => {
  const worker = await createWorker();
  expect(worker).toBeDefined();
});

it('should update worker', async () => {
  const worker = await createWorker(); // Create fresh data
  const updated = await updateWorker(worker.id);
  expect(updated).toBeDefined();
});

// Bad: Tests depend on each other
let workerId;
it('should create worker', async () => {
  const worker = await createWorker();
  workerId = worker.id; // Shared state
});

it('should update worker', async () => {
  await updateWorker(workerId); // Depends on previous test
});
```

### 4. Mock External Dependencies
```typescript
// Mock external API calls
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: mockData }),
  },
}));

// Mock email service
vi.mock('../services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// Mock Stellar SDK
vi.mock('stellar-sdk', () => ({
  Server: vi.fn().mockImplementation(() => ({
    loadAccount: vi.fn().mockResolvedValue(mockAccount),
  })),
}));
```

### 5. Test Data Factories
```typescript
// Create reusable test data factories
export function createTestUser(overrides = {}) {
  return {
    email: faker.internet.email(),
    password: 'Test123!',
    name: faker.person.fullName(),
    role: 'USER',
    ...overrides,
  };
}

export function createTestWorker(overrides = {}) {
  return {
    name: faker.person.fullName(),
    category: 'plumber',
    wallet_address: `G${faker.string.alphanumeric(55)}`,
    ...overrides,
  };
}

// Usage
it('should create worker', async () => {
  const workerData = createTestWorker({ category: 'electrician' });
  const worker = await workerService.createWorker(workerData);
  expect(worker.category).toBe('electrician');
});
```

## Uncovered Code Analysis

### Finding Uncovered Code
```bash
# Generate coverage report
npm run test:coverage

# View uncovered lines in HTML report
open coverage/index.html

# Or use CLI to find uncovered files
npx nyc report --reporter=text-summary
```

### Common Uncovered Areas
1. Error handling branches
2. Edge cases
3. Async error scenarios
4. Validation edge cases
5. Authorization checks

### Strategies to Improve Coverage
1. Add tests for error paths
2. Test boundary conditions
3. Test async/await error handling
4. Test all authorization scenarios
5. Test input validation edge cases

## Continuous Monitoring

### Coverage Badges
```markdown
![Coverage](https://img.shields.io/codecov/c/github/username/repo)
```

### Coverage Trends
- Track coverage over time
- Set up alerts for coverage drops
- Review coverage in PR reviews

### Coverage Goals
- New code: 100% coverage
- Bug fixes: Add regression tests
- Refactoring: Maintain or improve coverage

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test Coverage Best Practices](https://martinfowler.com/bliki/TestCoverage.html)
