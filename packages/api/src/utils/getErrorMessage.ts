/**
 * Safely extract a human-readable message from an unknown caught value.
 *
 * `catch` clauses are typed `unknown` under `strict`, so this narrows the value
 * to a string message without resorting to `any`. Handles `Error` instances,
 * objects with a `message` property (e.g. non-`Error` throwables), and falls
 * back to `String(err)` for primitives.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(err)
}
