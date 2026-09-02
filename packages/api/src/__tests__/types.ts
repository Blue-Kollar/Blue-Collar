/**
 * #1291 — Consolidated test types.
 *
 * These aliases previously duplicated Prisma-layer shapes already present
 * in @bluecollar/test-utils.  All internal test factories import from here
 * so this single redirect keeps their import paths unchanged while removing
 * the duplicate definitions.
 */
export type { FakeCategory as Category,FakeUser as User, FakeWorker as Worker } from '@bluecollar/test-utils'
