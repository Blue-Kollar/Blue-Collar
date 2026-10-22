# Path Alias Convention Guide

## Overview

This document establishes the standard path alias convention for all TypeScript packages in the BlueCollar monorepo. Consistent path aliases improve code readability, reduce cognitive load when switching between packages, and make refactoring easier.

## Convention

All packages use **`@/*`** as the primary alias mapping to the package's `src/` directory.

### By Package

| Package | Alias | Maps To | Rationale |
|---------|-------|---------|-----------|
| `packages/api` | `@/*` | `src/*` | Enable clean imports for backend; match frontend convention |
| `packages/app` | `@/*` | `src/*` | Next.js standard; already implemented |
| `packages/mobile` | `@/*` | `src/*` | React Native standard; already implemented |
| `packages/contracts` | N/A | N/A | Rust project—no TypeScript config needed |

## Usage Examples

### Bad (Relative imports)
```typescript
// packages/api
import { UserService } from '../../../services/user.service'
import { validateUser } from '../../../../utils/validate'

// packages/app
import { useWorkers } from '../../hooks/queries/useWorkers'
import { API_URL } from '../config'
```

### Good (Path aliases)
```typescript
// packages/api
import { UserService } from '@/services/user.service'
import { validateUser } from '@/utils/validate'

// packages/app
import { useWorkers } from '@/hooks/queries/useWorkers'
import { API_URL } from '@/config'
```

## tsconfig.json Template

Use this structure in your package's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Build Tool Integration

### Next.js (packages/app)
Next.js automatically respects `tsconfig.json` paths. No additional configuration needed.

**Verification:**
```bash
cd packages/app
pnpm build
pnpm typecheck
```

### Node.js / Express (packages/api)
Use `tsx` (already in dependencies) or add build-time transpilation. The build process handles path resolution.

**Verification:**
```bash
cd packages/api
pnpm typecheck
pnpm build  # if applicable
```

### React Native / Expo (packages/mobile)
Expo's bundler automatically resolves TypeScript paths via `tsconfig.json`.

**Verification:**
```bash
cd packages/mobile
pnpm typecheck
```

## File Organization Pattern

Packages should organize `src/` directories into logical top-level folders:

```
src/
├── components/        # Reusable UI (app, mobile)
├── screens/          # Full-page components (mobile)
├── controllers/      # Route handlers (api)
├── services/         # Business logic
├── repositories/     # Data access layer (api)
├── hooks/            # Custom React hooks (app, mobile)
├── utils/            # Utility functions
├── lib/              # Library wrappers & client setup
├── types/            # TypeScript types & interfaces
├── middleware/       # Express/auth middleware (api)
├── config/           # Configuration files
├── __tests__/        # Tests (optional; can co-locate)
└── constants/        # Constants & enums
```

## Migration Path

1. **Update tsconfig.json** – Add/verify `baseUrl` and `paths` configuration
2. **Find & Replace** – Use IDE refactoring or automated tools:
   ```bash
   # Example with ripgrep + sed (manual validation recommended)
   rg "from ['\"]\.\./" --type ts --type tsx packages/api/src
   ```
3. **Test** – Run typecheck and build for each package
4. **Verify imports** – Spot-check critical paths in IDE for proper resolution

## Validation & Enforcement

### Pre-commit Hook (Optional)
Add a check to `pre-commit` configuration to catch relative imports:

```bash
# In .husky/pre-commit or similar
pnpm lint:imports  # custom script
```

### Linting Rule
Configure ESLint to prefer path aliases over relative imports:

```json
{
  "rules": {
    "import/no-relative-parent-imports": "warn",
    "no-restricted-imports": [
      "warn",
      {
        "patterns": ["../*/src/**"]
      }
    ]
  }
}
```

## Exceptions & Edge Cases

### Sibling Imports Within Same Directory
It's acceptable to use relative imports for siblings in the same directory:

```typescript
// src/controllers/workers.ts
import { validateWorker } from './validate-worker' // OK for siblings

// But prefer alias for deeper navigation:
import { UserService } from '@/services/user.service' // Preferred
```

### Test Files
Test files may use relative imports to test co-located modules, but prefer aliases for external dependencies:

```typescript
import { calculateFee } from '../payment.service' // OK for tested module
import { Logger } from '@/utils/logger' // Preferred for external
```

## FAQ

**Q: Why `@` instead of `~`?**
A: `@` is the industry standard for path aliases in modern JavaScript/TypeScript tooling (Next.js, Vite, React Native). It's immediately recognizable and reduces confusion when developers switch between projects.

**Q: Can I add more aliases like `@/types`, `@/utils`?**
A: Yes, but keep it minimal. The `@/*` convention is clearest. Only add additional aliases (e.g., `@components/*`) if the codebase structure demands it—complexity diminishes returns.

**Q: Does this work in compiled output?**
A: Yes. Bundlers and transpilers resolve `@` aliases to their real paths before output.

**Q: What about circular imports?**
A: Path aliases don't affect circular dependency issues. Use standard refactoring techniques (move logic to a new module, reorganize layer boundaries).

## References

- [TypeScript `paths` config](https://www.typescriptlang.org/tsconfig#paths)
- [Next.js path aliasing](https://nextjs.org/docs/app/building-your-application/configuring/absolute-imports-and-module-aliases)
- [Expo & TypeScript](https://docs.expo.dev/guides/typescript/)
- [Node.js TypeScript support](https://nodejs.org/en/learn/typescript/typescript-and-nodejs)

## Review Checklist

Before submitting a PR with import changes:

- [ ] All `../` and `../../` imports replaced with `@/` where possible
- [ ] Tests still pass (`pnpm test`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] IDE can resolve all import paths (no red squiggles)
- [ ] Relative imports only used for sibling modules in same directory
- [ ] No circular dependencies introduced

## Maintainers

This convention is maintained by the BlueCollar architecture team. For questions or updates, see [CONTRIBUTING.md](../CONTRIBUTING.md).
