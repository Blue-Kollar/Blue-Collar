# Contract Testing Guide

> Closes #430

BlueCollar uses [Pact](https://pact.io/) for consumer-driven contract testing to ensure the API and frontend remain compatible.

## Overview

| Role     | File                                                        | Purpose                                  |
| -------- | ----------------------------------------------------------- | ---------------------------------------- |
| Consumer | `src/__tests__/contract/consumer.workers.pact.test.ts`      | App defines expected API shape           |
| Provider | `src/__tests__/contract/provider.verification.pact.test.ts` | API verifies it satisfies consumer pacts |

## Running Locally

```bash
# Consumer tests (generates pact files in packages/api/pacts/)
cd packages/api
pnpm vitest run src/__tests__/contract/consumer.workers.pact.test.ts

# Provider verification (requires running DB)
DATABASE_URL=postgresql://... pnpm vitest run src/__tests__/contract/provider.verification.pact.test.ts
```

## CI

The `contract-tests.yml` workflow runs on every push/PR:

1. **consumer** job – runs consumer tests and uploads pact files as artifacts
2. **provider** job – downloads pacts and verifies the API satisfies them

## Adding New Contracts

1. Add an `addInteraction` block in `consumer.workers.pact.test.ts`
2. Add a matching `stateHandler` in `provider.verification.pact.test.ts`
3. Re-run consumer tests to regenerate the pact file

## Pact File Location

Generated pact JSON files are written to `packages/api/pacts/` (git-ignored).
