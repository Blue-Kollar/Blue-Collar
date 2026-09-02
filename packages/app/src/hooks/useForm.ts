"use client";

import { ChangeEvent,useCallback, useState } from "react";

type FormErrors<T> = Partial<Record<keyof T, string>>;
type Validator<T> = (values: T) => FormErrors<T>;

/**
 * Generic form state management hook.
 *
 * @example
 * const { values, errors, handleChange, handleSubmit, isSubmitting } = useForm(
 *   { email: '', password: '' },
 *   async (values) => { await login(values.email, values.password) }
 * )
 */
export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>,
  validate?: Validator<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      // Clear field error on change
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    []
  );

  const setValue = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (validate) {
        const validationErrors = validate(values);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          return;
        }
      }
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, onSubmit]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  return { values, errors, isSubmitting, handleChange, setValue, handleSubmit, reset };
}
