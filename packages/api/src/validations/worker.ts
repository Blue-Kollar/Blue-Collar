/**
 * Validation rules for workers.
 */
export const createWorkerRules = {
  name: 'required|string',
  categoryId: 'required|string',
  phone: 'required_without:email',
  email: 'required_without:phone|email',
};
