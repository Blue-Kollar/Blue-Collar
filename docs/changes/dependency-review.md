# Dependency review, packages/app (issue #1608)

Scan: each devDependency searched for in `packages/app` source and config.

- `@axe-core/playwright` is used by `e2e/accessibility.spec.ts` and `e2e/a11y/core-pages.spec.ts`.
- `@percy/playwright` is used by `e2e/visual.spec.ts`.
- Packages with no literal import, `@types/leaflet`, `@types/leaflet.markercluster`,
  `@types/react`, `@vitest/coverage-v8` and `eslint-config-next`, are used implicitly by TypeScript,
  vitest or ESLint config. They are kept.

Result: no package removed. `pnpm why` was not run; run it before any removal.
