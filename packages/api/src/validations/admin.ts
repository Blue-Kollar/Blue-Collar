import { z } from 'zod'

// DELETE /admin/workers (bulk delete)
export const bulkDeleteRules = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

// PATCH /admin/workers (bulk toggle active)
export const bulkToggleRules = z.object({
  ids: z.array(z.string().min(1)).min(1),
  active: z.boolean(),
})
