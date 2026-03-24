import { Validator } from 'simple-body-validator'

/**
 * Validation rules for bulk delete workers endpoint
 */
export const bulkDeleteRules = (v: Validator) => {
    v.field('ids').required().array().minLength(1)
    v.field('ids.*').string()
}
