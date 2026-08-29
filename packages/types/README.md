# @bluecollar/types

Shared TypeScript type definitions, Data Transfer Objects (DTOs), and Zod validation schemas for the BlueCollar platform.

## Responsibility & Package Boundary

`@bluecollar/types` is the pure type leaf package in the BlueCollar monorepo:

- **Zero workspace dependencies**: It has no runtime dependencies on other workspace packages (`sdk`, `api`, `app`, etc.).
- **Pure schemas and contracts**: Contains TypeScript interfaces, type aliases, and Zod validation schemas. Contains no I/O, database access, or network calls.
- **Universal dependency**: Every other package in the monorepo (`@bluecollar/sdk`, `@bluecollar/api`, `@bluecollar/app`, `@bluecollar/mobile`, `@bluecollar/monitoring`) may safely depend on `@bluecollar/types`.

For full architectural context and dependency rules, see:
- **[ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)**

## What's in here

| Export | Purpose |
|---|---|
| `@bluecollar/types` (`src/index.ts`) | Core domain models, user/worker interfaces, booking, escrow, dispute, and API response envelope types |
| `@bluecollar/types/validations` (`src/validations.ts`) | Reusable Zod schemas for validating request payloads and domain objects |

## Usage

```ts
import type { User, Worker, ApiResponse } from '@bluecollar/types'
import { registerSchema, loginSchema } from '@bluecollar/types/validations'
```

## Related Documentation

- [ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)
