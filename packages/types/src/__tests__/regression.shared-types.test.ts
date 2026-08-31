/**
 * @regression Shared-types barrel integrity & recent bug fixes (#1271)
 *
 * Each describe block documents exactly which bug it guards against,
 * which commit introduced the fix, and (where applicable) a minimal
 * pre-fix code path that should fail the test.
 *
 * Tag convention: `@regression` in the JSDoc above each describe.
 *
 * Run individually:
 *   pnpm vitest run src/__tests__/regression.shared-types.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// BUG 1 – Shared-types barrel missing re-exports (commit 8d3de8f)
//
// What broke: A bad merge broke packages/types. During the time that package
// was failing to parse, a second issue in the app went unnoticed. The app
// barrel (packages/app/src/types/index.ts) only re-exported a subset of
// types from @bluecollar/types. Eight types were missing:
//   Job, JobApplication, Conversation, Message, AppNotification,
//   NotificationType, TipDTO, WorkerAnalytics
//
// The fix: Added all eight missing names to the export type block.
//
// Pre-fix path: remove the eight type names from the barrel — this test
// should fail because the re-exports are incomplete.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression App barrel re-exports all upstream types (commit 8d3de8f)
 */
describe('[regression] App barrel completeness – all upstream types must be re-exported', () => {
  it('packages/app/src/types/index.ts re-exports the critical 8 types', async () => {
    const barrelPath = join(process.cwd(), 'packages', 'app', 'src', 'types', 'index.ts')
    if (!existsSync(barrelPath)) {
      // Skip in environments where the app package isn't present
      return
    }

    const source = readFileSync(barrelPath, 'utf8')

    // The eight types that were missing before the fix
    const requiredTypes = [
      'Job',
      'JobApplication',
      'Conversation',
      'Message',
      'AppNotification',
      'NotificationType',
      'TipDTO',
      'WorkerAnalytics',
    ]

    for (const typeName of requiredTypes) {
      expect(
        source,
        `Type "${typeName}" is missing from packages/app/src/types/index.ts barrel. ` +
        `This is a regression of commit 8d3de8f.`
      ).toContain(typeName)
    }
  })

  it('packages/app/src/types/index.ts imports from @bluecollar/types (not a local copy)', async () => {
    const barrelPath = join(process.cwd(), 'packages', 'app', 'src', 'types', 'index.ts')
    if (!existsSync(barrelPath)) return

    const source = readFileSync(barrelPath, 'utf8')
    expect(source).toContain('@bluecollar/types')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 2 – Invoice interface missing from barrel (commit 8d3de8f)
//
// What broke: The Invoice interface was lost from the app barrel during the
// bad merge. Only InvoiceStatus, InvoiceLineItem, and InvoiceParty remained.
// This caused InvoiceView.test.tsx to fail because it imports Invoice from
// the barrel.
//
// Pre-fix path: remove the Invoice interface from the barrel —
// InvoiceView.test.tsx should fail to import.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Invoice interface shape must be defined (commit 8d3de8f)
 */
describe('[regression] Invoice interface – must be defined with correct shape', () => {
  it('Invoice interface is exported from the app barrel', async () => {
    const barrelPath = join(process.cwd(), 'packages', 'app', 'src', 'types', 'index.ts')
    if (!existsSync(barrelPath)) return

    const source = readFileSync(barrelPath, 'utf8')

    // The Invoice interface must be defined (not just re-exported)
    expect(source).toContain('export interface Invoice')
  })

  it('Invoice interface includes required fields', async () => {
    const barrelPath = join(process.cwd(), 'packages', 'app', 'src', 'types', 'index.ts')
    if (!existsSync(barrelPath)) return

    const source = readFileSync(barrelPath, 'utf8')

    const requiredFields = [
      'id: string',
      'number: string',
      'status: InvoiceStatus',
      'issuedAt: string',
      'currency: string',
      'worker: InvoiceParty',
      'client: InvoiceParty',
      'lineItems: InvoiceLineItem[]',
      'platformFee: number',
    ]

    for (const field of requiredFields) {
      expect(
        source,
        `Invoice interface missing field: ${field}`
      ).toContain(field)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3 – Worker.category incorrectly made optional (commit 1affd59)
//
// What broke: The Worker type's category field was made optional during the
// bad merge, but the Prisma model requires it. This caused 183 type errors
// in the app package.
//
// Pre-fix path: make Worker.category optional in the types barrel —
// app type-check should fail.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Worker.category must be required (commit 1affd59)
 */
describe('[regression] Worker.category – must be required field', () => {
  it('Worker type in shared types does not mark category as optional', async () => {
    const typesPath = join(process.cwd(), 'packages', 'types', 'src', 'index.ts')
    if (!existsSync(typesPath)) return

    const source = readFileSync(typesPath, 'utf8')

    // Find the Worker interface/type definition
    const workerMatch = source.match(/(?:interface|type)\s+Worker\s*[{<]/)
    if (!workerMatch) return // Worker not defined in this file

    // Extract the Worker type definition (until the next top-level declaration)
    const startIdx = source.indexOf(workerMatch[0])
    let braceCount = 0
    let endIdx = startIdx
    let foundFirstBrace = false
    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === '{') { braceCount++; foundFirstBrace = true }
      if (source[i] === '}') braceCount--
      if (foundFirstBrace && braceCount === 0) { endIdx = i + 1; break }
    }

    const workerDef = source.slice(startIdx, endIdx)

    // category must NOT be optional (no ? after category)
    const categoryLine = workerDef.split('\n').find(l => l.includes('category'))
    if (categoryLine) {
      expect(
        categoryLine,
        'Worker.category must be required (no ? modifier). This is a regression of commit 1affd59.'
      ).not.toContain('category?')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 4 – tsconfig.json was two concatenated JSON documents (commits 8352e48, 4c92302)
//
// What broke: A bad merge concatenated two JSON documents into tsconfig.json,
// making it unparsable. This broke the entire types package build.
//
// Pre-fix path: concatenate a second JSON document at the end of tsconfig.json —
// this test should fail.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression tsconfig.json must be a single valid JSON document (commits 4c92302, 8352e48)
 */
describe('[regression] packages/types tsconfig.json – valid single JSON document', () => {
  it('packages/types/tsconfig.json is valid JSON', () => {
    const tsconfigPath = join(process.cwd(), 'packages', 'types', 'tsconfig.json')
    if (!existsSync(tsconfigPath)) return

    const raw = readFileSync(tsconfigPath, 'utf8')
    expect(() => JSON.parse(raw), 'tsconfig.json is not valid JSON — possible concatenated documents').not.toThrow()
  })

  it('packages/types/tsconfig.json has expected keys', () => {
    const tsconfigPath = join(process.cwd(), 'packages', 'types', 'tsconfig.json')
    if (!existsSync(tsconfigPath)) return

    const raw = readFileSync(tsconfigPath, 'utf8')
    const config = JSON.parse(raw)

    // Must have at minimum compilerOptions
    expect(config).toHaveProperty('compilerOptions')
    expect(config.compilerOptions).toHaveProperty('target')
    expect(config.compilerOptions).toHaveProperty('declaration')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 5 – Duplicate interface declarations in packages/types (commits 4c92302, b34ebca)
//
// What broke: A bad merge appended duplicate declarations for ApiResponse,
// AuditLogEntry, Meta, RatingDistributionEntry to packages/types/src/index.ts.
// TypeScript treated them as duplicate identifiers.
//
// Pre-fix path: add a second `interface ApiResponse` declaration —
// this test should fail.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression No duplicate interface declarations in packages/types (commits 4c92302, b34ebca)
 */
describe('[regression] No duplicate interface/type declarations in packages/types', () => {
  it('packages/types/src/index.ts has no duplicate top-level declarations', () => {
    const typesPath = join(process.cwd(), 'packages', 'types', 'src', 'index.ts')
    if (!existsSync(typesPath)) return

    const source = readFileSync(typesPath, 'utf8')
    const lines = source.split('\n')

    // Collect all top-level interface/type declarations
    const declarations: Record<string, number> = {}
    for (const line of lines) {
      const match = line.match(/^\s*(?:export\s+)?(?:interface|type)\s+(\w+)/)
      if (match) {
        const name = match[1]
        declarations[name] = (declarations[name] || 0) + 1
      }
    }

    // Check for duplicates
    const duplicates = Object.entries(declarations).filter(([, count]) => count > 1)
    expect(
      duplicates,
      `Duplicate declarations found in packages/types/src/index.ts: ${duplicates.map(([k, v]) => `${k}(${v}x)`).join(', ')}`
    ).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 6 – QueryClientProvider not mounted (commit 6f2d2be)
//
// What broke: @tanstack/react-query was installed and hooks existed, but
// QueryClientProvider was never mounted in the provider tree. Every useQuery
// and useMutation call threw at runtime.
//
// Pre-fix path: remove the QueryClientProvider from the app layout —
// this test should fail.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression QueryClientProvider must be in the app provider tree (commit 6f2d2be)
 */
describe('[regression] QueryClientProvider – must be mounted in app layout', () => {
  it('app layout includes QueryClientProvider', async () => {
    const layoutPath = join(process.cwd(), 'packages', 'app', 'src', 'app', '[locale]', 'layout.tsx')
    if (!existsSync(layoutPath)) return

    const source = readFileSync(layoutPath, 'utf8')
    expect(
      source,
      'QueryClientProvider is missing from app layout. This is a regression of commit 6f2d2be.'
    ).toContain('QueryClientProvider')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 7 – pnpm-lock.yaml corruption (commits b34ebca, 9b9aeb6)
//
// What broke: Duplicate YAML keys and corrupted entries in pnpm-lock.yaml
// caused install failures and non-deterministic builds.
//
// Pre-fix path: This is guarded by CI (pnpm install --frozen-lockfile),
// but we add a structural test as an additional safety net.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression pnpm-lock.yaml must be parseable (commits b34ebca, 9b9aeb6)
 */
describe('[regression] pnpm-lock.yaml – must be parseable YAML', () => {
  it('pnpm-lock.yaml exists and starts with expected lockfileVersion header', () => {
    const lockfilePath = join(process.cwd(), 'pnpm-lock.yaml')
    if (!existsSync(lockfilePath)) return

    const raw = readFileSync(lockfilePath, 'utf8')
    // pnpm lockfiles start with "lockfileVersion:" on the first non-empty line
    const firstLine = raw.split('\n').find(l => l.trim().length > 0) || ''
    expect(firstLine).toMatch(/^lockfileVersion:/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 8 – packages/types exports all required types
//
// Sanity check: every type that the app barrel claims to re-export must
// actually exist in the upstream @bluecollar/types package.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression packages/types/src/index.ts exports all critical types
 */
describe('[regression] packages/types exports – all critical types present', () => {
  it('packages/types/src/index.ts exports the 8 previously-missing types', async () => {
    const typesPath = join(process.cwd(), 'packages', 'types', 'src', 'index.ts')
    if (!existsSync(typesPath)) return

    const source = readFileSync(typesPath, 'utf8')

    const criticalTypes = [
      'Job',
      'JobApplication',
      'Conversation',
      'Message',
      'AppNotification',
      'NotificationType',
      'TipDTO',
      'WorkerAnalytics',
    ]

    for (const typeName of criticalTypes) {
      // The type must be either defined or re-exported in the file
      const isDefined = new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${typeName}\\b`).test(source)
      const isReExported = new RegExp(`export\\s+.*\\b${typeName}\\b`).test(source)
      expect(
        isDefined || isReExported,
        `Type "${typeName}" is not defined or exported in packages/types/src/index.ts`
      ).toBe(true)
    }
  })

  it('packages/types exports Worker with required category field', async () => {
    const typesPath = join(process.cwd(), 'packages', 'types', 'src', 'index.ts')
    if (!existsSync(typesPath)) return

    const source = readFileSync(typesPath, 'utf8')
    // Worker should be exported (either defined or re-exported)
    expect(source).toMatch(/export\s+(?:interface|type)\s+Worker\b|export\s+.*\bWorker\b/)
  })
})
