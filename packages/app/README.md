# BlueCollar Web App

Next.js frontend application for the BlueCollar platform.

## Architecture & Package Boundaries

- **[ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)** — documents monorepo boundary rules. `packages/app` is an independently deployed web application that communicates with `@bluecollar/api` via HTTP and directly with user wallets (Freighter) for transaction signing.
- **Allowed Dependencies**: Depends on `@bluecollar/types` and `@bluecollar/sdk`. Must not import from `packages/api/src` or `packages/mobile/src`.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Wallet Connection**: Freighter API / Stellar Wallets Kit
- **State Management & Data Fetching**: TanStack Query / React Context

## Getting Started

```bash
# Install dependencies (from root)
pnpm install

# Run development server
pnpm --filter @bluecollar/app dev
```

## Related Documentation

- [Contributing Guide](./CONTRIBUTING.md)
- [Design System](./DESIGN_SYSTEM.md)
- [PWA Guide](./PWA_GUIDE.md)
- [ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)
