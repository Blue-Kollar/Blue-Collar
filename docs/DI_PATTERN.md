# Dependency Injection Pattern — BlueCollar API

## Overview

Services in `packages/api/src/services/` use a lightweight **factory-based dependency injection (DI)** pattern. Every service module exports:

1. A `createXxxService(deps)` factory that returns a bound service object wired to the injected dependencies.
2. Module-level function exports that delegate to a **default instance** wired with real production dependencies.

This keeps all existing controller code working unchanged while making unit tests trivial to write — no `vi.mock()` of entire modules required.

---

## Why DI?

Before DI, testing a service required mocking entire modules at the top of the test file:

```ts
// ❌ Old pattern — brittle, requires vi.mock() hoisting
vi.mock('../repositories/category.repository.js', () => ({
  categoryRepository: { findAll: vi.fn(), findById: vi.fn(), ... },
}))
import * as svc from './category.service.js'
```

With DI, tests inject plain mock objects directly:

```ts
// ✅ New pattern — clear, composable, no module hoisting
import { createCategoryService } from './category.service.js'

const mockRepo = { findAll: vi.fn(), findById: vi.fn(), ... }
const svc = createCategoryService({ categoryRepository: mockRepo })
```

---

## Service modules with DI factories

| Module | Factory | Deps interface |
|---|---|---|
| `category.service.ts` | `createCategoryService(deps)` | `CategoryServiceDeps` |
| `user.service.ts` | `createUserService(deps)` | `UserServiceDeps` |
| `auth.service.ts` | `createAuthService(deps)` | `AuthServiceDeps` |

---

## Quick reference

### category.service

```ts
import { createCategoryService } from '../services/category.service.js'
import type { ICategoryRepository } from '../repositories/category.repository.js'

// Test
const mockRepo: ICategoryRepository = {
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  findByName: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}
const svc = createCategoryService({ categoryRepository: mockRepo })
const cats = await svc.listCategories()
```

### user.service

```ts
import { createUserService } from '../services/user.service.js'

const mockRepo = {
  findById: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', ... }),
  update: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', ... }),
  delete: vi.fn(),
  // ... other repo methods
}
const mockMailer = {
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}
const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })
await svc.updateProfile('1', { firstName: 'Alice' })
```

### auth.service

```ts
import { createAuthService } from '../services/auth.service.js'

const mockRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByResetToken: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}
const mockMailer = {
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}
const mockDb = {
  refreshToken: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  device: {
    create: vi.fn().mockResolvedValue({ id: 'dev-1' }),
    updateMany: vi.fn(),
  },
}
const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })
```

---

## Adding DI to a new service

1. **Define a deps interface** in `src/container/types.ts`:
   ```ts
   export interface FooServiceDeps {
     fooRepository: IFooRepository
     // add other deps as needed
   }
   ```

2. **Add the factory** to the service module:
   ```ts
   export function createFooService(deps: FooServiceDeps) {
     const { fooRepository } = deps
     return {
       async doThing() { ... },
     }
   }
   ```

3. **Keep backward-compatible module exports**:
   ```ts
   const _default = createFooService({ fooRepository: defaultFooRepository })
   export async function doThing() { return _default.doThing() }
   ```

4. **Export from the container**:
   ```ts
   // src/container/index.ts
   export { createFooService } from '../services/foo.service.js'
   ```

5. **Write tests using injected mocks** (see `*.di.test.ts` files for examples).

---

## Acceptance criteria (issue #1076)

- [x] Lightweight DI container/factory pattern introduced in `src/container/`
- [x] `category.service`, `user.service`, `auth.service` refactored with factory functions
- [x] New DI-based tests: `category.service.di.test.ts`, `user.service.di.test.ts`, `auth.service.di.test.ts`
- [x] Backward-compatible module-level exports — zero changes to controllers
- [x] Pattern documented in this file
